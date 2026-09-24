// ─── Appens kundeinnlogging (mobileAuth på /api/mobile/trpc) ────────────────
// Typene serveren svarer med og appen leser. Serveren (api/mobileAuth.ts og
// publicProfile i api/customerAuth.ts) er annotert med dem, så et avvik i
// formen stopper typesjekken på begge sider. Inndatatypene nederst.

/** Kundesesjonen appen lagrer i iOS-nøkkelringen og sender som `Authorization: Bearer <token>`. */
export interface MobileSession {
  /** Opakt token (base64url). Bare hashen lagres på serveren. */
  token: string;
  tokenType: "Bearer";
  /** ISO 8601. Sesjonen kan også tilbakekalles før dette. */
  expiresAt: string;
}

/** Kundeprofilen slik innloggingen og `me` returnerer den. */
export interface CustomerProfile {
  id: number;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  bonusKr: number;
  referralCode: string | null;
  avatarUrl: string | null;
  locale: string;
  currency: string;
  marketingConsent: boolean;
  /** false for kontoer opprettet med sosial innlogging. */
  hasPassword: boolean;
}

/** Svar fra mobileAuth.register / login / verifyLoginCode. */
export interface MobileAuthResult {
  session: MobileSession;
  profile: CustomerProfile;
}

/** Svar fra mobileAuth.exchangeSocialToken. */
export interface MobileSocialAuthResult extends MobileAuthResult {
  created: boolean;
  linked: boolean;
}

/** Sosiale innlogginger appen kan vise. Andre Clerk-leverandører (facebook, x) finnes bare på nett. */
export type MobileSocialProvider = "google" | "apple";

/**
 * Hvorfor en leverandør ikke kan brukes i appen:
 * - `not_configured`: HelloSky har ikke leverandøren i Clerk (CLERK_SOCIAL_PROVIDERS).
 * - `native_not_ready`: den finnes på nett, men appens native flyt er ikke
 *   bekreftet klar (Clerk Native API + tillatt retur-URL, testet på en iPhone).
 */
export type MobileSocialUnavailableReason = "not_configured" | "native_not_ready";

/** Svar fra mobileAuth.providers: hvilke innloggingsmåter appen faktisk kan vise. */
export interface MobileAuthProviders {
  /** E-post/passord er alltid mulig. */
  password: true;
  social: { provider: MobileSocialProvider; available: boolean; reason: MobileSocialUnavailableReason | null }[];
  /** Clerks publiserbare nøkkel (offentlig av natur) – bare når minst én leverandør er tilgjengelig. */
  clerkPublishableKey: string | null;
}

// ─── Inndata appen sender (mobileAuth på /api/mobile/trpc) ──────────────────
// Serverens zod-skjemaer (api/mobileAuth.ts, api/customerAuth.ts) godtar disse
// formene; api/test/mobileAccount.it.ts typesjekker at de fortsatt passer.

/**
 * Språkene appen viser. Serveren godtar samme liste som nettet
 * (nb, en, sv, da, de); appen sender bare en av disse to.
 */
export type MobileLocale = "en" | "nb";

/** mobileAuth.register. `locale` lagres på kontoen (customer_accounts.locale) og styrer e-postene. */
export interface MobileRegisterInput {
  /** E-post eller telefonnummer med landskode. */
  identifier: string;
  password: string;
  firstName: string;
  lastName: string;
  referralCode?: string;
  locale?: MobileLocale;
  marketingConsent?: boolean;
}

/**
 * mobileAuth.requestPasswordReset (uten token). Svaret er alltid
 * `{ ok: true }` – det sier ingenting om kontoen finnes, og svartiden er den
 * samme (ca. 0,2–0,3 s) uansett. Lenken sendes på e-post (bare når
 * identifikatoren er en e-postadresse, som på nettet) til adressen som er
 * lagret på kontoen, og åpner nettets side for nytt passord. `locale` velger
 * språket i e-posten. E-postadresser må være ren ASCII (som på nettet); ellers
 * VALIDATION (field: identifier).
 */
export interface MobilePasswordResetRequestInput {
  identifier: string;
  locale?: MobileLocale;
}

/**
 * mobileAuth.updateProfile (Bearer). Samme regler som nettets profilside:
 * navn er påkrevd (bokstaver, mellomrom, bindestrek, apostrof; maks 60).
 * `phone` utelatt eller lik dagens nummer = uendret, "" = fjern (bare når
 * kontoen har e-post). Et ANNET nummer lagres ikke her: det gir VALIDATION med
 * `details.field: "phone"` og `details.reason: "phone_verification_required"`
 * – bruk requestPhoneChange + confirmPhoneChange. Svaret er CustomerProfile,
 * samme form som `me`. Feil: VALIDATION med `details.field`
 * (firstName | lastName | phone | locale).
 */
export interface MobileUpdateProfileInput {
  firstName: string;
  lastName: string;
  phone?: string;
  locale?: MobileLocale;
}

/**
 * mobileAuth.requestPhoneChange (Bearer), steg 1 av 2 for nytt
 * telefonnummer (nummeret er en innloggingsvei med SMS-kode).
 * Konto med passord (`hasPassword: true`): send `password`; feil eller
 * manglende passord gir UNAUTHORIZED med `details.field: "password"` (IKKE et
 * tegn på at tokenet er dødt – behold det). Konto uten passord: innloggingen må
 * være under 10 minutter gammel, ellers FORBIDDEN med
 * `details.reason: "reauth_required"` – kjør Sign in with Apple/Google på nytt
 * (exchangeSocialToken), bytt til det nye tokenet og prøv igjen.
 * Svaret er alltid `{ ok: true }` («vi har sendt en kode»), også når nummeret
 * tilhører en annen konto (da kommer det ingen kode). Koden er 6 siffer og
 * gyldig i 10 minutter. Ugyldig nummer eller dagens nummer: VALIDATION
 * (field: phone). RATE_LIMITED ved mange forsøk.
 */
export interface MobileRequestPhoneChangeInput {
  phone: string;
  password?: string;
}

/**
 * mobileAuth.confirmPhoneChange (Bearer), steg 2: samme `phone` som i steg 1
 * og koden fra SMS-en. Svaret er CustomerProfile med det nye nummeret. Feil
 * eller utløpt kode: VALIDATION med `details.field: "code"` (maks 5 forsøk per
 * 10 min). Etter endringen er alle ANDRE sesjoner (nett og andre enheter)
 * logget ut; dette tokenet virker fortsatt. Kontoen får en e-post om endringen.
 */
export interface MobileConfirmPhoneChangeInput {
  phone: string;
  code: string;
}

/**
 * mobileAuth.deleteAccount (Bearer). Konto med passord (`hasPassword: true`):
 * send `password` – feil passord gir UNAUTHORIZED med
 * `details.field: "password"` og endrer ingenting (tokenet lever; et dødt
 * token gir UNAUTHORIZED uten `details.field`).
 * Konto uten passord (Apple/Google): send `confirmation: "DELETE"` (eller
 * "SLETT"), ellers VALIDATION (field: confirmation); og innloggingen må være
 * under 10 minutter gammel, ellers FORBIDDEN med
 * `details.reason: "reauth_required"` – kjør Sign in with Apple/Google på nytt
 * (exchangeSocialToken) og slett med det nye tokenet. Etter `{ ok: true }` er
 * tokenet (og alle nett-sesjoner) ugyldig – slett det fra nøkkelringen. Et
 * dobbelttrykk gir `{ ok: true }` begge ganger.
 */
export interface MobileDeleteAccountInput {
  password?: string;
  confirmation?: "DELETE" | "SLETT";
}

export interface MobileOkResult {
  ok: true;
}
