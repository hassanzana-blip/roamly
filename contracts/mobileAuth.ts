// ─── Appens kundeinnlogging (mobileAuth på /api/mobile/trpc) ────────────────
// Typene serveren svarer med og appen leser. Serveren (api/mobileAuth.ts og
// publicProfile i api/customerAuth.ts) er annotert med dem, så et avvik i
// formen stopper typesjekken på begge sider.

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
