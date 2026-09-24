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

**Clerk's native iOS module is excluded from iOS autolinking** (`apps/mobile/package.json` → `expo.autolinking.ios.exclude: ["@clerk/expo"]`).

- **Observed failure.** The owner's EAS iOS simulator build of `eac3e73` (build `9ad8c800-1d51-44ff-9d37-bf61e6f7b645`) failed in *Install pods*:
  - Expo logged "@clerk/expo was not linked: requires iOS 17.0 but app targets 16.4";
  - but `ClerkExpo.podspec` calls `spm_dependency(… products: ['ClerkKit', 'ClerkKitUI'])` while it is evaluated, so React Native's SPM step still added those products;
  - it then crashed in `react-native/scripts/cocoapods/spm.rb:98` (`undefined method package_product_dependencies for nil:NilClass`).
  
  My earlier claim that Expo skipping the pod was safe was wrong.
- **Correction.** Expo's autolinking in SDK 57 (`expo-modules-autolinking` 57.0.13) reads `expo.autolinking.<platform>.exclude` from the app's `package.json`. The iOS/`apple` platform falls back to the `ios` key. The exclude list is applied to both Expo modules and React Native community modules, so the Clerk podspec is never read and no SPM product is added.
  - Verified with the SDK's own CLI: before the change, `npx expo-modules-autolinking resolve --platform apple` listed `@clerk/expo` (pod `ClerkExpo`); after it, it does not.
  - Also after the change: `react-native-config --platform ios` has no Clerk entry, and every other module (maps, web-browser, crypto, secure-store …) is still linked.
  - Not verified here: `pod install` itself (no macOS/CocoaPods in this environment). The owner's next EAS build is the check.
- **Why this is safe for the flow.** Google sign-in uses Clerk's browser-based `useSSO` (JS, `expo-auth-session` + `expo-web-browser`). `@clerk/expo` loads its native module with `requireOptionalNativeModule`, which returns null when it is not linked. The native Clerk views are never rendered, and Clerk is only loaded when a provider is shown. Neither the iOS deployment target (16.4) nor any Clerk setting was changed.
- **Trade-off.** Clerk's native components, native Google sign-in, passkeys and native client sync stay unavailable. Using them would need the iOS target raised to 17.0 and the exclude removed; that is an owner decision.

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
