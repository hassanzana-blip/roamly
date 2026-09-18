import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { CarOffer } from "@contracts/cars";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import CarCard from "@/components/stays/CarCard";
import { CarSearchForm } from "@/components/stays/StaySearchForms";
import { DisabledState, DisclosureNote, RetryButton, SandboxBadge, SortBar, StateBlock, StaySkeleton } from "@/components/stays/StayLayout";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { trpc } from "@/providers/trpc";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import { humanMessage } from "@/lib/apiError";
import { searchSessionId } from "@/lib/kayakSession";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Sort = "recommended" | "cheapest" | "largest";

export default function Cars() {
  usePageMeta(PAGE_META.cars);
  const t = useT();
  const { currency } = useLocale();
  const [params] = useSearchParams();
  const type = params.get("type") === "city" ? "city" : params.get("type") === "airport" ? "airport" : "";
  const value = params.get("value") ?? "";
  const place = params.get("place") ?? "";
  const pickup = params.get("pickup") ?? "";
  const dropoff = params.get("dropoff") ?? "";
  const hasSearch = Boolean(type && value && pickup && dropoff);

  const status = trpc.cars.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const enabled = status.data?.enabled === true;
  const search = trpc.cars.search.useQuery(
    { pickup: { type: type as "airport" | "city", value }, pickupDate: pickup, dropoffDate: dropoff, pickupHour: 10, dropoffHour: 10, currency, sessionId: searchSessionId() },
    { enabled: enabled && hasSearch, staleTime: 10 * 60_000, retry: false },
  );

  const [sort, setSort] = useState<Sort>("recommended");
  const [transmission, setTransmission] = useState<"" | "automatic" | "manual">("");
  const [classes, setClasses] = useState<string[]>([]);
  const [freeCancel, setFreeCancel] = useState(false);
  const [unlimited, setUnlimited] = useState(false);
  const [editOpen, setEditOpen] = useState(!hasSearch);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const all = useMemo(() => search.data?.results ?? [], [search.data]);
  const classOptions = useMemo(() => Array.from(new Set(all.map((c) => c.className).filter(Boolean))).slice(0, 8), [all]);
  const filtered = useMemo(() => {
    let list = all;
    if (transmission) list = list.filter((c) => c.transmission === transmission);
    if (classes.length) list = list.filter((c) => classes.includes(c.className));
    if (freeCancel) list = list.filter((c) => c.freeCancellation);
    if (unlimited) list = list.filter((c) => c.unlimitedMileage);
    const by: Record<Sort, (a: CarOffer, b: CarOffer) => number> = {
      recommended: () => 0,
      cheapest: (a, b) => a.totalAmount - b.totalAmount,
      largest: (a, b) => (b.seats ?? 0) - (a.seats ?? 0) || (b.bags ?? 0) - (a.bags ?? 0),
    };
    return sort === "recommended" ? list : [...list].sort(by[sort]);
  }, [all, sort, transmission, classes, freeCancel, unlimited]);
  const activeFilters = (transmission ? 1 : 0) + (classes.length ? 1 : 0) + (freeCancel ? 1 : 0) + (unlimited ? 1 : 0);
  const reset = () => {
    setTransmission("");
    setClasses([]);
    setFreeCancel(false);
    setUnlimited(false);
  };

  const filterPanel = (
    <div className="space-y-6">
      <div>
        <h3 className="eyebrow mb-2.5">Gir</h3>
        <div className="flex flex-wrap gap-2">
          <Chip selected={transmission === "automatic"} onClick={() => setTransmission(transmission === "automatic" ? "" : "automatic")}>{t("cr.automatic")}</Chip>
          <Chip selected={transmission === "manual"} onClick={() => setTransmission(transmission === "manual" ? "" : "manual")}>{t("cr.manual")}</Chip>
        </div>
      </div>
      {classOptions.length > 1 && (
        <div>
          <h3 className="eyebrow mb-2.5">Bilklasse</h3>
          <div className="flex flex-wrap gap-2">
            {classOptions.map((c) => (
              <Chip key={c} selected={classes.includes(c)} onClick={() => setClasses((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]))}>{c}</Chip>
            ))}
          </div>
        </div>
      )}
      <div>
        <h3 className="eyebrow mb-2.5">{t("ht.filter.perks")}</h3>
        <div className="flex flex-wrap gap-2">
          <Chip selected={freeCancel} onClick={() => setFreeCancel((v) => !v)}>{t("ht.freecancel")}</Chip>
          <Chip selected={unlimited} onClick={() => setUnlimited((v) => !v)}>Fri kilometer</Chip>
        </div>
      </div>
      {activeFilters > 0 && <Button variant="outline" className="w-full" onClick={reset}>{t("sr.filter.resetcount", { count: activeFilters })}</Button>}
    </div>
  );

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />
      <div className="border-b border-border bg-card pt-16">
        <div className="container-x py-5">
          {hasSearch ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-display text-2xl sm:text-3xl">{place || t("cr.title")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{formatDateShort(pickup)} 10:00 – {formatDateShort(dropoff)} 10:00</p>
              </div>
              <Button variant="outline" onClick={() => setEditOpen((o) => !o)} aria-expanded={editOpen} className="rounded-full">
                {t("common.editsearch")} <ChevronDown className={cn("size-4 transition-transform", editOpen && "rotate-180")} aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <div>
              <h1 className="t-h1">{t("cr.h1")}</h1>
              <p className="t-lead mt-2 max-w-2xl text-muted-foreground">{t("cr.sub")}</p>
            </div>
          )}
          {(editOpen || !hasSearch) && (
            <div className={cn("mt-5", hasSearch && "fade-up")}>
              <CarSearchForm initial={{ type, value, place, pickup: pickup || undefined, dropoff: dropoff || undefined }} compact onSubmitted={() => setEditOpen(false)} />
            </div>
          )}
        </div>
      </div>

      <main id="main" tabIndex={-1} className="container-x min-h-[60dvh] gap-8 py-6 outline-none sm:py-8 lg:grid lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          {hasSearch && enabled && (
            <div className="sticky top-24 rounded-2xl border border-border bg-card p-5">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-semibold">{t("common.filter")}</h2>
                {activeFilters > 0 && <button type="button" onClick={reset} className="text-sm font-semibold text-accent-foreground">{t("common.reset")}</button>}
              </div>
              {filterPanel}
            </div>
          )}
        </aside>
        <section className="space-y-4">
          {status.isSuccess && !enabled && <DisabledState title={t("cr.disabled.title")} body={t("cr.disabled.body")} cta={t("cr.disabled.cta")} to={`/hotell-bil?fane=bil${place ? `&sted=${encodeURIComponent(place)}` : ""}`} />}
          {enabled && hasSearch && (
            <>
              <div className="sticky top-16 z-20 -mx-5 flex items-center gap-2 bg-background/95 px-5 py-2 backdrop-blur-md sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:px-0 lg:py-0 lg:backdrop-blur-none">
                <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
                  <SortBar value={sort} onChange={setSort} label={t("sr.sorting")} options={[{ value: "recommended", label: t("ht.sort.recommended") }, { value: "cheapest", label: t("ht.sort.cheapest") }, { value: "largest", label: "Størst" }]} />
                </div>
                <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="relative shrink-0 rounded-full lg:hidden">
                      <SlidersHorizontal aria-hidden="true" /> {t("common.filter")}
                      {activeFilters > 0 && <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-primary text-2xs font-bold text-primary-foreground">{activeFilters}</span>}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[88dvh]">
                    <SheetHeader><SheetTitle>{t("common.filter")}</SheetTitle></SheetHeader>
                    <SheetBody>{filterPanel}</SheetBody>
                    <SheetFooter><Button size="lg" className="rounded-full" onClick={() => setFiltersOpen(false)}>{t("common.showresults", { count: filtered.length })}</Button></SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>
              {search.isLoading && (
                <div className="space-y-4" aria-live="polite" aria-busy="true">
                  <p className="text-sm font-medium text-muted-foreground">{t("common.loadingprices")}</p>
                  <StaySkeleton /><StaySkeleton /><StaySkeleton />
                </div>
              )}
              {search.isError && <StateBlock kind="error" title={t("cr.error.title")} body={humanMessage(search.error)} action={<RetryButton onClick={() => search.refetch()} />} />}
              {search.data && filtered.length === 0 && <StateBlock kind="empty" title={t("cr.empty.title")} body={t("ht.empty.body")} action={activeFilters > 0 ? <Button variant="outline" onClick={reset}>{t("sr.filter.reset")}</Button> : undefined} />}
              {search.data && filtered.length > 0 && (
                <div className="space-y-4" aria-live="polite">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{t("cr.results", { count: filtered.length })}</span>
                    {search.data.sandbox && <SandboxBadge />}
                    {!search.data.complete && <span className="text-xs">{t("common.partial")}</span>}
                  </p>
                  {filtered.map((c, i) => (
                    <div key={c.id} className={i < 6 ? "fade-up" : undefined} style={i < 6 ? { animationDelay: `${i * 45}ms` } : undefined}>
                      <CarCard car={c} sandbox={search.data.sandbox} />
                    </div>
                  ))}
                  <DisclosureNote text={t("cr.disclosure")} />
                </div>
              )}
            </>
          )}
          {enabled && !hasSearch && <DisclosureNote text={t("cr.disclosure")} />}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
