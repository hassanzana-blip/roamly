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
  // ── Sosial innlogging via Clerk (Apple, Google, Facebook) ──────────────
  // Clerk er identitetsmegleren: den kjører OAuth-flyten (state, nonce, PKCE)
  // og gir klienten et kortlevd token som serveren verifiserer og bytter mot
  // HelloSkys egen sesjon. Hemmeligheten finnes KUN her på serveren; den
  // publiserbare nøkkelen er laget for å stå i nettleseren.
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  /** Hvilke sosiale leverandører som er slått på i Clerk-dashbordet, f.eks. «google,apple,facebook». */
  CLERK_SOCIAL_PROVIDERS: z.string().optional(),
  TRAVELPORT_CONTENT_SOURCE: z.string().optional(),

  // ── KAYAK Affiliate Flights API (metasøk: kunden bestiller hos leverandøren) ──
  // Nøkkelen finnes KUN her på serveren. Sandbox-nøkkel og produksjonsnøkkel
  // er separate variabler så ingen kan «glemme» hvilken som er i bruk.
  KAYAK_SANDBOX_API_KEY: z.string().optional(),
  KAYAK_API_KEY: z.string().optional(),
  KAYAK_API_MODE: z.enum(["sandbox", "production"]).default("sandbox"),
  /** Base-URL for produksjon (kommer med produksjonsnøkkelen). Sandbox har dokumentert standard. */
  KAYAK_BASE_URL: z.string().url().optional(),
  KAYAK_FLIGHTS_ENABLED: z.string().optional(),
  /** Hotellsøk via KAYAK Hotels API (metasøk, ekstern bestilling). */
  KAYAK_HOTELS_ENABLED: z.string().optional(),
  /** Leiebilsøk via KAYAK Cars API (metasøk, ekstern bestilling). */
  KAYAK_CARS_ENABLED: z.string().optional(),
  /** Standardvaluta KAYAK skal prise i når kunden ikke har valgt (HelloSky Norge → NOK). */
  KAYAK_DEFAULT_CURRENCY: z.string().regex(/^[A-Z]{3}$/).default("NOK"),
  /** Tillat `provider=kayak` per søk selv om KAYAK ikke er standardleverandør (intern test/forhåndsvisning). */
  KAYAK_PREVIEW: z.string().optional(),
  /** Må settes bevisst før KAYAK *sandbox* får bli standardleverandør i APP_ENV=production. */
  KAYAK_ALLOW_SANDBOX_IN_PRODUCTION: z.string().optional(),
  /** Hvilken leverandør et vanlig søk går til. auto = som før (Travelport hvis slått på, ellers Duffel, ellers demo). */
  FLIGHT_PROVIDER: z.enum(["auto", "duffel", "travelport", "kayak"]).default("auto"),
  /** Flyselskap-direkte: off | prefer (sorter først) | only (skjul reisebyråer). */
  AIRLINE_DIRECT_MODE: z.enum(["off", "prefer", "only"]).optional(),
  /** Kortform: AIRLINE_DIRECT_ONLY=true ⇒ AIRLINE_DIRECT_MODE=only. */
  AIRLINE_DIRECT_ONLY: z.string().optional(),

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
const kayakKey = raw.KAYAK_API_MODE === "production" ? raw.KAYAK_API_KEY : raw.KAYAK_SANDBOX_API_KEY;
const kayakConfigured = Boolean(kayakKey && kayakKey.trim().length > 0 && !kayakKey.includes("*"));
const kayakEnabled = raw.KAYAK_FLIGHTS_ENABLED === "true" && kayakConfigured;
const kayakHotelsEnabled = raw.KAYAK_HOTELS_ENABLED === "true" && kayakConfigured;
const kayakCarsEnabled = raw.KAYAK_CARS_ENABLED === "true" && kayakConfigured;
const airlineDirectMode: "off" | "prefer" | "only" = raw.AIRLINE_DIRECT_ONLY === "true" ? "only" : (raw.AIRLINE_DIRECT_MODE ?? "prefer");
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
    // Sandkassepriser er ikke inventar. KAYAK sandbox får bare være standard
    // søkeleverandør i produksjon når noen har skrevet det med rene ord.
    if (raw.FLIGHT_PROVIDER === "kayak" && raw.KAYAK_API_MODE === "sandbox" && raw.KAYAK_ALLOW_SANDBOX_IN_PRODUCTION !== "true") {
      errors.push("FLIGHT_PROVIDER=kayak med KAYAK_API_MODE=sandbox krever KAYAK_ALLOW_SANDBOX_IN_PRODUCTION=true (sandkassepriser skal ikke vises som ekte)");
    }
    if (raw.KAYAK_API_MODE === "production" && kayakEnabled && !raw.KAYAK_BASE_URL) {
      errors.push("KAYAK_API_MODE=production krever KAYAK_BASE_URL (produksjonsdomenet fra KAYAK)");
    }
    if (!raw.PII_ENCRYPTION_KEY) errors.push("PII_ENCRYPTION_KEY mangler (kryptering av passdata)");
    if (!raw.APP_BASE_URL?.startsWith("https://")) errors.push("APP_BASE_URL må være https i produksjon");
  } else {
    if (duffelLive) errors.push(`Live Duffel-nøkkel er ikke tillatt når APP_ENV=${raw.APP_ENV}`);
    if (raw.STRIPE_SECRET_KEY?.startsWith("sk_live_")) errors.push(`Live Stripe-nøkkel er ikke tillatt når APP_ENV=${raw.APP_ENV}`);
  }
  if (raw.FLIGHT_PROVIDER === "kayak" && !kayakEnabled) {
    errors.push("FLIGHT_PROVIDER=kayak krever KAYAK_FLIGHTS_ENABLED=true og en KAYAK-nøkkel (KAYAK_SANDBOX_API_KEY eller KAYAK_API_KEY)");
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

/**
 * Sosial innlogging via Clerk er «på» først når hemmelig nøkkel, publiserbar
 * nøkkel og minst én leverandør er satt. Da – og bare da – vises knappene.
 */
const CLERK_SOCIALS = ["apple", "google", "facebook", "x"] as const;
export type ClerkSocial = (typeof CLERK_SOCIALS)[number];
export function clerkConfig(): { enabled: boolean; publishableKey: string | null; secretKey: string | null; providers: ClerkSocial[] } {
  const secretKey = raw.CLERK_SECRET_KEY?.trim() || null;
  const publishableKey = raw.CLERK_PUBLISHABLE_KEY?.trim() || null;
  const providers = (raw.CLERK_SOCIAL_PROVIDERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ClerkSocial => (CLERK_SOCIALS as readonly string[]).includes(s));
  const enabled = Boolean(secretKey && publishableKey && providers.length > 0);
  return { enabled, publishableKey: enabled ? publishableKey : null, secretKey: enabled ? secretKey : null, providers: enabled ? providers : [] };
}

/**
 * Clerks frontend-API-vert, utledet av den publiserbare nøkkelen: «pk_live_»
 * eller «pk_test_» + base64 av verten med en avsluttende «$». Verten må stå i
 * CSP-ens script-src og connect-src, ellers nekter nettleseren å laste
 * clerk.browser.js og knappen vises uten å virke (failed_to_load_clerk_js).
 * Utledet i stedet for hardkodet, så policyen følger nøkkelen.
 */
export function clerkFrontendApiOrigin(): string | null {
  const key = clerkConfig().publishableKey;
  if (!key) return null;
  const encoded = key.replace(/^pk_(live|test)_/, "");
  if (!encoded || encoded === key) return null;
  try {
    const host = Buffer.from(encoded, "base64").toString("utf8").replace(/\$+$/, "");
    // Streng validering: verdien går rett inn i en sikkerhetsheader.
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host) ? `https://${host}` : null;
  } catch {
    return null;
  }
}

export const env = {
  ...raw,
  isProduction,
  isProdEnv,
  duffelConfigured,
  duffelLive,
  /** KAYAK-nøkkelen for aktiv modus. Leses KUN av api/lib/kayak.ts – aldri logg den. */
  kayakApiKey: kayakKey ?? "",
  kayakConfigured,
  kayakEnabled,
  kayakHotelsEnabled,
  kayakCarsEnabled,
  kayakPreview: raw.KAYAK_PREVIEW === "true" && kayakEnabled,
  airlineDirectMode,
  smtpConfigured,
  stripeConfigured,
  databaseUrl: raw.DATABASE_URL ?? "",
  baseUrl: (raw.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  instantBookingEnabled: raw.PUBLIC_INSTANT_BOOKING !== "false",
};
