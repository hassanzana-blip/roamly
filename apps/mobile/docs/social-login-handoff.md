# Google/Apple sign-in in the iPhone app: status and handoff

**Status (24 September 2026): code and Apple iOS entitlement configuration are in the app; live sign-in is NOT enabled or tested.** No environment shows a Google or Apple button today. Apple Developer's `no.hellosky.app` App ID now has Sign In with Apple ON. The Apple-linked iOS simulator build compiles, but no provider flow has run on a device.

## Known state (checked by the owner in the Clerk dashboard and Railway)

| | Development instance | Production instance |
|---|---|---|
| Native API | **ON** | **OFF** |
| iOS application registered | **yes**, `45867953Z4` / `no.hellosky.app` | no |
| Mobile SSO redirect allowlisted | Clerk automatically added `no.hellosky.app://callback`; required `hellosky://sso-callback` is **not** added | no |

- Railway staging: no Clerk configuration.
- Production website: advertises Clerk with Google, not Apple.

The Apple capability and Clerk Development iOS registration were completed after the source configuration, with the owner's specific approval. Apple Team ID `45867953Z4` and explicit bundle ID `no.hellosky.app` were verified in Apple Developer. Apple warned that enabling the capability can invalidate existing provisioning profiles. Railway staging and Clerk Production remain unchanged.

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
- **Apple: code and native source configuration are in the app, but its button remains hidden until the server advertises Apple.** It uses Clerk's `useSignInWithApple()` from `@clerk/expo/apple`, together with `expo-apple-authentication` ~57.0.2 (the SDK 57 pin).
  - The installed 4.6.9 hook (`hooks/useSignInWithApple.ios.js`) imports `expo-apple-authentication` and `expo-crypto`, shows Apple's own sheet with a nonce, and sends the identity token to Clerk (`strategy: "oauth_token_apple"`; sign-up first, falling back to sign-in or a transfer). It uses no Clerk native module, so it works with `@clerk/expo` excluded from autolinking. `expo-apple-authentication` itself targets iOS 16.4, the same as the app.
  - After Clerk creates a session the path is the same as Google's: `setActive` → `getToken()` → `exchangeSocialToken` (staff and lookalike protection on the server) → HelloSky session in SecureStore → `clerk.signOut()`.
  - Cancelling the Apple sheet counts as "cancelled". An incomplete Clerk sign-up (`missing_requirements`) is an error, and so is Clerk not being loaded yet (the hook would otherwise report that as "no session").
  - **Gate:** `supports("apple")` is true only when BOTH hold (`src/lib/appleSupport.ts`): Apple's native module `ExpoAppleAuthentication` is linked, and the embedded app config has `ios.usesAppleSignIn: true`. Source configuration now requests both; a signed native build and provider setup are still required. The public `mobileAuth.providers` contract is an additional server gate.
  - `app.json` explicitly sets `ios.usesAppleSignIn: true` and includes the `expo-apple-authentication` plugin. `package.json` autolinks that Apple module while still excluding `@clerk/expo`'s unused native module. Expo config introspection confirms `com.apple.developer.applesignin = ["Default"]`; autolinking resolution includes Apple and excludes ClerkExpo. The matching Apple Developer App ID capability is now ON. A signed device build may need refreshed provisioning profiles and has not been made.
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
  - Not verified here: `pod install` itself (no macOS/CocoaPods in this environment). **Owner's check:** EAS iOS simulator build `5783aec8` of `c487a47` FINISHED, and CI run 35975683156 succeeded.
- **Why this is safe for the flow.** Google sign-in uses Clerk's browser-based `useSSO` (JS, `expo-auth-session` + `expo-web-browser`). `@clerk/expo` loads its native module with `requireOptionalNativeModule`, which returns null when it is not linked. The native Clerk views are never rendered, and Clerk is only loaded when a provider is shown. Neither the iOS deployment target (16.4) nor any Clerk setting was changed.
- **Trade-off.** Clerk's native components, native Google sign-in, passkeys and native client sync stay unavailable. Using them would need the iOS target raised to 17.0 and the exclude removed; that is an owner decision.

## Remaining steps to go live (owner, in order)

1. **Development/staging first.** Give Railway staging the Clerk *development* keys (`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`) and `CLERK_SOCIAL_PROVIDERS=google`. Native API is already ON in development.
2. In the Clerk **development** instance (Native applications page), add **`hellosky://sso-callback`** to *Allowlist for mobile SSO redirect*. Clerk's automatically created `no.hellosky.app://callback` does not match the app's Google redirect. The iOS application registration is already complete.
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
7. **Apple** (source configuration, native simulator compile, Apple Developer capability and Clerk Development iOS registration completed; real tests pending):
   1. Verify the entitlement and native linkage in a **signed device build**. The compile-only EAS simulator build `e6a883fd-fa96-4269-bb6e-80ffdfd63657` of `145bb83` succeeded with `EXPO_NO_CAPABILITY_SYNC=1`; it does not establish signing or runtime behavior.
   2. Apple Developer's **Sign in with Apple** capability on App ID `no.hellosky.app` is ON. Refresh provisioning profiles if signing requires it.
   3. Clerk Development iOS native app is registered. Verify its existing Apple social connection supports native sign-up and sign-in before exposing the button. Follow [Clerk's current native Apple guide](https://clerk.com/docs/expo/guides/configure/auth-strategies/sign-in-with-apple).
   4. Server: add `apple` to `CLERK_SOCIAL_PROVIDERS` and to `MOBILE_CLERK_NATIVE_PROVIDERS` on that environment. The Apple button appears only after this and a signed build with the capability.
   5. Test on a **physical iPhone** signed into an Apple ID:
      - a new customer, including "Hide My Email";
      - an existing customer;
      - cancel;
      - a staff address (must be refused);
      - a lookalike address (must be refused).

      The simulator can show the sheet, but it is not a substitute for a device test.
   6. Only after development/device validation, register the iOS app and configure Apple sign-in separately in Clerk Production, then enable the production server gate and verify it end to end. Development registration does not configure Production.

Until step 4, no environment shows a Google button. Until the remaining Clerk/server configuration, a signed build, and real flow tests are verified, no environment shows an Apple button.

## What is tested where

| | Google | Apple |
|---|---|---|
| Code in the app | yes | yes |
| Jest with Clerk mocked (gating, token → exchange → SecureStore, cancel, incomplete, refused exchange, duplicate taps) | yes (`clerkSocial.test.tsx`, `socialAuth.test.tsx`) | yes (`appleSignIn.test.tsx`) |
| In the iOS bundle (`expo export`) | yes (`oauth_google`) | yes (`oauth_token_apple`) |
| Native build compiles | EAS simulator build of `145bb83` finished | EAS simulator build of `145bb83` finished with the Apple module linked |
| Real Clerk / real provider | **NO** | **NO** |
| Physical iPhone | **NO** | **NO** |
