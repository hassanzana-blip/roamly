// ─── HelloSky shared contracts ────────────────────────────────────────────────
// These types mirror the Duffel API v2 data model so the frontend works
// identically whether responses come from Duffel (live/test) or demo mode.

export type CabinClass = "economy" | "premium_economy" | "business" | "first";

export type PassengerType = "adult" | "child" | "infant_without_seat";

export interface SearchSliceInput {
  origin: string; // IATA airport or city code
  destination: string;
  departureDate: string; // YYYY-MM-DD
}

export interface SearchPassengerInput {
  type: PassengerType;
  age?: number; // required by Duffel for under-18s
}

export interface AirportPoint {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  terminal?: string;
  /** IANA-tidssone (fra Duffel `time_zone`), f.eks. "Europe/Oslo". */
  timeZone?: string;
}

export interface Carrier {
  iata: string;
  name: string;
}

export interface Segment {
  id: string;
  origin: AirportPoint;
  destination: AirportPoint;
  departingAt: string; // ISO 8601
  arrivingAt: string; // ISO 8601
  durationMinutes: number;
  carrier: Carrier;
  operatingCarrier?: Carrier;
  flightNumber: string;
  aircraft: string;
  cabinClass: CabinClass;
  /** Bagasje for dette segmentet (per passasjer). */
  baggage?: BaggageAllowance;
}

export interface OfferSlice {
  id: string;
  origin: AirportPoint;
  destination: AirportPoint;
  departingAt: string;
  arrivingAt: string;
  durationMinutes: number;
  stops: number;
  segments: Segment[];
}

export interface OfferPassenger {
  id: string;
  type: PassengerType;
  age?: number;
}

export interface BaggageAllowance {
  carryOnBags: number;
  checkedBags: number;
  /**
   * Settes bare når leverandøren ikke oppga tillatelsen. Da er tallet over 0
   * fordi vi ikke har noe bedre, men vi skal si «ikke oppgitt» til den
   * reisende — aldri «ikke inkludert», som er en påstand vi ikke har dekning for.
   */
  carryOnUnknown?: boolean;
  checkedUnknown?: boolean;
}

export interface OfferServices {
  maxExtraBags: number;
  extraBagPrice?: string; // amount per extra bag, in offer currency
  bagServiceId?: string; // Duffel service id (live mode)
}

/** Vilkår for endring/refusjon før avreise (Duffel `conditions`). */
export interface FareCondition {
  allowed: boolean;
  penaltyAmount?: string | null;
  penaltyCurrency?: string | null;
}

export interface OfferConditions {
  refundBeforeDeparture?: FareCondition;
  changeBeforeDeparture?: FareCondition;
}

export interface Offer {
  id: string;
  totalAmount: string;
  totalCurrency: string;
  baseAmount: string;
  taxAmount: string;
  owner: Carrier;
  expiresAt: string;
  cabinClass: CabinClass;
  slices: OfferSlice[];
  passengers: OfferPassenger[];
  baggage: BaggageAllowance;
  emissionsKg: number;
  refundable: boolean;
  changeable: boolean;
  conditions?: OfferConditions;
  /** true når flyselskapet krever pass/ID for denne ruten. */
  identityDocumentsRequired?: boolean;
  services?: OfferServices;
}

export interface SearchResult {
  offerRequestId: string;
  liveMode: boolean; // false = Duffel test mode OR demo mode
  demoMode: boolean; // true = local demo data (no API key configured)
  cabinClass: CabinClass;
  slices: SearchSliceInput[];
  passengers: SearchPassengerInput[];
  offers: Offer[];
}

// ─── Booking / orders ───────────────────────────────────────────────────────

export type Title = "mr" | "ms" | "mrs";
export type Gender = "m" | "f";

export interface PassengerDetails {
  id: string; // passenger id from the offer
  type: PassengerType;
  title?: Title;
  gender?: Gender;
  givenName: string;
  familyName: string;
  bornOn: string; // YYYY-MM-DD
  email?: string;
  phoneNumber?: string;
  infantPassengerId?: string;
  identityDocument?: {
    type: "passport";
    uniqueIdentifier: string;
    issuingCountryCode: string;
    expiresOn: string;
  };
}

/** Tilvalg som faktisk leveres av leverandøren. Seter/forsikring/oppgradering er fjernet
 *  inntil det finnes en leverandør bak dem. */
export interface OrderServices {
  extraBags: number;
  /** Fordeling av ekstra kolli per reisende (sum = extraBags). */
  bagsByPassenger?: Record<string, number>;
}

export type PaymentMethod = "card" | "klarna" | "vipps";

export interface Ticket {
  passengerId: string | null;
  passengerName: string | null;
  type: string;
  uniqueIdentifier: string;
}

/** Prisoppsett i minste enhet (øre/cent) — server er eneste kilde. */
export interface PriceBreakdownMinor {
  currency: string;
  supplierAmountMinor: number;
  servicesAmountMinor: number;
  serviceFeeAmountMinor: number;
  bonusUsedMinor: number;
  totalAmountMinor: number;
}

export interface Order {
  id: string;
  bookingReference: string;
  liveMode: boolean;
  demoMode: boolean;
  createdAt: string;
  totalAmount: string;
  totalCurrency: string;
  cabinClass: CabinClass;
  slices: OfferSlice[];
  passengers: PassengerDetails[];
  contactEmail: string;
  contactPhone: string;
  paymentStatus: "succeeded" | "pending" | "failed";
  tickets?: Ticket[];
  services?: OrderServices;
  servicesAmount?: string; // extra charged for bags/seats
  /** HelloSky servicegebyr (8 % + 250 kr) — inkludert i totalAmount. */
  serviceFeeAmount?: string;
  /** Leverandørens pris før servicegebyr. */
  supplierAmount?: string;
  /** Valgt betalingsmåte. */
  paymentMethod?: PaymentMethod;
  /** Bonus trukket fra ved bestilling (hele kroner). */
  bonusUsedKr?: number;
  /** Vilkår ved bestilling (kopi fra tilbudet). */
  conditions?: OfferConditions;
  /** Kansellert hos leverandør (ISO). */
  cancelledAt?: string | null;
}

// ─── Flight status ──────────────────────────────────────────────────────────

export type FlightStatusCode =
  | "scheduled"
  | "boarding"
  | "departed"
  | "in_air"
  | "landed"
  | "delayed"
  | "cancelled";

export interface FlightStatus {
  carrier: Carrier;
  flightNumber: string;
  date: string; // YYYY-MM-DD
  origin: AirportPoint;
  destination: AirportPoint;
  scheduledDeparture: string;
  estimatedDeparture: string;
  scheduledArrival: string;
  estimatedArrival: string;
  status: FlightStatusCode;
  delayMinutes: number;
  gate?: string;
  aircraft: string;
  progress: number; // 0–1, for the in-flight timeline
  fetchedAt?: string; // ISO — når statusen sist ble hentet
}

// ─── Support ────────────────────────────────────────────────────────────────

export interface SupportMessageInput {
  name: string;
  email: string;
  bookingReference?: string;
  topic: "booking" | "change" | "refund" | "baggage" | "other";
  message: string;
}

export interface SupportMessageReceipt {
  id: number;
  caseReference: string;
  receivedAt: string;
}

/**
 * Gjeldende servicegebyr-satser (speiler api/lib/pricing.ts inkl. admin-overstyring).
 * Klienten bruker dette KUN til forhåndsvisning — serveren priser alltid endelig.
 */
export interface FeeConfig {
  /** Prosentandel som brøk (0.08 = 8 %). */
  percent: number;
  /** Fast gebyr i minste enhet per valuta. Ukjent valuta → EUR. */
  flatMinorByCurrency: Record<string, number>;
}

export interface ServiceStatus {
  duffelConfigured: boolean;
  demoMode: boolean;
  liveMode: boolean;
  paymentsConfigured: boolean;
  instantBookingEnabled: boolean;
  stripePublishableKey: string | null;
  /** Valgfri til backend eksponerer den (OTA fee preview). */
  feeConfig?: FeeConfig;
}

// ─── Kvittering / faktura (OTA-172) ─────────────────────────────────────────

export interface InvoiceLine {
  description: string;
  amountMinor: number;
  /** Mva-sats som brøk (0, 0.12, 0.25). Beløpet er inkl. mva. */
  vatRate: number;
  vatMinor: number;
}

export interface InvoiceSummary {
  invoiceNumber: number | string;
  issuedAt: string;
  currency: string;
  totalMinor: number;
  vatMinor: number;
  lines: InvoiceLine[];
}

// ─── Tilbud (checkout-lenke) — passasjerer ──────────────────────────────────

export interface QuotePassengerSlot {
  id: string;
  type: PassengerType;
  age?: number;
}

export interface PriceHint {
  date: string; // YYYY-MM-DD
  amount: string | null; // cheapest found; null when unavailable
}

export interface SupportCase {
  caseReference: string;
  topic: string;
  message: string;
  bookingReference: string | null;
  createdAt: string;
}
