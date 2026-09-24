# Google/Apple sign-in in the iPhone app: status and handoff

**Status: live sign-in BLOCKED.** The app never shows Google or Apple today.

## What exists (code, tested with fixtures)

**Server:**
- `mobileAuth.providers` (public, customer-only; `api/lib/mobileSocial.ts`). It returns `password: true`, each provider's `available` and `reason` (`not_configured` | `native_not_ready`), and Clerk's *publishable* key only when a provider is available. It never returns the secret key.
- A provider is available only when:
  - it is in `CLERK_SOCIAL_PROVIDERS` (and Clerk is configured), AND
  - it is in the new `MOBILE_CLERK_NATIVE_PROVIDERS`. That variable is unset by default and has no effect on the website.
- The exchange itself is the existing `mobileAuth.exchangeSocialToken`, unchanged. It verifies the Clerk token server-side, refuses staff addresses and email lookalikes, and issues a normal HelloSky customer session.

**App:**
- Profile shows a provider button only when all three hold: the server says the provider is available, a publishable key was returned, and the build's native adapter supports it (`src/lib/socialAuth.ts`).
- The adapter in this build (`src/lib/nativeSocial.ts`) supports nothing.
- On success the flow runs: Clerk session token → `exchangeSocialToken` (no Bearer) → HelloSky session in SecureStore. The Clerk token is never stored.
- Cancellation, loading, and errors (staff, lookalike, other) are handled in Bokmål and English.
- Guest flight search makes no auth calls. Email/password is unchanged.

## Why it is blocked

Clerk's Expo SDK needs two settings in the Clerk Dashboard (Native applications page). Both are security settings, and neither has been changed:

1. **Native API** must be enabled. Clerk notes this opens a public request path that bypasses browser CAPTCHA.
2. **Allowlist for mobile SSO redirect** must contain the app's redirect URL. Clerk's default is `{bundleIdentifier}://callback`.

Sign in with Apple also needs Apple configured as a Clerk social provider. Production advertises only Google today, and staging has no Clerk at all.

## Steps once an owner approves (in order)

1. In Clerk (staging instance first):
   - enable Native API;
   - allowlist the app's redirect URL;
   - for Apple, configure Sign in with Apple in Clerk and in the Apple Developer account.
2. Add Clerk's Expo SDK in a separate change, with a version checked against Expo SDK 57. Replace `src/lib/nativeSocial.ts` with an adapter that:
   - uses `useSSO` for Google (browser-based);
   - uses Clerk's Apple flow for Apple;
   - returns `{ kind: "token", token: await getToken() }`, or `{ kind: "cancelled" }` when the user dismisses.
3. Make a development build (EAS). The flow cannot run in Expo Go or in a browser preview.
4. Test on a real iPhone against staging: a new account, a known account, cancel, a staff address (must be refused), and a lookalike address (must be refused).
5. Only then set `MOBILE_CLERK_NATIVE_PROVIDERS=google` (and later `apple`) on that environment. The buttons appear only after this.

Until step 5, Profile shows no Google or Apple buttons in any environment.
