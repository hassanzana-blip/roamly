// ─── Enkle prosess-lokale tellere i Prometheus-tekstformat ──────────────────
// Ingen ekstern avhengighet. Tellerne nullstilles ved omstart (normalt for
// Prometheus-countere — rate()/increase() håndterer det). Eksponeres på
// GET /metrics (beskyttet med METRICS_TOKEN når satt). Web og worker er egne
// prosesser og har hver sine tellere.

export type Labels = Record<string, string>;

type CounterDef = { name: string; help: string; labelNames: readonly string[] };

const DEFINITIONS: Record<string, CounterDef> = {
  bookings_confirmed_total: { name: "bookings_confirmed_total", help: "Bookinger som har nådd CONFIRMED.", labelNames: [] },
  booking_attempts_failed_total: { name: "booking_attempts_failed_total", help: "Booking-forsøk som endte i FAILED_VOIDED.", labelNames: ["code"] },
  duffel_requests_total: { name: "duffel_requests_total", help: "HTTP-kall mot Duffel etter utfall.", labelNames: ["outcome"] },
  stripe_webhooks_total: { name: "stripe_webhooks_total", help: "Mottatte Stripe-webhooks etter utfall.", labelNames: ["outcome"] },
  jobs_dead_total: { name: "jobs_dead_total", help: "Jobber som gikk til dead-letter.", labelNames: ["type"] },
  refund_cases_total: { name: "refund_cases_total", help: "Refusjonssaker etter tilstand (inkrementeres ved hver overgang).", labelNames: ["state"] },
  trpc_errors_total: { name: "trpc_errors_total", help: "tRPC-feil etter kode.", labelNames: ["code"] },
};

export type CounterName = keyof typeof DEFINITIONS;

const values = new Map<string, number>();

function serializeLabels(def: CounterDef, labels: Labels): string {
  if (def.labelNames.length === 0) return "";
  const parts = def.labelNames.map((k) => `${k}="${escapeLabel(labels[k] ?? "unknown")}"`);
  return `{${parts.join(",")}}`;
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").slice(0, 120);
}

/** Øk en teller med `by` (standard 1). Ukjente etikettnøkler ignoreres. */
export function inc(name: CounterName, labels: Labels = {}, by = 1): void {
  const def = DEFINITIONS[name];
  if (!def) return;
  const key = `${def.name}${serializeLabels(def, labels)}`;
  values.set(key, (values.get(key) ?? 0) + by);
}

/** Nåverdi (for tester/diagnose). */
export function get(name: CounterName, labels: Labels = {}): number {
  const def = DEFINITIONS[name];
  if (!def) return 0;
  return values.get(`${def.name}${serializeLabels(def, labels)}`) ?? 0;
}

/** Nullstill alle tellere (kun tester). */
export function resetMetrics(): void {
  values.clear();
}

/** Prometheus text exposition format (version 0.0.4). Alle definerte tellere listes, også de på 0. */
export function renderPrometheus(): string {
  const lines: string[] = [];
  for (const def of Object.values(DEFINITIONS)) {
    lines.push(`# HELP ${def.name} ${def.help}`);
    lines.push(`# TYPE ${def.name} counter`);
    const prefix = def.name;
    const rows = [...values.entries()].filter(([k]) => k === prefix || k.startsWith(`${prefix}{`)).sort(([a], [b]) => a.localeCompare(b));
    if (rows.length === 0) {
      lines.push(`${prefix}${def.labelNames.length ? "" : ""} 0`);
    } else {
      for (const [k, v] of rows) lines.push(`${k} ${v}`);
    }
  }
  lines.push(`# HELP process_uptime_seconds Sekunder siden prosessen startet.`);
  lines.push(`# TYPE process_uptime_seconds gauge`);
  lines.push(`process_uptime_seconds ${Math.floor(process.uptime())}`);
  return `${lines.join("\n")}\n`;
}
