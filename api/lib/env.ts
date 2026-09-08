import "dotenv/config";
import { z } from "zod";

// ─── Validert miljøkonfigurasjon (fail-fast) ─────────────────────────────────
// Prod nekter å starte med usikker/ufullstendig konfigurasjon. Ingen ubrukte
// variabler kreves. Hemmeligheter logges aldri.

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  APP_BASE_URL: z.string().url().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).optional(),

  DUFFEL_API_KEY: z.string().default(""),
  DUFFEL_WEBHOOK_SECRET: z.string().optional(),

  // Travelport JSON API (v11) — kun søk foreløpig, avslått med mindre
  // TRAVELPORT_SEARCH_ENABLED=true. Booking går fortsatt via Duffel.
  TRAVELPORT_CLIENT_ID: z.string().optional(),
  TRAVELPORT_CLIENT_SECRET: z.string().optional(),
  TRAVELPORT_USERNAME: z.string().optional(),
  TRAVELPORT_PASSWORD: z.string().optional(),
  TRAVELPORT_PCC: z.string().optional(),
  TRAVELPORT_AUTH_URL: z.string().url().optional(),
  TRAVELPORT_BASE_URL: z.string().url().optional(),
  TRAVELPORT_SEARCH_ENABLED: z.string().optional(),

  // ── Sosial innlogging for kunder ──────────────────────────────────────
  // En leverandør er «konfigurert» først når både id og hemmelighet finnes.
  // Uten det vises den ikke i innloggingen – aldri en død knapp.
  OAUTH_APPLE_CLIENT_ID: z.string().optional(),
  OAUTH_APPLE_CLIENT_SECRET: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_ID: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
  OAUTH_FACEBOOK_CLIENT_ID: z.string().optional(),
  OAUTH_FACEBOOK_CLIENT_SECRET: z.string().optional(),
  OAUTH_X_CLIENT_ID: z.string().optional(),
  OAUTH_X_CLIENT_SECRET: z.string().optional(),
  TRAVELPORT_CONTENT_SOURCE: z.string().optional(),

  // Sanntids flystatus (AviationStack). Uten nøkkel svarer flystatus-siden
  // ærlig at sanntidsdata ikke er tilgjengelig.
  // Førstegangsoppsett av eierkonto via nett. Av som standard: må slås på
  // bevisst, og slås av igjen etterpå. Uten dette ville skjemaet stå åpent for
  // hvem som helst hver gang det ikke finnes en aktiv ansattkonto.
  STAFF_BOOTSTRAP_ENABLED: z.string().optional(),

  AVIATIONSTACK_API_KEY: z.string().optional(),
  AVIATIONSTACK_BASE_URL: z.string().url().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  SMTP_URL: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  OPS_ALERT_EMAIL: z.string().optional(),
  OPS_ALERT_WEBHOOK_URL: z.string().url().optional(),

  /** 32 byte base64 — brukes til AES-256-GCM på passnummer m.m. */
  PII_ENCRYPTION_KEY: z.string().optional(),
  PUBLIC_INSTANT_BOOKING: z.string().default("true"),
  /** Øvre grense (i minste enhet av NOK) for samlede live-bookinger per døgn. */
  MAX_DAILY_LIVE_AMOUNT_MINOR: z.coerce.number().int().nonnegative().default(0),
  SMS_PROVIDER: z.enum(["none", "twilio"]).default("none"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),
  SERVICE_FEE_PERCENT: z.coerce.number().min(0).max(1).default(0.08),
  SERVICE_FEE_FLAT_MINOR: z.coerce.number().int().nonnegative().default(25000),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
  /** Valgfri Sentry-DSN — tom = ingen feilrapportering. */
  SENTRY_DSN: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  /** Bearer-token for GET /metrics. Tom = åpent (kun bak privat nett!). */
  METRICS_TOKEN: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Ugyldig miljøkonfigurasjon: ${issues}`);
}
const raw = parsed.data;

const isProduction = raw.NODE_ENV === "production";
const isProdEnv = raw.APP_ENV === "production";
const duffelLive = raw.DUFFEL_API_KEY.startsWith("duffel_live_");
const duffelConfigured = raw.DUFFEL_API_KEY.length > 0 && !raw.DUFFEL_API_KEY.includes("*");
const smtpConfigured = Boolean(raw.SMTP_URL || raw.SMTP_HOST);
const stripeConfigured = Boolean(raw.STRIPE_SECRET_KEY && raw.STRIPE_PUBLISHABLE_KEY);

/** Harde produksjonsregler — kjøres ved oppstart av web og worker. */
export function assertProductionSafety(): void {
  if (process.env.SKIP_ENV_SAFETY === "true") return; // kun for tester
  const errors: string[] = [];
  if (isProduction && !raw.DATABASE_URL) errors.push("DATABASE_URL mangler");
  if (isProdEnv) {
    if (!duffelLive) errors.push("APP_ENV=production krever DUFFEL_API_KEY som starter med duffel_live_ (demomodus er forbudt i produksjon)");
    if (!stripeConfigured) errors.push("APP_ENV=production krever STRIPE_SECRET_KEY og STRIPE_PUBLISHABLE_KEY");
    if (!raw.STRIPE_SECRET_KEY?.startsWith("sk_live_")) errors.push("APP_ENV=production krever Stripe live-nøkkel (sk_live_)");
    if (!raw.STRIPE_WEBHOOK_SECRET) errors.push("STRIPE_WEBHOOK_SECRET mangler");
    if (!raw.DUFFEL_WEBHOOK_SECRET) errors.push("DUFFEL_WEBHOOK_SECRET mangler");
    if (!smtpConfigured) errors.push("SMTP må være konfigurert i produksjon (ellers logges tokens)");
    if (!raw.PII_ENCRYPTION_KEY) errors.push("PII_ENCRYPTION_KEY mangler (kryptering av passdata)");
    if (!raw.APP_BASE_URL?.startsWith("https://")) errors.push("APP_BASE_URL må være https i produksjon");
  } else {
    if (duffelLive) errors.push(`Live Duffel-nøkkel er ikke tillatt når APP_ENV=${raw.APP_ENV}`);
    if (raw.STRIPE_SECRET_KEY?.startsWith("sk_live_")) errors.push(`Live Stripe-nøkkel er ikke tillatt når APP_ENV=${raw.APP_ENV}`);
  }
  if (errors.length) {
    throw new Error(`Produksjonssikring feilet:\n - ${errors.join("\n - ")}`);
  }
}

/**
 * Leverandører for sosial innlogging som faktisk er satt opp.
 *
 * Kilden er miljøet, ikke en liste i frontend. Å skru på Google er å sette to
 * miljøvariabler i Railway – ikke å endre kode og deploye på nytt. Er bare
 * den ene satt, teller leverandøren som ikke konfigurert: en halvveis
 * oppsatt OAuth-knapp er verre enn ingen knapp.
 */
export type OAuthProviderId = "apple" | "google" | "facebook" | "x";

export function configuredOAuthProviders(): OAuthProviderId[] {
  const pairs: [OAuthProviderId, string | undefined, string | undefined][] = [
    ["apple", raw.OAUTH_APPLE_CLIENT_ID, raw.OAUTH_APPLE_CLIENT_SECRET],
    ["google", raw.OAUTH_GOOGLE_CLIENT_ID, raw.OAUTH_GOOGLE_CLIENT_SECRET],
    ["facebook", raw.OAUTH_FACEBOOK_CLIENT_ID, raw.OAUTH_FACEBOOK_CLIENT_SECRET],
    ["x", raw.OAUTH_X_CLIENT_ID, raw.OAUTH_X_CLIENT_SECRET],
  ];
  return pairs.filter(([, id, secret]) => Boolean(id?.trim()) && Boolean(secret?.trim())).map(([id]) => id);
}

export const env = {
  ...raw,
  isProduction,
  isProdEnv,
  duffelConfigured,
  duffelLive,
  smtpConfigured,
  stripeConfigured,
  databaseUrl: raw.DATABASE_URL ?? "",
  baseUrl: (raw.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  instantBookingEnabled: raw.PUBLIC_INSTANT_BOOKING !== "false",
};
