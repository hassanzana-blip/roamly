import { useState } from "react";
import { Link } from "react-router";
import { Check, X } from "lucide-react";
import Icon from "@/components/app/Icon";
import { SectionHeader } from "@/components/app/AppShell";
import { destinationById, imageSrcSet, searchHref, type DiscoverDestination } from "@/content/discover";
import { MOODS } from "@/content/explore";
import { loadRecentSearches } from "@/lib/recentSearches";
import { useRoutePrice } from "@/lib/useRoutePrice";
import { useTravelProfile } from "@/lib/useAccount";
import { useT, type I18nKey } from "@/lib/i18n";
import { trpc } from "@/providers/trpc";
import type { TasteDimension } from "@/content/travelProfile";
import { cn } from "@/lib/utils";

/**
 * «Utvalgt for deg»: regler, ikke magi. Favoritter fra reiseprofilen først,
 * så reisemål som passer smaken du har oppgitt, så steder du nylig søkte.
 * Prisen er ekte fra prissøket eller ingen. «Ikke for meg» fjerner kortet
 * og huskes på kontoen; det finnes ingen falsk «tilbud»-tekst.
 */

const TASTE_TO_MOOD: Partial<Record<TasteDimension, string>> = {
  beach: "sol", city: "helg", culture: "kultur", family: "familie", football: "fotball", romantic: "romantisk", food: "kultur", nightlife: "helg", luxury: "sol", calm: "sol",
};

type Pick = { d: DiscoverDestination; reason: I18nKey };

function Card({ p, onVerdict }: { p: Pick; onVerdict: (v: "interested" | "not_for_me") => void }) {
  const t = useT();
  const price = useRoutePrice("OSL", p.d.iata);
  const [state, setState] = useState<"idle" | "interested">("idle");
  return (
    <div className="group relative w-[240px] shrink-0 snap-start md:w-auto">
      <Link to={searchHref(p.d.iata)} className="press block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={`${t("home.foryou.search")} ${p.d.city}`}>
        <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-night">
          {p.d.image && <img src={p.d.image} srcSet={imageSrcSet(p.d.image)} sizes="(max-width: 768px) 240px, 300px" alt={p.d.imageAlt} loading="lazy" decoding="async" width={1024} height={768} className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />}
          <span className="absolute left-3 top-3 rounded-md bg-card/95 px-2 py-1 text-[11px] font-semibold text-foreground backdrop-blur-sm">{t(p.reason)}</span>
        </span>
        <span className="block px-1 pt-3">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[16px] font-semibold leading-tight">{p.d.city}</span>
            {price && <span className="shrink-0 text-[13px] font-semibold tabular">{price}</span>}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{p.d.country} · {p.d.tagline}</span>
        </span>
      </Link>
      <div className="mt-2 flex gap-2 px-1">
        <button type="button" onClick={() => { setState("interested"); onVerdict("interested"); }} className={cn("inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-semibold transition-colors", state === "interested" ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground/30")}>
          <Icon icon={Check} size={14} /> {state === "interested" ? t("home.foryou.noted") : t("home.foryou.interested")}
        </button>
        <button type="button" onClick={() => onVerdict("not_for_me")} aria-label={`${t("home.foryou.notforme")}: ${p.d.city}`} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
          <Icon icon={X} size={14} /> {t("home.foryou.notforme")}
        </button>
      </div>
    </div>
  );
}

export default function ForYou() {
  const t = useT();
  const { profile } = useTravelProfile();
  const feedback = trpc.account.dealFeedbackList.useQuery(undefined, { staleTime: 60_000, retry: false });
  const utils = trpc.useUtils();
  const give = trpc.account.dealFeedback.useMutation({ onSuccess: () => utils.account.dealFeedbackList.invalidate() });
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [recent] = useState(() => loadRecentSearches());
  if (!profile || !feedback.data) return null;

  const rejected = new Set(feedback.data.filter((f) => f.verdict === "not_for_me").map((f) => f.dealId));
  const picks: Pick[] = [];
  const seen = new Set<string>();
  const push = (id: string | undefined, reason: I18nKey) => {
    if (!id || seen.has(id)) return;
    const d = destinationById(id);
    if (!d || !d.image || rejected.has(`dest:${id}`) || hidden.has(id)) return;
    seen.add(id);
    picks.push({ d, reason });
  };
  for (const id of profile.favouriteDestinations) push(id, "home.foryou.fav");
  const tasteTop = Object.entries(profile.taste as Record<string, number>)
    .filter(([, v]) => typeof v === "number" && v >= 4)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k as TasteDimension);
  for (const dim of tasteTop) {
    const mood = MOODS.find((m) => m.id === TASTE_TO_MOOD[dim]);
    for (const id of mood?.ids ?? []) push(id, "home.foryou.taste");
  }
  for (const s of recent) {
    const d = [...MOODS.flatMap((m) => m.ids ?? [])].map(destinationById).find((x) => x?.iata === s.to);
    push(d?.id, "home.foryou.recent");
  }
  const list = picks.slice(0, 4);
  if (list.length < 2) return null;

  const verdict = (id: string, v: "interested" | "not_for_me") => {
    if (v === "not_for_me") setHidden((h) => new Set(h).add(id));
    give.mutate({ dealId: `dest:${id}`, verdict: v });
  };

  return (
    <section className="container-x mt-12">
      <SectionHeader title={t("home.foryou.title")} action={<Link to="/profil/reiseprofil" className="inline-flex min-h-9 items-center text-sm font-medium text-primary">{t("home.foryou.edit")}</Link>} />
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">{t("home.foryou.sub")}</p>
      <div className="no-scrollbar snap-row -mx-5 flex gap-4 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        {list.map((p) => <Card key={p.d.id} p={p} onVerdict={(v) => verdict(p.d.id, v)} />)}
      </div>
    </section>
  );
}
