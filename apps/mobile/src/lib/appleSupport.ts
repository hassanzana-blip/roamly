import { requireOptionalNativeModule } from "expo";
import Constants from "expo-constants";

/**
 * Kan DENNE builden kjøre Sign in with Apple? Begge må være sanne:
 *
 * 1. Apples native modul er faktisk lenket inn (ExpoAppleAuthentication).
 * 2. Den innebygde app-konfigurasjonen har ios.usesAppleSignIn: true (app.json, eid av eieren).
 *
 * Per 26.09.2026 er begge satt av eieren (app.json har usesAppleSignIn, og modulen er ikke lenger utelatt fra
 * autolinking), så en ny iPhone-build støtter Apple. Knappen vises likevel bare når serveren sier at Apple er satt
 * opp (Clerk). I tester og i nettleseren finnes ikke modulen, og da er Apple ikke støttet.
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
