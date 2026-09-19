import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import type { ResolvedMeta } from "@/lib/seo";
import { HelmetContext, type HelmetRegistry } from "./helmetContext";

/**
 * Sidemetadata via react-helmet-async. `usePageMeta` (src/lib/seo.ts) legger
 * inn ferdig oppløst metadata her; <PageMetaRenderer> skriver den til <head>.
 */

function PageMetaRenderer({ meta }: { meta: ResolvedMeta | null }) {
  if (!meta) return null;
  return (
    <Helmet prioritizeSeoTags>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <meta name="robots" content={meta.robots} />
      <link rel="canonical" href={meta.canonical} />
      <meta property="og:type" content={meta.type} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={meta.canonical} />
      <meta property="og:image" content={meta.image} />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={meta.image} />
      {meta.jsonLd.map((ld, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(ld)}
        </script>
      ))}
    </Helmet>
  );
}

/**
 * Fjern metadataene serveren la inn (api/lib/seoHead.ts, merket data-hs-seo).
 *
 * react-helmet-async eier bare tagger den selv har laget; alt annet i <head>
 * lar den stå. Uten denne oppryddingen står serverens canonical og klientens
 * side om side etter hydrering, og en side med to canonical-er er like
 * uindekserbar som en med feil canonical.
 *
 * Kjøres først når klienten faktisk HAR metadata å sette. En side uten
 * usePageMeta beholder serverens tagger, som er riktige for den stien.
 */
function useDropServerMeta(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    for (const el of document.head.querySelectorAll("[data-hs-seo]")) el.remove();
  }, [active]);
}

type Entry = { meta: ResolvedMeta; priority: number; seq: number };

export function PageMetaProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Map<number, Entry>>(() => new Map());
  const registry = useMemo<HelmetRegistry>(() => {
    let seq = 0;
    return {
      register: (id, meta, priority) =>
        setEntries((prev) => {
          const next = new Map(prev);
          next.set(id, { meta, priority, seq: ++seq });
          return next;
        }),
      unregister: (id) =>
        setEntries((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Map(prev);
          next.delete(id);
          return next;
        }),
    };
  }, []);
  // Høyest prioritet vinner; ved lik prioritet den sist registrerte.
  const meta = useMemo(() => {
    let best: Entry | null = null;
    for (const e of entries.values()) {
      if (!best || e.priority > best.priority || (e.priority === best.priority && e.seq > best.seq)) best = e;
    }
    return best?.meta ?? null;
  }, [entries]);
  useDropServerMeta(meta !== null);
  return (
    <HelmetProvider>
      <HelmetContext.Provider value={registry}>
        <PageMetaRenderer meta={meta} />
        {children}
      </HelmetContext.Provider>
    </HelmetProvider>
  );
}
