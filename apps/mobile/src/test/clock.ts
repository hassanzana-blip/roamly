/**
 * Testenes klokke. Mange tester søker med faste reisedatoer (23.–30. oktober 2026); med den ekte klokken ville de
 * begynne å feile den dagen datoene passerer. Med `pinClock` står bare `Date` fast – setTimeout, løfter og
 * animasjoner går som vanlig – så testene gir samme svar uansett når de kjøres.
 */

/** Testenes «nå»: fredag 25. september 2026 kl. 12 lokal tid, før alle reisedatoene i testene. */
export const TEST_NOW = new Date(2026, 8, 25, 12, 0);

/** Alt Jest kan forfalske unntatt Date: med denne listen står bare klokken fast. */
const REAL_TIMERS = ["hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] as const;

/** Setter klokken til `at` (standard TEST_NOW). Brukes i beforeEach, med `jest.useRealTimers()` i afterEach. */
export function pinClock(at: Date = TEST_NOW): void {
  jest.useFakeTimers({ doNotFake: [...REAL_TIMERS] });
  jest.setSystemTime(at);
}
