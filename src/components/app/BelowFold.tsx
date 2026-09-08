import { useEffect, useState, type ReactNode } from "react";

/**
 * Innhold under første skjerm, gjengitt etter at siden har tegnet.
 *
 * Forsiden gjengav alt på én gang: helten, søket, rutene, journalen og
 * fire fotokort. Alt konkurrerte om hovedtråden mens brukeren ventet på det
 * eneste som var synlig. Det som ligger under folden gjengis nå ved første
 * ledige øyeblikk – i praksis noen millisekunder senere, og aldri synlig for
 * noen, men hovedtråden er fri når det første skjermbildet tegnes.
 *
 * Høyden er reservert med `minHeight`, så ingenting hopper (CLS).
 * Uten JavaScript vises innholdet aldri – det er samme forutsetning som
 * resten av appen, som er klientgjengitt.
 */
export default function BelowFold({ children, minHeight = 600 }: { children: ReactNode; minHeight?: number }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const w = window as typeof window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const h = w.requestIdleCallback(() => setReady(true), { timeout: 1200 });
      return () => w.cancelIdleCallback?.(h);
    }
    const t = window.setTimeout(() => setReady(true), 120);
    return () => window.clearTimeout(t);
  }, []);

  if (!ready) return <div style={{ minHeight }} aria-hidden="true" />;
  return <>{children}</>;
}
