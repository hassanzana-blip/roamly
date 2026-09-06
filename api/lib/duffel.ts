import "dotenv/config";
import type {
  CabinClass,
  Offer,
  OfferSlice,
  Order,
  PassengerDetails,
  SearchPassengerInput,
  SearchResult,
  SearchSliceInput,
  Segment,
} from "../../contracts/types";
import { airportByIata } from "../../contracts/airports";

// ─── Duffel API v2 client ───────────────────────────────────────────────────
// The API key lives only on the server. If DUFFEL_API_KEY is not set, the
// router falls back to the built-in demo engine (same data model).

const API_BASE = "https://api.duffel.com";

export const duffelConfig = {
  apiKey: process.env.DUFFEL_API_KEY ?? "",
  get configured() {
    return this.apiKey.length > 0 && !this.apiKey.includes("*");
  },
  get liveMode() {
    return this.apiKey.startsWith("duffel_live_");
  },
  // In test mode Duffel balance is unlimited — standard integration path.
  // "card" requires Duffel Payments activation + 3DS component (see README).
  paymentType: (process.env.DUFFEL_PAYMENT_TYPE ?? "balance") as "balance" | "card",
};

export class DuffelError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "DuffelError";
    this.status = status;
    this.code = code;
  }
}

async function duffelFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip",
      "Duffel-Version": "v2",
      Authorization: `Bearer ${duffelConfig.apiKey}`,
      ...init?.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errors = (body as { errors?: { message?: string; code?: string }[] }).errors;
    const first = errors?.[0];
    throw new DuffelError(
      first?.message ?? `Duffel API svarte med ${res.status}`,
      res.status,
      first?.code,
    );
  }
  return body as T;
}

// ─── Duration helpers ───────────────────────────────────────────────────────

export function isoDurationToMinutes(duration?: string | null): number {
  if (!duration) return 0;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(duration);
  if (!m) return 0;
  return (Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0);
}

export function minutesToIsoDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `PT${h}H${m}M`;
}

// ─── Duffel → contract mappers ──────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapPlace(p: any) {
  const iata: string = p?.iata_code ?? p?.iata_city_code ?? "";
  const known = airportByIata(iata);
  return {
    iata,
    name: p?.name ?? known?.name ?? iata,
    city: p?.city_name ?? p?.city?.name ?? known?.city ?? iata,
    country: known?.country ?? "",
    lat: known?.lat ?? 0,
    lng: known?.lng ?? 0,
  };
}

function mapCarrier(c: any) {
  return { iata: c?.iata_code ?? "", name: c?.name ?? "" };
}

function mapSegment(seg: any): Segment {
  const pax0 = seg?.passengers?.[0];
  return {
    id: seg?.id ?? "",
    origin: mapPlace(seg?.origin),
    destination: mapPlace(seg?.destination),
    departingAt: seg?.departing_at ?? "",
    arrivingAt: seg?.arriving_at ?? "",
    durationMinutes: isoDurationToMinutes(seg?.duration),
    carrier: mapCarrier(seg?.marketing_carrier),
    operatingCarrier: mapCarrier(seg?.operating_carrier),
    flightNumber: String(seg?.marketing_carrier_flight_number ?? ""),
    aircraft: seg?.aircraft?.name ?? "Ukjent flytype",
    cabinClass: (pax0?.cabin_class ?? "economy") as CabinClass,
  };
}

function mapSlice(slice: any): OfferSlice {
  const segments: Segment[] = (slice?.segments ?? []).map(mapSegment);
  return {
    id: slice?.id ?? "",
    origin: mapPlace(slice?.origin),
    destination: mapPlace(slice?.destination),
    departingAt: segments[0]?.departingAt ?? "",
    arrivingAt: segments[segments.length - 1]?.arrivingAt ?? "",
    durationMinutes: isoDurationToMinutes(slice?.duration),
    stops: Math.max(0, segments.length - 1),
    segments,
  };
}

export function mapOffer(o: any): Offer {
  const slices: OfferSlice[] = (o?.slices ?? []).map(mapSlice);
  // Baggage: take the most generous allowance across segments (per passenger)
  let carryOn = 0;
  let checked = 0;
  for (const s of o?.slices ?? []) {
    for (const seg of s?.segments ?? []) {
      for (const b of seg?.passengers?.[0]?.baggages ?? []) {
        if (b?.type === "carry_on") carryOn = Math.max(carryOn, b?.quantity ?? 0);
        if (b?.type === "checked") checked = Math.max(checked, b?.quantity ?? 0);
      }
    }
  }
  return {
    id: o?.id ?? "",
    totalAmount: o?.total_amount ?? "0",
    totalCurrency: o?.total_currency ?? "NOK",
    baseAmount: o?.base_amount ?? o?.total_amount ?? "0",
    taxAmount: o?.tax_amount ?? "0",
    owner: mapCarrier(o?.owner),
    expiresAt: o?.expires_at ?? "",
    cabinClass: slices[0]?.segments[0]?.cabinClass ?? "economy",
    slices,
    passengers: (o?.passengers ?? []).map((p: any) => ({
      id: p?.id ?? "",
      type: p?.type ?? "adult",
      age: p?.age,
    })),
    baggage: { carryOnBags: carryOn, checkedBags: checked },
    emissionsKg: Number(o?.total_emissions_kg ?? 0),
    refundable: Boolean(o?.conditions?.refund_before_departure?.allowed),
    changeable: Boolean(o?.conditions?.change_before_departure?.allowed),
    services: mapServices(o),
  };
}

function mapServices(o: any) {
  const bagService = (o?.available_services ?? []).find((s: any) => s?.type === "baggage");
  if (!bagService) return undefined;
  return {
    maxExtraBags: Math.min(3, Number(bagService?.maximum_quantity ?? 1)),
    extraBagPrice: bagService?.total_amount,
    bagServiceId: bagService?.id,
    seatPrice: undefined, // seat maps are a separate Duffel flow; handled at check-in
  };
}

// ─── Search ─────────────────────────────────────────────────────────────────

export async function duffelSearch(input: {
  slices: SearchSliceInput[];
  passengers: SearchPassengerInput[];
  cabinClass: CabinClass;
}): Promise<SearchResult> {
  const res = await duffelFetch<{ data: any }>(
    "/air/offer_requests?return_offers=true&supplier_timeout=20000",
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          slices: input.slices.map((s) => ({
            origin: s.origin,
            destination: s.destination,
            departure_date: s.departureDate,
          })),
          passengers: input.passengers.map((p) =>
            p.age !== undefined && p.type !== "adult" ? { age: p.age } : { type: p.type },
          ),
          cabin_class: input.cabinClass,
          max_connections: 2,
        },
      }),
    },
  );
  const data = res.data;
  return {
    offerRequestId: data?.id ?? "",
    liveMode: Boolean(data?.live_mode),
    demoMode: false,
    cabinClass: input.cabinClass,
    slices: input.slices,
    passengers: input.passengers,
    offers: (data?.offers ?? []).map(mapOffer),
  };
}

export async function duffelGetOffer(offerId: string): Promise<Offer> {
  const res = await duffelFetch<{ data: any }>(
    `/air/offers/${offerId}?return_available_services=true`,
  );
  return mapOffer(res.data);
}

// ─── Order creation ─────────────────────────────────────────────────────────

export async function duffelCreateOrder(input: {
  offer: Offer;
  passengers: PassengerDetails[];
  contactEmail: string;
  contactPhone: string;
  services?: { extraBags: number; seats: Record<string, string> };
}): Promise<Order> {
  const bagServiceId = input.offer.services?.bagServiceId;
  const extraBags = input.services?.extraBags ?? 0;
  const res = await duffelFetch<{ data: any }>("/air/orders", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "instant",
        selected_offers: [input.offer.id],
        ...(bagServiceId && extraBags > 0
          ? { services: [{ id: bagServiceId, quantity: extraBags }] }
          : {}),
        payments: [
          {
            type: duffelConfig.paymentType,
            currency: input.offer.totalCurrency,
            amount: input.offer.totalAmount,
          },
        ],
        passengers: input.passengers.map((p) => ({
          id: p.id,
          title: p.title,
          gender: p.gender,
          given_name: p.givenName,
          family_name: p.familyName,
          born_on: p.bornOn,
          email: p.email ?? input.contactEmail,
          phone_number: p.phoneNumber ?? input.contactPhone,
          ...(p.infantPassengerId ? { infant_passenger_id: p.infantPassengerId } : {}),
          ...(p.identityDocument
            ? {
                identity_documents: [
                  {
                    type: "passport",
                    unique_identifier: p.identityDocument.uniqueIdentifier,
                    issuing_country_code: p.identityDocument.issuingCountryCode,
                    expires_on: p.identityDocument.expiresOn,
                  },
                ],
              }
            : {}),
        })),
        metadata: { source: "roamly" },
      },
    }),
  });
  const o = res.data;
  return {
    id: o?.id ?? "",
    bookingReference: o?.booking_reference ?? "",
    liveMode: Boolean(o?.live_mode),
    demoMode: false,
    createdAt: o?.created_at ?? new Date().toISOString(),
    totalAmount: o?.total_amount ?? input.offer.totalAmount,
    totalCurrency: o?.total_currency ?? input.offer.totalCurrency,
    cabinClass: input.offer.cabinClass,
    slices: (o?.slices ?? []).length ? (o.slices as any[]).map(mapSlice) : input.offer.slices,
    passengers: input.passengers,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    paymentStatus: "succeeded",
    services: input.services,
  };
}

export async function duffelGetOrder(orderId: string): Promise<Record<string, unknown>> {
  const res = await duffelFetch<{ data: any }>(`/air/orders/${orderId}`);
  return res.data as Record<string, unknown>;
}
