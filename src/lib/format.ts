// Norwegian (Bokmål) formatting helpers

const nok = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

const generic = (currency: string) =>
  new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NOK" ? 0 : 2,
  });

export function formatPrice(amount: string | number, currency = "NOK"): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (currency === "NOK") return nok.format(n);
  try {
    return generic(currency).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} t`;
  return `${h} t ${m} min`;
}

export function crossesMidnight(a: string, b: string): number {
  // Compare the wall-date portion of each ISO string. Works for naive
  // airport-local strings (demo) and offset strings (Duffel) alike,
  // independent of the viewer's timezone.
  const dayA = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const dayB = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  return Math.round((dayB - dayA) / 86_400_000);
}

export const CABIN_LABELS: Record<string, string> = {
  economy: "Økonomi",
  premium_economy: "Premium økonomi",
  business: "Business",
  first: "Første klasse",
};

export const PAX_LABELS: Record<string, string> = {
  adult: "Voksen",
  child: "Barn",
  infant_without_seat: "Baby",
};

export const STATUS_LABELS: Record<string, string> = {
  scheduled: "Planlagt",
  boarding: "Ombordstigning",
  departed: "Avgått",
  in_air: "I luften",
  landed: "Landet",
  delayed: "Forsinket",
  cancelled: "Kansellert",
};

export const TOPIC_LABELS: Record<string, string> = {
  booking: "Bestilling",
  change: "Endring av reise",
  refund: "Refusjon",
  baggage: "Bagasje",
  other: "Annet",
};
