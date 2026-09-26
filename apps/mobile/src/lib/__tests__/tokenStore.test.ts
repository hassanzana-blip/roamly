import * as SecureStore from "expo-secure-store";
import { clearSession, loadSession, saveSession } from "../tokenStore";
import { AUTH_RESULT, TOKEN } from "../../test/fixtures";

const store = (SecureStore as unknown as { __store: Map<string, { value: string; options: { keychainAccessible?: number } }> }).__store;

describe("kundesesjonen i nøkkelringen", () => {
  beforeEach(() => store.clear());

  it("lagres i SecureStore med WHEN_UNLOCKED_THIS_DEVICE_ONLY, og bare token + utløp", async () => {
    await saveSession(AUTH_RESULT.session);
    const entry = store.get("hellosky.customer-session");
    expect(entry?.options).toEqual({ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    expect(JSON.parse(entry!.value)).toEqual({ token: TOKEN, expiresAt: AUTH_RESULT.session.expiresAt });
    expect(await loadSession()).toEqual({ token: TOKEN, expiresAt: AUTH_RESULT.session.expiresAt });
  });

  it("en utløpt eller ødelagt verdi slettes", async () => {
    await saveSession({ ...AUTH_RESULT.session, expiresAt: "2020-01-01T00:00:00Z" });
    expect(await loadSession()).toBeNull();
    expect(store.size).toBe(0);
    store.set("hellosky.customer-session", { value: "{ikke json", options: {} });
    expect(await loadSession()).toBeNull();
    expect(store.size).toBe(0);
  });

  it("clearSession sletter", async () => {
    await saveSession(AUTH_RESULT.session);
    await clearSession();
    expect(store.size).toBe(0);
  });

  it("appen har ingen AsyncStorage-avhengighet", () => {
    const pkg = require("../../../package.json") as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    const all = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(all.filter((d) => /async-storage/i.test(d))).toEqual([]);
  });
});
