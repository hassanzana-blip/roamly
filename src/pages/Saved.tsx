import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Clock3, Heart } from "lucide-react";
import AppShell, { SectionHeader } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import DestinationCard from "@/components/travel/DestinationCard";
import DestinationSheet from "@/components/app/DestinationSheet";
import { EmptyState } from "@/components/app/primitives";
import Icon from "@/components/app/Icon";
import { useFavourites } from "@/lib/favourites";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { loadRecentSearches, recentSearchHref, type RecentSearch } from "@/lib/recentSearches";
import { destinationById, type DiscoverDestination } from "@/content/discover";

/**
 * Lagret — saved destinations (favourites) and recent searches.
 * All state lives in the browser (localStorage) — no account needed.
 */
export default function Saved() {
  usePageMeta(PAGE_META.saved);
  const [favs, toggleFav] = useFavourites();
  const [quickView, setQuickView] = useState<DiscoverDestination | null>(null);
  const [recent] = useState<RecentSearch[]>(() => loadRecentSearches());
  const t = useT();


  const saved = [...favs]
    .map((id) => destinationById(id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <AppHeader title={t("saved.title")} />

        {saved.length ? (
          <section>
            <SectionHeader title="Reisemål" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
              {saved.map((d) => (
                <DestinationCard
                  key={d.id}
                  destination={d}
                  isFavourite
                  onToggleFavourite={toggleFav}
                  onOpen={setQuickView}
                  fluid
                />
              ))}
            </div>
          </section>
        ) : (
          <EmptyState
            icon={Heart}
            title={t("saved.empty")}
            body="Trykk på hjertet på et reisemål, så samler vi det her til neste gang."
            action={
              <Link
                to="/utforsk"
                className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-night px-5 text-[14px] font-semibold text-white"
              >
                Utforsk reisemål <Icon icon={ArrowRight} size={16} />
              </Link>
            }
          />
        )}

        {recent.length > 0 && (
          <section className="mt-10">
            <SectionHeader title={t("saved.recent")} />
            <ul className="flex flex-col gap-2">
              {recent.map((s) => (
                <li key={`${s.from}-${s.to}-${s.depart}-${s.ret ?? "ow"}`}>
                  <Link
                    to={recentSearchHref(s)}
                    className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-border bg-white px-4 transition-colors hover:border-foreground/20"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon icon={Clock3} size={20} className="text-muted-foreground" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">
                        {s.fromLabel} → {s.toLabel}
                      </span>
                      <span className="block text-[12px] text-muted-foreground">
                        {s.depart}
                        {s.ret ? ` – ${s.ret}` : ""} · {s.adults + s.children + s.infants} reisende
                      </span>
                    </span>
                    <Icon icon={ArrowRight} size={20} className="shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </AppShell>
      <DestinationSheet destination={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}
