import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Clock3, X } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import DestinationCard from "@/components/travel/DestinationCard";
import DestinationSheet from "@/components/app/DestinationSheet";
import { EmptyState } from "@/components/app/primitives";
import { Segmented } from "@/components/ui/segmented";
import { NoSavedSpot } from "@/components/graphics";
import Icon from "@/components/app/Icon";
import { useSavedDestinations } from "@/lib/useAccount";
import { useCustomer } from "@/lib/useCustomer";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { loadRecentSearches, recentSearchHref, type RecentSearch } from "@/lib/recentSearches";
import { destinationById, type DiscoverDestination } from "@/content/discover";
import { formatDateShort } from "@/lib/format";
import { trpc } from "@/providers/trpc";

/**
 * Lagret — reisemål og søk. Innloggede har alt på kontoen (og får det med
 * seg mellom enheter); gjester har det i nettleseren.
 */
export default function Saved() {
  usePageMeta(PAGE_META.saved);
  const t = useT();
  const { customer } = useCustomer();
  const { ids, toggle, isServer } = useSavedDestinations();
  const [tab, setTab] = useState<"destinations" | "searches">("destinations");
  const [quickView, setQuickView] = useState<DiscoverDestination | null>(null);
  const [local] = useState<RecentSearch[]>(() => loadRecentSearches());
  const utils = trpc.useUtils();
  const history = trpc.account.searchHistory.useQuery(undefined, { enabled: Boolean(customer), retry: false });
  const removeSearch = trpc.account.removeSearch.useMutation({ onSuccess: () => utils.account.searchHistory.invalidate() });
  const clear = trpc.account.clearSearchHistory.useMutation({ onSuccess: () => utils.account.searchHistory.invalidate() });

  const saved = [...ids].map((id) => destinationById(id)).filter((d): d is NonNullable<typeof d> => Boolean(d));

  const searches = customer
    ? (history.data ?? []).map((s) => ({
        key: String(s.id),
        id: s.id as number | null,
        label: `${s.originCity} → ${s.destinationCity}`,
        sub: `${formatDateShort(s.departDate)}${s.returnDate ? ` – ${formatDateShort(s.returnDate)}` : ""} · ${t("common.pax", { count: s.adults + s.children + s.infants })}`,
        href: `/sok?${new URLSearchParams({ from: s.originIata, to: s.destinationIata, depart: s.departDate, ...(s.returnDate ? { ret: s.returnDate } : {}), adults: String(s.adults), children: String(s.children), infants: String(s.infants), cabin: s.cabin }).toString()}`,
      }))
    : local.map((s) => ({
        key: `${s.from}-${s.to}-${s.depart}-${s.ret ?? "ow"}`,
        id: null as number | null,
        label: `${s.fromLabel} → ${s.toLabel}`,
        sub: `${formatDateShort(s.depart)}${s.ret ? ` – ${formatDateShort(s.ret)}` : ""} · ${t("common.pax", { count: s.adults + s.children + s.infants })}`,
        href: recentSearchHref(s),
      }));

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <AppHeader title={t("saved.title")} as="h1" />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Segmented aria-label={t("saved.title")} value={tab} onValueChange={(v) => setTab(v as "destinations" | "searches")} options={[{ value: "destinations", label: t("sv.tab.destinations") }, { value: "searches", label: t("sv.tab.searches") }]} className="w-auto" />
          <span className="text-[12px] text-muted-foreground">{isServer ? t("sv.synced") : t("sv.local")}</span>
        </div>

        {tab === "destinations" &&
          (saved.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
              {saved.map((d) => (
                <DestinationCard key={d.id} destination={d} isFavourite onToggleFavourite={toggle} onOpen={setQuickView} fluid />
              ))}
            </div>
          ) : (
            <EmptyState
              illustration={<NoSavedSpot />}
              title={t("saved.empty")}
              body="Trykk på hjertet på et reisemål, så samler vi det her til neste gang."
              action={<Link to="/utforsk" className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-night px-5 text-[14px] font-semibold text-white">Utforsk reisemål <Icon icon={ArrowRight} size={16} /></Link>}
            />
          ))}

        {tab === "searches" &&
          (searches.length ? (
            <>
              <ul className="flex flex-col gap-2">
                {searches.map((s) => (
                  <li key={s.key} className="flex items-center gap-2">
                    <Link to={s.href} className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 rounded-lg border border-border bg-card px-4 transition-colors hover:border-foreground/20">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"><Icon icon={Clock3} size={20} className="text-muted-foreground" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{s.label}</span>
                        <span className="block text-[12px] text-muted-foreground">{s.sub}</span>
                      </span>
                      <span className="shrink-0 text-[12px] font-semibold text-muted-foreground">{t("sv.searchagain")}</span>
                    </Link>
                    {s.id !== null && (
                      <button type="button" onClick={() => removeSearch.mutate({ id: s.id as number })} aria-label={t("sv.remove")} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><Icon icon={X} size={16} /></button>
                    )}
                  </li>
                ))}
              </ul>
              {customer && searches.length > 0 && (
                <button type="button" onClick={() => clear.mutate()} disabled={clear.isPending} className="mt-4 min-h-11 text-[13px] font-semibold text-muted-foreground hover:text-foreground">{t("sv.clear")}</button>
              )}
            </>
          ) : (
            <EmptyState icon={Clock3} title={t("sv.searchesempty")} action={<Link to="/" className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-night px-5 text-[14px] font-semibold text-white">{t("tr.search")} <Icon icon={ArrowRight} size={16} /></Link>} />
          ))}
      </AppShell>
      <DestinationSheet destination={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}
