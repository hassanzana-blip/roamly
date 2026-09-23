import * as SecureStore from "expo-secure-store";
import type { MobileSession } from "@contracts/mobileAuth";

/**
 * Kundens sesjon i iOS-nøkkelringen (expo-secure-store).
 *
 * WHEN_UNLOCKED_THIS_DEVICE_ONLY: lesbar bare når telefonen er låst opp, og
 * blir aldri med i sikkerhetskopier eller over til en annen enhet. Tokenet
 * lagres ingen andre steder – ikke i AsyncStorage, ikke i filer, ikke i logg.
 */

const KEY = "hellosky.customer-session";
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export type StoredSession = { token: string; expiresAt: string };

export async function saveSession(session: MobileSession): Promise<void> {
  const value: StoredSession = { token: session.token, expiresAt: session.expiresAt };
  await SecureStore.setItemAsync(KEY, JSON.stringify(value), OPTIONS);
}

/** Lagret sesjon, eller null. En utløpt eller ødelagt verdi slettes. */
export async function loadSession(now: Date = new Date()): Promise<StoredSession | null> {
  let raw: string | null = null;
  try {
    raw = await SecureStore.getItemAsync(KEY, OPTIONS);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    const expires = Date.parse(parsed.expiresAt ?? "");
    if (typeof parsed.token === "string" && parsed.token && Number.isFinite(expires) && expires > now.getTime()) {
      return { token: parsed.token, expiresAt: parsed.expiresAt! };
    }
  } catch {
    // ødelagt verdi – slettes under
  }
  await clearSession();
  return null;
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY, OPTIONS);
  } catch {
    // Ingenting å slette.
  }
}
