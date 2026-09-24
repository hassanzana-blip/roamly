import { requireOptionalNativeModule } from "expo";
import Constants from "expo-constants";

/**
 * Kan DENNE builden kjøre Sign in with Apple? Begge må være sanne:
 *
 * 1. Apples native modul er faktisk lenket inn (ExpoAppleAuthentication). I dag
 *    er expo-apple-authentication utelatt fra iOS-autolinking i package.json:
 *    uten det legger Expo sin prebuild automatisk til rettigheten
 *    com.apple.developer.applesignin (pakkens egen plugin), og det skal eieren
 *    bestemme – ikke en avhengighet.
 * 2. Den innebygde app-konfigurasjonen har ios.usesAppleSignIn: true (app.json,
 *    eid av eieren).
 *
 * Ellers er Apple ikke støttet og knappen vises aldri – uansett hva serveren sier.
 */
export function appleBuildReady(
  deps: { nativeModuleLinked: () => boolean; usesAppleSignIn: () => boolean } = {
    nativeModuleLinked: () => requireOptionalNativeModule("ExpoAppleAuthentication") != null,
    usesAppleSignIn: () => (Constants.expoConfig?.ios as { usesAppleSignIn?: boolean } | undefined)?.usesAppleSignIn === true,
  },
): boolean {
  try {
    return deps.nativeModuleLinked() && deps.usesAppleSignIn();
  } catch {
    return false;
  }
}
