import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import DestinationCard from "@/components/travel/DestinationCard";
import DestinationSheet from "@/components/app/DestinationSheet";
import { EmptyState } from "@/components/app/primitives";
import { useFavourites } from "@/lib/favourites";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import {
  ALL_DESTINATIONS,
  destinationById,
  type DiscoverDestination,
} from "@/content/discover";
import { Compass } from "lucide-react";

/**
 * Utforsk — destinations and inspiration. Category pills filter the full
 * curated catalogue (football, romantic, family, weekend, sun, culture).
 */

const CATEGORIES: { id: string; label: string; ids?: string[] }[] = [
  { id: "alle", label: "Alle" },
  { id: "fotball", label: "Fotball", ids: ["london", "barcelona", "istanbul", "dubai"] },
  { id: "romantisk", label: "Romantisk", ids: ["paris", "rome", "lisboa", "beirut"] },
  { id: "familie", label: "Familie", ids: ["istanbul", "erbil", "sulaymaniyah", "beirut", "marrakech", "colombo"] },
  { id: "helg", label: "Helgtur", ids: ["london", "paris", "warszawa", "lisboa", "barcelona"] },
  { id: "sol", label: "Sol og varme", ids: ["dubai", "malaga", "marrakech", "bangkok", "colombo", "jeddah"] },
  { id: "kultur", label: "Kultur", ids: ["istanbul", "erbil", "sulaymaniyah", "rome", "athens", "delhi", "beirut"] },
];

export default function Explore() {
  usePageMeta(PAGE_META.explore);
  const [cat, setCat] = useState("alle");
  const [quickView, setQuickView] = useState<DiscoverDestination | null>(null);
  const [favs, toggleFav] = useFavourites();
  const t = useT();

  const list: DiscoverDestination[] = useMemo(() => {
    const c = CATEGORIES.find((x) => x.id === cat);
    if (!c?.ids) return ALL_DESTINATIONS;
    return c.ids.map((id) => destinationById(id)).filter((d): d is DiscoverDestination => Boolean(d));
  }, [cat]);

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <AppHeader title={t("explore.title")} />

        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              aria-pressed={cat === c.id}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-4 text-[14px] font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ring",
                cat === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-white text-muted-foreground hover:text-foreground",
              )}
            >
              {c.id === "alle" ? t("explore.all") : c.label}
            </button>
          ))}
        </div>

        {list.length ? (
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((d) => (
              <DestinationCard
                key={d.id}
                destination={d}
                isFavourite={favs.has(d.id)}
                onToggleFavourite={toggleFav}
                onOpen={setQuickView}
                fluid
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Compass}
            title="Ingenting her ennå"
            body="Vi fyller på med flere reisemål fortløpende."
          />
        )}

        <p className="mt-8 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Sparkles size={14} className="shrink-0" />
          Usikker på hvor du vil dra? Ta reisequizen på profilsiden — den foreslår reisemål ut fra hva du liker.
        </p>
      </AppShell>
      <DestinationSheet destination={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}
