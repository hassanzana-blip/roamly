import type { MobileSocialProvider } from "@contracts/mobileAuth";
import type { NativeSocialResult } from "./socialAuth";

/**
 * Bindeleddet mellom adapteret (lib/nativeSocial.ios.tsx) og Clerk-verten
 * (lib/clerkSocial.ios.tsx): verten registrerer en funksjon som kjører
 * Clerks flyt med sine hooks; adapteret venter på den. Ingen Clerk-import her.
 */
export type SsoRunner = (provider: MobileSocialProvider) => Promise<NativeSocialResult>;

let runner: SsoRunner | null = null;
let waiters: ((r: SsoRunner) => void)[] = [];

/** Kalles av verten når Clerk er klar. Returnerer avregistrering. */
export function registerSsoRunner(r: SsoRunner): () => void {
  runner = r;
  const pending = waiters;
  waiters = [];
  pending.forEach((w) => w(r));
  return () => {
    if (runner === r) runner = null;
  };
}

/** Venter på verten (Clerk lastes når Profil viser knappen); feiler etter `timeoutMs`. */
export function waitForSsoRunner(timeoutMs = 15_000): Promise<SsoRunner> {
  if (runner) return Promise.resolve(runner);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters = waiters.filter((w) => w !== done);
      reject(new Error("clerk_not_ready"));
    }, timeoutMs);
    const done = (r: SsoRunner) => {
      clearTimeout(timer);
      resolve(r);
    };
    waiters.push(done);
  });
}

/** Bare for tester. */
export function __resetSsoRunnerForTests() {
  runner = null;
  waiters = [];
}
