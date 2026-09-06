import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import {
  ArrowRight,
  ChevronDown,
  Filter,
  PencilLine,
  Plane,
  Rabbit,
  RefreshCw,
  SearchX,
  ThumbsUp,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import OfferCard from "@/components/offers/OfferCard";
import SearchWidget, { type SearchParamsState, type TripLeg } from "@/components/search/SearchWidget";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { CabinClass, Offer, SearchPassengerInput, SearchSliceInput } from "@contracts/types";
import { airportByIata } from "@contracts/airports";
import { CABIN_LABELS, formatDateShort, formatDuration, formatPrice } from "@/lib/format";

type SortKey = "best" | "cheapest" | "fastest" | "earliest";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "best", label: "Anbefalt" },
  { key: "cheapest", label: "Billigst" },
  { key: "fastest", label: "Raskest" },
  { key: "earliest", label: "Tidligst avgang" },
];

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-3xl border hairline bg-card">
      <div className="border-b hairline px-5 py-3">
        <div className="shimmer h-6 w-40 rounded-lg" />
      </div>
      <div className="space-y-4 px-5 py-6">
        <div className="shimmer h-8 w-full rounded-lg" />
        <div className="shimmer h-8 w-2/3 rounded-lg" />
      </div>
      <div className="flex items-center justify-between border-t hairline px-5 py-4">
        <div className="shimmer h-9 w-32 rounded-lg" />
        <div className="shimmer h-11 w-24 rounded-2xl" />
      </div>
    </div>
  );
}

function parseAges(param: string | null): number[] {
  if (!param) return [];
  return param
    .split(",")
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 17);
}

export default function SearchResults() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // ── parse search from URL ──
  const legsParam = params.get("legs");
  const legs = useMemo<TripLeg[]>(() => {
    if (!legsParam) return [];
    return legsParam
      .split(",")
      .map((part) => {
        const [o, d, date] = part.split(":");
        return { from: airportByIata(o ?? "") ?? null, to: airportByIata(d ?? "") ?? null, date: date ?? "" };
      })
      .filter((l) => l.from && l.to && l.date);
  }, [legsParam]);

  const isMulti = legs.length >= 2;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const depart = params.get("depart") ?? "";
  const ret = params.get("ret");
  const cabin = (params.get("cabin") ?? "economy") as CabinClass;

  const slices = useMemo<SearchSliceInput[]>(() => {
    if (isMulti) {
      return legs.map((l) => ({
        origin: l.from!.iata,
        destination: l.to!.iata,
        departureDate: l.date,
      }));
    }
    if (!from || !to || !depart) return [];
    const s: SearchSliceInput[] = [{ origin: from, destination: to, departureDate: depart }];
    if (ret) s.push({ origin: to, destination: from, departureDate: ret });
    return s;
  }, [isMulti, legs, from, to, depart, ret]);

  const childAges = parseAges(params.get("childAges"));
  const infantAges = parseAges(params.get("infantAges"));

  const passengers = useMemo<SearchPassengerInput[]>(() => {
    const out: SearchPassengerInput[] = [];
    const adults = Number(params.get("adults") ?? 1);
    for (let i = 0; i < adults; i++) out.push({ type: "adult" });
    childAges.forEach((age) => out.push({ type: "child", age }));
    infantAges.forEach((age) => out.push({ type: "infant_without_seat", age }));
    return out;
  }, [params, childAges, infantAges]);

  const search = trpc.flights.search.useMutation();
  const [sort, setSort] = useState<SortKey>("best");
  const [stopsFilter, setStopsFilter] = useState<"all" | "direct" | "max1">("all");
  const [airlines, setAirlines] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  const doSearch = () => {
    if (!slices.length) return;
    search.mutate({ slices, passengers, cabinClass: cabin });
  };

  useEffect(() => {
    doSearch();
    setEditOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const result = search.data;

  // ── editable search prefill ──
  const widgetInitial = useMemo<Partial<SearchParamsState>>(
    () => ({
      from: airportByIata(from) ?? null,
      to: airportByIata(to) ?? null,
      depart: depart || undefined,
      ret: ret ?? undefined,
      tripType: isMulti ? "multicity" : ret ? "roundtrip" : "oneway",
      legs: isMulti ? legs : undefined,
      pax: {
        adult: Number(params.get("adults") ?? 1),
        child: childAges.length,
        infant_without_seat: infantAges.length,
      },
      ages: { children: childAges, infants: infantAges },
      cabin,
    }),
    [from, to, depart, ret, isMulti, legs, params, childAges, infantAges, cabin],
  );

  // ── ±3-day strip ──
  const stripDates = useMemo(() => {
    if (isMulti || !depart) return [];
    const base = new Date(`${depart}T12:00:00Z`).getTime();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base + (i - 3) * 86_400_000);
      return d.toISOString().slice(0, 10);
    }).filter((d) => new Date(`${d}T23:59:59`) >= today);
  }, [depart, isMulti]);

  const tripDays =
    ret && depart
      ? Math.round((new Date(`${ret}T12:00Z`).getTime() - new Date(`${depart}T12:00Z`).getTime()) / 86_400_000)
      : 0;
  const hints = trpc.flights.priceHints.useQuery(
    {
      origin: from,
      destination: to,
      cabinClass: cabin,
      dates: stripDates,
      returnDates:
        ret && stripDates.length
          ? stripDates.map((d) => new Date(new Date(`${d}T12:00Z`).getTime() + tripDays * 86_400_000).toISOString().slice(0, 10))
          : undefined,
      passengers: passengers.map((p) => p.type),
    },
    { enabled: stripDates.length > 0 && !isMulti, staleTime: 300_000 },
  );
  const hintByDate = useMemo(
    () => new Map((hints.data ?? []).map((h) => [h.date, h.amount])),
    [hints.data],
  );

  const goDate = (date: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("depart", date);
    if (ret) {
      q.set("ret", new Date(new Date(`${date}T12:00Z`).getTime() + tripDays * 86_400_000).toISOString().slice(0, 10));
    }
    navigate(`/sok?${q.toString()}`);
  };

  // ── offers ──
  const availableAirlines = useMemo(() => {
    const map = new Map<string, string>();
    result?.offers.forEach((o) => map.set(o.owner.iata, o.owner.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "nb"));
  }, [result]);

  const sliceDuration = (o: Offer) => o.slices.reduce((s, x) => s + x.durationMinutes, 0);

  const filtered = useMemo(() => {
    let offers: Offer[] = result?.offers ?? [];
    if (stopsFilter !== "all") {
      offers = offers.filter((o) => {
        const maxStops = Math.max(...o.slices.map((s) => s.stops));
        return stopsFilter === "direct" ? maxStops === 0 : maxStops <= 1;
      });
    }
    if (airlines.length) offers = offers.filter((o) => airlines.includes(o.owner.iata));
    const byPrice = (a: Offer, b: Offer) => Number(a.totalAmount) - Number(b.totalAmount);
    switch (sort) {
      case "cheapest":
        return [...offers].sort(byPrice);
      case "fastest":
        return [...offers].sort((a, b) => sliceDuration(a) - sliceDuration(b));
      case "earliest":
        return [...offers].sort(
          (a, b) => new Date(a.slices[0].departingAt).getTime() - new Date(b.slices[0].departingAt).getTime(),
        );
      default:
        return [...offers].sort((a, b) => byPrice(a, b) + (sliceDuration(a) - sliceDuration(b)) * 0.5);
    }
  }, [result, sort, stopsFilter, airlines]);

  // best/cheapest/fastest summary from the *unfiltered* result set
  const summary = useMemo(() => {
    const all = result?.offers ?? [];
    if (!all.length) return null;
    const byPrice = (a: Offer, b: Offer) => Number(a.totalAmount) - Number(b.totalAmount);
    const cheapest = [...all].sort(byPrice)[0];
    const fastest = [...all].sort((a, b) => sliceDuration(a) - sliceDuration(b))[0];
    const best = [...all].sort((a, b) => byPrice(a, b) + (sliceDuration(a) - sliceDuration(b)) * 0.5)[0];
    return { best, cheapest, fastest };
  }, [result]);

  const fromAirport = airportByIata(from);
  const toAirport = airportByIata(to);

  const selectOffer = (offer: Offer) => {
    sessionStorage.setItem(`roamly:offer:${offer.id}`, JSON.stringify(offer));
    sessionStorage.setItem(`roamly:offerctx:${offer.id}`, location.search);
    navigate(`/bestill?offer=${encodeURIComponent(offer.id)}`);
  };

  const activeFilters = (stopsFilter !== "all" ? 1 : 0) + airlines.length;

  const filterPanel = (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-skyline">Stopp</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "Alle" },
            { key: "direct", label: "Kun direkte" },
            { key: "max1", label: "Maks 1 stopp" },
          ].map((o) => (
            <button
              key={o.key}
              onClick={() => setStopsFilter(o.key as typeof stopsFilter)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                stopsFilter === o.key
                  ? "border-gold bg-gold/10 text-gold"
                  : "hairline text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {availableAirlines.length > 1 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-skyline">
            Flyselskaper
          </h3>
          <div className="space-y-1.5">
            {availableAirlines.map(([code, name]) => (
              <label
                key={code}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-secondary/60"
              >
                <input
                  type="checkbox"
                  checked={airlines.includes(code)}
                  onChange={(e) =>
                    setAirlines((prev) =>
                      e.target.checked ? [...prev, code] : prev.filter((x) => x !== code),
                    )
                  }
                  className="h-4 w-4 accent-[#2E5BFF]"
                />
                <span className="flex-1 text-sm">{name}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-skyline">
                  {code}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      {/* summary bar */}
      <div className="aurora-band border-b hairline pt-24">
        <div className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              {isMulti ? (
                <h1 className="font-display text-2xl sm:text-3xl">
                  Flerbyreise · {legs.map((l) => l.from!.iata).join("–")}–{legs[legs.length - 1].to!.iata}
                </h1>
              ) : (
                <h1 className="font-display text-2xl sm:text-3xl">
                  {fromAirport?.city ?? from} <ArrowRight className="inline h-5 w-5 text-gold" />{" "}
                  {toAirport?.city ?? to}
                </h1>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {isMulti
                  ? legs.map((l) => formatDateShort(l.date)).join(" · ")
                  : `${formatDateShort(depart)}${ret ? ` – ${formatDateShort(ret)}` : " · én vei"}`}
                {" · "}
                {passengers.length} {passengers.length === 1 ? "reisende" : "reisende"} · {CABIN_LABELS[cabin]}
              </p>
            </div>
            <button
              onClick={() => setEditOpen((o) => !o)}
              aria-expanded={editOpen}
              className="flex items-center gap-2 rounded-full border hairline px-4 py-2 text-sm font-medium text-skyline transition-colors hover:border-gold hover:text-gold"
            >
              <PencilLine className="h-4 w-4" /> Endre søk
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${editOpen ? "rotate-180" : ""}`} />
            </button>
            {result?.demoMode && (
              <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                Demomodus — konfigurer Duffel-nøkkel for reelle priser
              </span>
            )}
          </div>

          {editOpen && (
            <div className="fade-up mt-5 max-w-3xl">
              <SearchWidget key={location.search} initial={widgetInitial} />
            </div>
          )}
        </div>
      </div>

      {/* ±3-day price strip */}
      {stripDates.length > 0 && (
        <div className="border-b hairline bg-muted/50">
          <div className="no-scrollbar mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
            {stripDates.map((d) => {
              const active = d === depart;
              const amount = hintByDate.get(d);
              return (
                <button
                  key={d}
                  onClick={() => goDate(d)}
                  aria-pressed={active}
                  className={`min-w-24 shrink-0 rounded-2xl border px-3 py-2 text-center transition-colors ${
                    active
                      ? "border-gold bg-gold/10"
                      : "hairline hover:border-accent/60"
                  }`}
                >
                  <span className={`block text-xs font-semibold ${active ? "text-gold" : "text-foreground"}`}>
                    {formatDateShort(d)}
                  </span>
                  <span className={`mt-0.5 block text-[11px] ${active ? "text-gold/80" : "text-muted-foreground"}`}>
                    {amount ? formatPrice(amount, "NOK") : hints.isLoading ? "…" : "Søk"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid lg:grid-cols-[260px_1fr]">
        {/* desktop filters */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-3xl border hairline bg-card p-5">
            <h2 className="mb-5 flex items-center gap-2 font-display text-xl">
              <Filter className="h-4 w-4 text-gold" /> Filtrer
            </h2>
            {filterPanel}
          </div>
        </aside>

        <section>
          {/* best / cheapest / fastest summary */}
          {summary && !search.isPending && (
            <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { key: "best" as SortKey, label: "Anbefalt", offer: summary.best, icon: ThumbsUp },
                { key: "cheapest" as SortKey, label: "Billigst", offer: summary.cheapest, icon: Wallet },
                { key: "fastest" as SortKey, label: "Raskest", offer: summary.fastest, icon: Rabbit },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  aria-pressed={sort === s.key}
                  className={`rounded-2xl border p-3 text-left transition-colors sm:p-4 ${
                    sort === s.key ? "border-gold bg-gold/10" : "hairline bg-card hover:border-accent/60"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <s.icon className="h-3.5 w-3.5 text-gold" /> {s.label}
                  </span>
                  <span className="mt-1 block font-display text-lg text-gold sm:text-xl">
                    {formatPrice(s.offer.totalAmount, s.offer.totalCurrency)}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {formatDuration(sliceDuration(s.offer))} · {s.offer.owner.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* sort + mobile filter row */}
          <div className="mb-5 flex items-center gap-2">
            <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    sort === s.key
                      ? "border-gold bg-gold/10 text-gold"
                      : "hairline text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <button className="relative flex items-center gap-2 rounded-full border hairline px-4 py-2 text-sm font-medium lg:hidden">
                  <Filter className="h-4 w-4" /> Filter
                  {activeFilters > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-gold text-[10px] font-bold text-white">
                      {activeFilters}
                    </span>
                  )}
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-3xl border-t hairline bg-card text-foreground">
                <h2 className="mb-5 font-display text-2xl">Filtrer resultatet</h2>
                {filterPanel}
              </SheetContent>
            </Sheet>
          </div>

          {/* states */}
          {search.isPending && (
            <div className="space-y-4" aria-live="polite">
              <div className="flex items-center gap-3 rounded-2xl border hairline bg-card px-5 py-4">
                <Plane className="pulse-soft h-5 w-5 text-gold" />
                <p className="text-sm text-muted-foreground">
                  Vi spør flyselskapene om de beste prisene for deg …
                </p>
              </div>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {search.isError && (
            <div className="rounded-3xl border border-primary/40 bg-card p-8 text-center">
              <TriangleAlert className="mx-auto h-8 w-8 text-primary" />
              <h2 className="mt-4 font-display text-2xl">Søket gikk ikke helt som planlagt</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{search.error.message}</p>
              <button
                onClick={doSearch}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
              >
                <RefreshCw className="h-4 w-4" /> Prøv igjen
              </button>
            </div>
          )}

          {result && !filtered.length && (
            <div className="rounded-3xl border hairline bg-card p-8 text-center">
              <SearchX className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-4 font-display text-2xl">Ingen flyvninger passer filtrene</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Prøv å fjerne noen filtre, eller juster datoene for å se flere alternativer.
              </p>
              <button
                onClick={() => {
                  setStopsFilter("all");
                  setAirlines([]);
                }}
                className="mt-6 rounded-2xl border hairline px-6 py-3 text-sm font-medium hover:border-gold hover:text-gold"
              >
                Nullstill filtre
              </button>
            </div>
          )}

          {result && filtered.length > 0 && (
            <div className="space-y-4" aria-live="polite">
              <p className="text-sm text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "alternativ" : "alternativer"} funnet
              </p>
              {filtered.map((offer) => (
                <OfferCard key={offer.id} offer={offer} onSelect={selectOffer} />
              ))}
              <p className="pt-2 text-center text-xs text-muted-foreground">
                Prisene er hentet direkte fra flyselskapene og kan endres frem til betaling er fullført.
              </p>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
