import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { HotelSummary } from "@contracts/hotels";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import HeroBar from "@/components/app/HeroBar";
import ServiceTabs from "@/components/app/ServiceTabs";
import HotelCard from "@/components/stays/HotelCard";
import { HotelSearchForm } from "@/components/stays/StaySearchForms";
import { DisabledState, DisclosureNote, RetryButton, SandboxBadge, SortBar, StateBlock, StaySkeleton } from "@/components/stays/StayLayout";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { trpc } from "@/providers/trpc";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort, formatMoney } from "@/lib/format";
import { humanMessage } from "@/lib/apiError";
import { searchSessionId } from "@/lib/kayakSession";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Sort = "recommended" | "cheapest" | "rating" | "distance";

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="eyebrow mb-2.5">{title}</h3>
      {children}
    </div>
  );
}

function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1.5 text-sm transition-colors hover:bg-muted">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-[hsl(var(--primary))]" />
      <span className="flex-1">{label}</span>
    </label>
  );
}

export default function Hotels() {
  usePageMeta(PAGE_META.hotels);
  const t = useT();
  const { currency, lang } = useLocale();
  const [params] = useSearchParams();
  const dest = params.get("dest") ?? "";
  const place = params.get("place") ?? "";
  const checkin = params.get("checkin") ?? "";
  const checkout = params.get("checkout") ?? "";
  const adults = Math.max(1, Math.min(8, Number(params.get("adults") ?? 2)));
  const rooms = Math.max(1, Math.min(4, Number(params.get("rooms") ?? 1)));
  const hasSearch = Boolean(dest && checkin && checkout);

  const status = trpc.hotels.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const enabled = status.data?.enabled === true;
  const roomList = useMemo(() => Array.from({ length: rooms }, (_, i) => ({ adults: Math.max(1, Math.round(adults / rooms) + (i === 0 ? adults % rooms : 0)) })), [adults, rooms]);
  const search = trpc.hotels.search.useQuery(
    { destination: dest, checkin, checkout, rooms: roomList, currency, language: lang, sessionId: searchSessionId() },
    { enabled: enabled && hasSearch, staleTime: 10 * 60_000, retry: false },
  );

  const [sort, setSort] = useState<Sort>("recommended");
  const [minRating, setMinRating] = useState<0 | 7 | 8 | 9>(0);
  const [stars, setStars] = useState<number[]>([]);
  const [maxNight, setMaxNight] = useState<number | null>(null);
  const [freeCancel, setFreeCancel] = useState(false);
  const [breakfast, setBreakfast] = useState(false);
  const [photosOnly, setPhotosOnly] = useState(false);
  const [editOpen, setEditOpen] = useState(!hasSearch);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const all = useMemo(() => search.data?.results ?? [], [search.data]);
  const nightBounds = useMemo(() => {
    const v = all.map((h) => h.rates[0]?.perNightAmount).filter((n): n is number => typeof n === "number");
    return v.length ? { min: Math.floor(Math.min(...v)), max: Math.ceil(Math.max(...v)) } : null;
  }, [all]);

  const filtered = useMemo(() => {
    let list = all.filter((h) => h.rates.length > 0 || sort === "distance");
    if (minRating) list = list.filter((h) => (h.guestRating ?? 0) >= minRating);
    if (stars.length) list = list.filter((h) => stars.includes(Math.round(h.starRating)));
    if (maxNight !== null) list = list.filter((h) => (h.rates[0]?.perNightAmount ?? Infinity) <= maxNight);
    if (freeCancel) list = list.filter((h) => h.rates.some((r) => r.freeCancellation));
    if (breakfast) list = list.filter((h) => h.rates.some((r) => r.inclusions.includes(0) || r.inclusions.includes(3) || r.inclusions.includes(4)));
    if (photosOnly) list = list.filter((h) => h.images.length > 0);
    const by: Record<Sort, (a: HotelSummary, b: HotelSummary) => number> = {
      recommended: () => 0,
      cheapest: (a, b) => (a.lowestTotal ?? Infinity) - (b.lowestTotal ?? Infinity),
      rating: (a, b) => (b.guestRating ?? -1) - (a.guestRating ?? -1) || b.numberOfReviews - a.numberOfReviews,
      distance: (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
    };
    return sort === "recommended" ? list : [...list].sort(by[sort]);
  }, [all, sort, minRating, stars, maxNight, freeCancel, breakfast, photosOnly]);

  const activeFilters = (minRating ? 1 : 0) + (stars.length ? 1 : 0) + (maxNight !== null ? 1 : 0) + (freeCancel ? 1 : 0) + (breakfast ? 1 : 0) + (photosOnly ? 1 : 0);
  const reset = () => {
    setMinRating(0);
    setStars([]);
    setMaxNight(null);
    setFreeCancel(false);
    setBreakfast(false);
    setPhotosOnly(false);
  };
  const detailHref = (h: HotelSummary) => `/hotell/${encodeURIComponent(h.key)}?checkin=${checkin}&checkout=${checkout}&adults=${adults}&rooms=${rooms}&place=${encodeURIComponent(place)}`;

  const filterPanel = (
    <div className="space-y-6">
      <FilterGroup title={t("ht.filter.rating")}>
        <div className="flex flex-wrap gap-2">
          {([7, 8, 9] as const).map((r) => (
            <Chip key={r} selected={minRating === r} onClick={() => setMinRating(minRating === r ? 0 : r)}>{r}+</Chip>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title={t("ht.filter.stars")}>
        <div className="flex flex-wrap gap-2">
          {[3, 4, 5].map((s) => (
            <Chip key={s} selected={stars.includes(s)} onClick={() => setStars((v) => (v.includes(s) ? v.filter((x) => x !== s) : [...v, s]))}>{s} ★</Chip>
          ))}
        </div>
      </FilterGroup>
      {nightBounds && nightBounds.max > nightBounds.min && (
        <FilterGroup title={t("ht.filter.price")}>
          <input
            type="range"
            aria-label={t("ht.filter.price")}
            min={nightBounds.min}
            max={nightBounds.max}
            step={Math.max(1, Math.round((nightBounds.max - nightBounds.min) / 40))}
            value={maxNight ?? nightBounds.max}
            onChange={(e) => setMaxNight(Number(e.target.value) >= nightBounds.max ? null : Number(e.target.value))}
            className="w-full accent-[hsl(var(--primary))]"
          />
          <p className="mt-2 text-sm text-muted-foreground">
            {t("sr.filter.upto")} <span className="tabular font-semibold text-foreground">{formatMoney(maxNight ?? nightBounds.max, search.data?.currency ?? currency)}</span> {t("ht.pernight")}
          </p>
        </FilterGroup>
      )}
      <FilterGroup title={t("ht.filter.perks")}>
        <CheckRow checked={freeCancel} onChange={setFreeCancel} label={t("ht.freecancel")} />
        <CheckRow checked={breakfast} onChange={setBreakfast} label={t("ht.filter.breakfast")} />
        <CheckRow checked={photosOnly} onChange={setPhotosOnly} label={t("ht.filter.photos")} />
      </FilterGroup>
      {activeFilters > 0 && (
        <Button variant="outline" className="w-full" onClick={reset}>
          {t("sr.filter.resetcount", { count: activeFilters })}
        </Button>
      )}
    </div>
  );

  const sortOptions: { value: Sort; label: string }[] = [
    { value: "recommended", label: t("ht.sort.recommended") },
    { value: "cheapest", label: t("ht.sort.cheapest") },
    { value: "rating", label: t("ht.sort.rating") },
    { value: "distance", label: t("ht.sort.distance") },
  ];

  return (
    <div className="relative min-h-screen bg-background">
      <div className="hidden lg:block"><SiteHeader /></div>
      <div className="lg:pt-[72px]">
        <div className="container-x pb-2 pt-4 lg:pt-6">
          <HeroBar backTo="/" tone="dark" className="mb-6 lg:hidden" />
          {hasSearch ? (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="t-h1">{place || t("ht.title")}</h1>
                <p className="mt-2 text-[17px] text-foreground">
                  {formatDateShort(checkin)} – {formatDateShort(checkout)} · {t("ht.nights", { count: search.data?.nights ?? Math.max(1, Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86_400_000)) })} · {t("ht.adults", { count: adults })} · {t("ht.rooms", { count: rooms })}
                </p>
              </div>
              <button type="button" onClick={() => setEditOpen((o) => !o)} aria-expanded={editOpen} className="inline-flex min-h-11 items-center gap-1 text-[17px] font-medium text-accent-foreground underline underline-offset-4">
                {t("common.change")} <ChevronDown className={cn("size-4 transition-transform", editOpen && "rotate-180")} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div>
              <h1 className="t-h1">{t("ht.h1")}</h1>
              <p className="t-lead mt-2 max-w-2xl">{t("ht.sub")}</p>
            </div>
          )}
          <ServiceTabs active="hotell" className="mt-5" />
          {(editOpen || !hasSearch) && (
            <div className={cn("card-soft mt-4 p-3 sm:p-4", hasSearch && "fade-up")}>
              <HotelSearchForm initial={{ dest, place, checkin: checkin || undefined, checkout: checkout || undefined, adults, rooms }} compact onSubmitted={() => setEditOpen(false)} />
            </div>
          )}
        </div>
      </div>

      <main id="main" tabIndex={-1} className="container-x min-h-[60dvh] gap-8 py-5 outline-none sm:py-6 lg:grid lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          {hasSearch && enabled && (
            <div className="card-soft sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto p-5">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-semibold">{t("common.filter")}</h2>
                {activeFilters > 0 && (
                  <button type="button" onClick={reset} className="text-sm font-semibold text-accent-foreground">{t("common.reset")}</button>
                )}
              </div>
              {filterPanel}
            </div>
          )}
        </aside>

        <section className="space-y-4">
          {status.isSuccess && !enabled && <DisabledState title={t("ht.disabled.title")} body={t("ht.disabled.body")} cta={t("ht.disabled.cta")} to={`/hotell-bil?fane=hotell${place ? `&sted=${encodeURIComponent(place)}` : ""}`} />}

          {enabled && hasSearch && (
            <>
              <div className="sticky top-0 z-20 -mx-5 flex items-center gap-2 bg-background/95 px-5 py-2 backdrop-blur-md sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:px-0 lg:py-0 lg:backdrop-blur-none">
                <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
                  <SortBar value={sort} onChange={setSort} options={sortOptions} label={t("sr.sorting")} />
                </div>
                <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <SheetTrigger asChild>
                    <button type="button" aria-label={t("sr.filters.open")} className="relative grid size-14 shrink-0 place-items-center rounded-full bg-blush text-foreground transition-colors hover:bg-primary hover:text-primary-foreground lg:hidden">
                      <SlidersHorizontal className="size-6" aria-hidden="true" />
                      {activeFilters > 0 && <span className="absolute -right-0.5 -top-0.5 grid size-6 place-items-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground">{activeFilters}</span>}
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[88dvh]">
                    <SheetHeader>
                      <SheetTitle>{t("common.filter")}</SheetTitle>
                    </SheetHeader>
                    <SheetBody>{filterPanel}</SheetBody>
                    <SheetFooter>
                      <Button size="lg" className="rounded-full" onClick={() => setFiltersOpen(false)}>{t("common.showresults", { count: filtered.length })}</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>

              {search.isLoading && (
                <div className="space-y-4" aria-live="polite" aria-busy="true">
                  <p className="text-sm font-medium text-muted-foreground">{t("common.loadingprices")}</p>
                  <StaySkeleton />
                  <StaySkeleton />
                  <StaySkeleton />
                </div>
              )}
              {search.isError && <StateBlock kind="error" title={t("ht.error.title")} body={humanMessage(search.error)} action={<RetryButton onClick={() => search.refetch()} />} />}
              {search.data && filtered.length === 0 && (
                <StateBlock kind="empty" title={t("ht.empty.title")} body={t("ht.empty.body")} action={activeFilters > 0 ? <Button variant="outline" onClick={reset}>{t("sr.filter.reset")}</Button> : undefined} />
              )}
              {search.data && filtered.length > 0 && (
                <div className="space-y-4" aria-live="polite">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{t("ht.results", { count: filtered.length })}</span>
                    {search.data.sandbox && <SandboxBadge />}
                    {!search.data.complete && <span className="text-xs">{t("common.partial")}</span>}
                  </p>
                  {filtered.map((h, i) => (
                    <div key={h.key} className={i < 6 ? "fade-up" : undefined} style={i < 6 ? { animationDelay: `${i * 45}ms` } : undefined}>
                      <HotelCard hotel={h} to={detailHref(h)} sandbox={search.data.sandbox} />
                    </div>
                  ))}
                  <DisclosureNote text={t("ht.disclosure")} />
                </div>
              )}
            </>
          )}

          {enabled && !hasSearch && <DisclosureNote text={t("ht.disclosure")} />}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
