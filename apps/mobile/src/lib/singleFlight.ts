/**
 * Kjører `fn` bare én gang om gangen: kall mens den første fortsatt pågår,
 * ignoreres (gir undefined). Brukes der ett bevisst trykk skal gi nøyaktig én
 * handling – f.eks. én klikkmåling og én nettleser ved raske dobbelttrykk.
 * Argumentene sendes med hvert kall, så ingenting fanges foreldet.
 */
export function singleFlight<A extends unknown[], T>(fn: (...args: A) => Promise<T>): (...args: A) => Promise<T | undefined> {
  let running = false;
  return async (...args: A) => {
    if (running) return undefined;
    running = true;
    try {
      return await fn(...args);
    } finally {
      running = false;
    }
  };
}
