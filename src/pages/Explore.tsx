import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import PlaceCard from "@/components/travel/PlaceCard";
import DestinationSheet from "@/components/app/DestinationSheet";
import { EmptyState } from "@/components/app/primitives";
import { NoSavedSpot } from "@/components/graphics";
import { Chip } from "@/components/account/AccountRow";
import { Segmented } from "@/components/ui/segmented";
import { useSavedDestinations } from "@/lib/useAccount";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { ALL_DESTINATIONS, type DiscoverDestination } from "@/content/discover";
import { FLIGHT_HINT, FLIGHT_LABELS, matches, MOODS, REGION_LABELS, REGION_ORDER, type FlightBucket, type Region } from "@/content/explore";

/**
 * Utforsk – hele katalogen med tre ærlige filtre: stemning, region og
 * reisetid som kategori. Alt lever i URL-en, så et utvalg kan deles.
 */

const FLIGHTS: (FlightBucket | "alle")[] = ["alle", "short", "medium", "long"];

export default function Explore() {
  usePageMeta(PAGE_META.explore);
  const [params, setParams] = useSearchParams();
  const t = useT();
  const mood = MOODS.some((m) => m.id === params.get("k")) ? (params.get("k") as string) : "alle";
  const region = (REGION_ORDER as string[]).includes(params.get("r") ?? "") ? (params.get("r") as Region) : "alle";
  const flight = (FLIGHTS as string[]).includes(params.get("f") ?? "") ? (params.get("f") as FlightBucket | "alle") : "alle";
  const set = (patch: Partial<{ k: string; r: string; f: string }>) => {
    const next: Record<string, string> = { k: mood, r: region, f: flight, ...patch };
    const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => v && v !== "alle"));
    setParams(clean, { replace: true });
  };
  const [quickView, setQuickView] = useState<DiscoverDestination | null>(null);
  const { ids: favs, toggle: toggleFav } = useSavedDestinations();

  const list = ALL_DESTINATIONS.filter((d) => matches(d, { mood, region, flight }));
  const active = [mood, region, flight].filter((v) => v !== "alle").length;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <AppHeader title={t("explore.title")} as="h1" />

        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8" role="group" aria-label="Stemning">
          {MOODS.map((m) => (
            <Chip key={m.id} active={mood === m.id} onClick={() => set({ k: m.id })} className={mood === m.id ? "border-primary bg-primary text-primary-foreground" : undefined}>
              {m.id === "alle" ? t("explore.all") : m.label}
            </Chip>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Region">
            <Chip active={region === "alle"} onClick={() => set({ r: "alle" })} className="min-h-9 text-[13px]">Alle regioner</Chip>
            {REGION_ORDER.map((r) => (
              <Chip key={r} active={region === r} onClick={() => set({ r })} className="min-h-9 text-[13px]">{REGION_LABELS[r]}</Chip>
            ))}
          </div>
          <Segmented
            aria-label="Reisetid"
            value={flight}
            onValueChange={(f) => set({ f })}
            size="sm"
            className="sm:shrink-0"
            options={FLIGHTS.map((f) => ({ value: f, label: f === "alle" ? "All reisetid" : FLIGHT_LABELS[f].replace(" reise", "") }))}
          />
        </div>
        {flight !== "alle" && <p className="mt-2 text-[12px] text-muted-foreground">{FLIGHT_HINT[flight]}. Regnet fra Oslo; faktisk reisetid ser du i søket.</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">{list.length === 1 ? "1 reisemål" : `${list.length} reisemål`}</p>
          {active > 0 && <button type="button" onClick={() => setParams({}, { replace: true })} className="text-[13px] font-semibold underline underline-offset-2">Nullstill</button>}
        </div>

        {list.length ? (
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
            {list.map((d) => (
              <PlaceCard
                key={d.id}
                place={{ id: d.id, city: d.city, country: d.country, iata: d.iata, caption: d.tagline, image: d.image, imageAlt: d.imageAlt }}
                onOpen={() => setQuickView(d)}
                favourite={favs.has(d.id)}
                onToggleFavourite={() => toggleFav(d.id)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState illustration={<NoSavedSpot />} title="Ingen reisemål passer alle filtrene" body="Prøv å ta bort ett av dem." action={<button type="button" onClick={() => setParams({}, { replace: true })} className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background">Vis alle</button>} />
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-muted/70 p-5">
          <p className="flex items-center gap-2 text-[14px] text-muted-foreground"><Icon icon={Sparkles} size={16} className="shrink-0" /> Usikker på hvor du vil? ReiseMatch foreslår reisemål ut fra hva du liker.</p>
          <Link to="/quiz" className="press inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-semibold text-background">ReiseMatch <Icon icon={ArrowRight} size={16} /></Link>
        </div>
      </AppShell>
      <DestinationSheet destination={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}
