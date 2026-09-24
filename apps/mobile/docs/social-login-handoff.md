# Google/Apple sign-in in the iPhone app: status and handoff

**Status: code in the app; live sign-in NOT enabled and NOT tested.** No environment shows a Google or Apple button today.

## Known state (checked by the owner in the Clerk dashboard and Railway)

| | Development instance | Production instance |
|---|---|---|
| Native API | **ON** | **OFF** |
| iOS application registered | no | no |
| Mobile SSO redirect allowlisted | no | no |

- Railway staging: no Clerk configuration.
- Production website: advertises Clerk with Google, not Apple.

This change touched none of these settings.

## What the app does now (code; tested with mocks, not with Clerk)

**Server:** `mobileAuth.providers` (public, customer-only) marks Google or Apple available only when both hold:
- the provider is in `CLERK_SOCIAL_PROVIDERS` and Clerk is configured;
- the provider is listed in `MOBILE_CLERK_NATIVE_PROVIDERS`, which is unset everywhere.

It returns the publishable key only in that case, and never the secret key.

**iPhone** (`src/lib/nativeSocial.ios.tsx`, `src/lib/clerkSocial.ios.tsx`):
- **Google.** Uses `@clerk/expo` 4.6.9 `useSSO`, `strategy: "oauth_google"`, in ASWebAuthenticationSession via `expo-auth-session` / `expo-web-browser`.
  - Redirect URI: exactly **`hellosky://sso-callback`**. It comes from the app's `scheme` (`hellosky`) and is the value to add to Clerk's *Allowlist for mobile SSO redirect*.
  - After Clerk creates a session: `setActive` → `session.getToken()` → `mobileAuth.exchangeSocialToken` → HelloSky session in SecureStore → `clerk.signOut()`. The sign-out also runs when the exchange is refused.
  - `ClerkProvider` gets no `tokenCache`, so Clerk's client token is only ever held in memory and never persisted.
  - Clerk is loaded (and contacted) only when a provider is shown. Guest search never loads Clerk.
- **Apple: not supported in this build, so its button is hidden.** Clerk's iOS Apple flow uses native Sign in with Apple (`expo-apple-authentication`). That needs:
  - the Sign in with Apple entitlement in `app.json` (`ios.usesAppleSignIn`), which is owner-managed config and was not changed;
  - the capability on the App ID in Apple Developer;
  - Apple configured as a provider in Clerk.
- **Everywhere else** (browser preview, Android): `src/lib/nativeSocial.tsx`, no social sign-in, and Clerk is not loaded.

**Clerk's native iOS module is not linked.** `@clerk/expo` 4.6.9 ships a native pod (`ClerkExpo`) that requires iOS 17.0, while Expo SDK 57 targets iOS 16.4. Expo's autolinking skips that pod ("was not linked: requires iOS 17.0 but app targets 16.4"), and `@clerk/expo` loads it with `requireOptionalNativeModule`. The browser-based `useSSO` flow does not use it. Raising the deployment target is owner-managed config and was not done.

## Steps to go live (owner, in order; none of this was done)

1. **Development/staging first.** Give Railway staging the Clerk *development* keys (`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`) and `CLERK_SOCIAL_PROVIDERS=google`. Native API is already ON in development.
2. In the Clerk **development** instance (Native applications page), add **`hellosky://sso-callback`** to *Allowlist for mobile SSO redirect*.
   - Registering the iOS application (App ID prefix + bundle ID `no.hellosky.app`) is described by Clerk for native components and passkeys. This flow uses neither, but register it if Clerk requires it for this instance.
3. Make an EAS development build (the flow cannot run in Expo Go or a browser).
4. On staging, set `MOBILE_CLERK_NATIVE_PROVIDERS=google`. The Google button appears only now, and only on staging.
5. Test on a physical iPhone:
   - a new customer;
   - an existing customer (same verified e-mail);
   - cancel in the Google sheet;
   - a staff address (must be refused);
   - a lookalike address (must be refused);
   - sign out.
6. **Production** only after that:
   - turn on Native API (currently OFF);
   - allowlist `hellosky://sso-callback`;
   - set `MOBILE_CLERK_NATIVE_PROVIDERS=google`.
7. **Apple** is a separate change:
   - Sign in with Apple in Apple Developer, Clerk and `app.json`;
   - add `expo-apple-authentication`;
   - add Apple support to the iOS adapter;
   - its own device test.

Until step 4, no environment shows a Google button. Until step 7, no environment shows an Apple button.
