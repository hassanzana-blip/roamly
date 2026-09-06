// ─── Roamly shared contracts ────────────────────────────────────────────────
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
}

export interface OfferServices {
  maxExtraBags: number;
  extraBagPrice?: string; // amount per extra bag, in offer currency
  bagServiceId?: string; // Duffel service id (live mode)
  seatPrice?: string; // "0" = included; undefined = seat selection unavailable
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
  title: Title;
  gender: Gender;
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

export interface OrderServices {
  extraBags: number;
  seats: Record<string, string>; // passengerId → seat designation, e.g. "4A"
}

export interface CreateOrderInput {
  offerId: string;
  contactEmail: string;
  contactPhone: string;
  passengers: PassengerDetails[];
  services?: OrderServices;
  card?: {
    number: string;
    expiryMonth: string;
    expiryYear: string;
    cvc: string;
    holderName: string;
  };
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
  services?: OrderServices;
  servicesAmount?: string; // extra charged for bags/seats
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

export interface ServiceStatus {
  duffelConfigured: boolean;
  demoMode: boolean;
  paymentMode: "balance" | "card";
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
