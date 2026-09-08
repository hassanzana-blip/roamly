import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { ArrowRight, Bell, CalendarDays, ChevronDown, Plane, RefreshCw, SlidersHorizontal, TimerReset } from "lucide-react";
import { trpc } from "@/providers/trpc";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import OfferCard from "@/components/offers/OfferCard";
import SearchWidget, { type SearchParamsState, type TripLeg } from "@/components/search/SearchWidget";
import PriceCalendar from "@/components/search/PriceCalendar";
import CompareTray from "@/components/search/CompareTray";
import { Slider } from "@/components/ui/slider";
import { Chip } from "@/components/ui/chip";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCustomer } from "@/lib/useCustomer";
import { useRecordSearch } from "@/lib/useAccount";
import { humanMessage } from "@/lib/apiError";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { CabinClass, Offer, SearchPassengerInput, SearchSliceInput } from "@contracts/types";
import { airportByIata } from "@contracts/airports";
import { cabinLabel, formatClock, formatDateShort, formatDayMonth, formatDuration, formatMinor, formatPrice, layoverInfo, previewTotalMinor } from "@/lib/format";
import { useFeeConfig } from "@/lib/useFeeConfig";
import { useT, type I18nKey } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { PREFERENCES, isFamily, isPreference, rank, type Preference } from "@/lib/offers";
import { ConnectionProblemSpot, NoFlightsSpot, SkeletonFlightCard } from "@/components/graphics";
import { cn } from "@/lib/utils";

type SortKey = Preference | "earliest";

const TIME_BANDS = [
  { key: "all", label: "sr.time.all" },
  { key: "night", label: "sr.time.night" },
  { key: "morning", label: "sr.time.morning" },
  { key: "day", label: "sr.time.day" },
  { key: "evening", label: "sr.time.evening" },
] as const satisfies readonly { key: string; label: I18nKey }[];
type TimeBand = (typeof TIME_BANDS)[number]["key"];

const PAGE_SIZE = 20;

function parseAges(param: string | null): number[] {
  if (!param) return [];
  return param
    .split(",")
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 17);
}

const inBand = (band: TimeBand, h: number) =>
  band === "all" ? true : band === "night" ? h < 6 : band === "morning" ? h >= 6 && h < 12 : band === "day" ? h >= 12 && h < 18 : h >= 18;

const localHour = (iso: string) => Number(iso.slice(11, 13));

function maxLayoverMinutes(o: Offer): number {
  let max = 0;
  for (const s of o.slices) {
    s.segments.forEach((seg, i) => {
      const next = s.segments[i + 1];
      if (next) max = Math.max(max, layoverInfo(seg.arrivingAt, next.departingAt, seg.destination.timeZone).minutes);
    });
  }
  return max;
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="eyebrow mb-2.5">{title}</h3>
      {children}
    </div>
  );
}

function CheckRow({ checked, onChange, label, code }: { checked: boolean; onChange: (v: boolean) => void; label: string; code?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1.5 text-sm transition-colors hover:bg-muted">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span className="flex-1">{label}</span>
      {code && <span className="rounded bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground">{code}</span>}
    </label>
  );
}

export default function SearchResults() {
  const t = useT();
  const feeConfig = useFeeConfig();
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
  const sortParam = params.get("sort");

  const slices = useMemo<SearchSliceInput[]>(() => {
    if (isMulti) return legs.map((l) => ({ origin: l.from!.iata, destination: l.to!.iata, departureDate: l.date }));
    if (!from || !to || !depart) return [];
    const s: SearchSliceInput[] = [{ origin: from, destination: to, departureDate: depart }];
    if (ret) s.push({ origin: to, destination: from, departureDate: ret });
    return s;
  }, [isMulti, legs, from, to, depart, ret]);

  const childAges = useMemo(() => parseAges(params.get("childAges")), [params]);
  const infantAges = useMemo(() => parseAges(params.get("infantAges")), [params]);

  const passengers = useMemo<SearchPassengerInput[]>(() => {
    const out: SearchPassengerInput[] = [];
    const adults = Number(params.get("adults") ?? 1);
    for (let i = 0; i < adults; i++) out.push({ type: "adult" });
    childAges.forEach((age) => out.push({ type: "child", age }));
    infantAges.forEach((age) => out.push({ type: "infant_without_seat", age }));
    return out;
  }, [params, childAges, infantAges]);
  const family = isFamily(passengers);

  const search = trpc.flights.search.useMutation();
  const serviceStatus = trpc.flights.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const [sort, setSort] = useState<SortKey>(() => (isPreference(sortParam) ? sortParam : "best"));
  const [stopsFilter, setStopsFilter] = useState<"all" | "direct" | "max1">("all");
  const [airlines, setAirlines] = useState<string[]>([]);
  const [baggageOnly, setBaggageOnly] = useState(false);
  const [refundableOnly, setRefundableOnly] = useState(false);
  const [depTime, setDepTime] = useState<TimeBand>("all");
  const [arrTime, setArrTime] = useState<TimeBand>("all");
  const [maxDurationH, setMaxDurationH] = useState(0); // 0 = unlimited
  const [maxLayoverH, setMaxLayoverH] = useState(0); // 0 = unlimited
  const [priceMax, setPriceMax] = useState<number | null>(null); // minor, null = unlimited
  const [originAirports, setOriginAirports] = useState<string[]>([]);
  const [destAirports, setDestAirports] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [calOpen, setCalOpen] = useState(() => params.get("flex") === "1");
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertTarget, setAlertTarget] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [now, setNow] = useState(() => Date.now());
  const { customer } = useCustomer();
  const recordSearch = useRecordSearch();
  const createAlert = trpc.extras.createPriceAlert.useMutation({ onSuccess: () => setAlertTarget("") });

  const doSearch = () => {
    if (!slices.length) return;
    setVisible(PAGE_SIZE);
    setPriceMax(null);
    search.mutate({ slices, passengers, cabinClass: cabin });
    // Innloggede får søket på kontoen («Rutene dine», søkehistorikk). Gjester: kun localStorage.
    recordSearch({
      origin: slices[0].origin,
      destination: slices[0].destination,
      departDate: slices[0].departureDate,
      returnDate: slices[1]?.departureDate,
      adults: Number(params.get("adults") ?? 1),
      children: childAges.length,
      infants: infantAges.length,
      cabin,
    });
  };

  useEffect(() => {
    doSearch();
    setEditOpen(false);
    if (isPreference(sortParam)) setSort(sortParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const result = search.data;
  const priceAlertsAvailable = serviceStatus.data?.demoMode === true;

  // ── offer validity ──
  const minExpiresAt = useMemo(() => {
    const ts = (result?.offers ?? []).map((o) => Date.parse(o.expiresAt)).filter((n) => Number.isFinite(n));
    return ts.length ? Math.min(...ts) : null;
  }, [result]);
  const expiresInMin = minExpiresAt ? Math.round((minExpiresAt - now) / 60_000) : null;
  const offersExpired = minExpiresAt !== null && minExpiresAt <= now;

  // ── editable search prefill ──
  const widgetInitial = useMemo<Partial<SearchParamsState>>(
    () => ({
      from: airportByIata(from) ?? null,
      to: airportByIata(to) ?? null,
      depart: depart || undefined,
      ret: ret ?? undefined,
      tripType: isMulti ? "multicity" : ret ? "roundtrip" : "oneway",
      legs: isMulti ? legs : undefined,
      pax: { adult: Number(params.get("adults") ?? 1), child: childAges.length, infant_without_seat: infantAges.length },
      ages: { children: childAges, infants: infantAges },
      cabin,
      pref: isPreference(sortParam) ? sortParam : "best",
      flex: params.get("flex") === "1",
    }),
    [from, to, depart, ret, isMulti, legs, params, childAges, infantAges, cabin, sortParam],
  );

  // ── ±3-day strip ──
  const stripDates = useMemo(() => {
    if (isMulti || !depart) return [];
    const base = new Date(`${depart}T12:00:00Z`).getTime();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => new Date(base + (i - 3) * 86_400_000).toISOString().slice(0, 10)).filter(
      (d) => new Date(`${d}T23:59:59`) >= today,
    );
  }, [depart, isMulti]);

  const tripDays = ret && depart ? Math.round((new Date(`${ret}T12:00Z`).getTime() - new Date(`${depart}T12:00Z`).getTime()) / 86_400_000) : 0;
  const hints = trpc.flights.priceHints.useQuery(
    {
      origin: from,
      destination: to,
      cabinClass: cabin,
      dates: stripDates,
      returnDates: ret && stripDates.length ? stripDates.map((d) => new Date(new Date(`${d}T12:00Z`).getTime() + tripDays * 86_400_000).toISOString().slice(0, 10)) : undefined,
      passengers: passengers.map((p) => p.type),
    },
    { enabled: stripDates.length > 0 && !isMulti, staleTime: 300_000 },
  );
  const hintByDate = useMemo(() => new Map((hints.data ?? []).map((h) => [h.date, h.amount])), [hints.data]);

  const goDate = (date: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("depart", date);
    if (ret) q.set("ret", new Date(new Date(`${date}T12:00Z`).getTime() + tripDays * 86_400_000).toISOString().slice(0, 10));
    navigate(`/sok?${q.toString()}`);
  };

  // ── offers ──
  const allOffers = useMemo(() => result?.offers ?? [], [result]);
  const currency = allOffers[0]?.totalCurrency ?? "NOK";
  const totalOf = useCallback((o: Offer) => previewTotalMinor(o.totalAmount, o.totalCurrency, feeConfig), [feeConfig]);
  const sliceDuration = (o: Offer) => o.slices.reduce((s, x) => s + x.durationMinutes, 0);

  const availableAirlines = useMemo(() => {
    const map = new Map<string, string>();
    allOffers.forEach((o) => map.set(o.owner.iata, o.owner.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "nb"));
  }, [allOffers]);

  const originOptions = useMemo(() => {
    const map = new Map<string, string>();
    allOffers.forEach((o) => map.set(o.slices[0].origin.iata, o.slices[0].origin.name));
    return [...map.entries()];
  }, [allOffers]);
  const destOptions = useMemo(() => {
    const map = new Map<string, string>();
    allOffers.forEach((o) => map.set(o.slices[0].destination.iata, o.slices[0].destination.name));
    return [...map.entries()];
  }, [allOffers]);

  const priceBounds = useMemo(() => {
    if (!allOffers.length) return null;
    const totals = allOffers.map(totalOf);
    return { min: Math.min(...totals), max: Math.max(...totals) };
  }, [allOffers, totalOf]);

  const filtered = useMemo(() => {
    let offers: Offer[] = allOffers;
    if (stopsFilter !== "all") {
      offers = offers.filter((o) => {
        const maxStops = Math.max(...o.slices.map((s) => s.stops));
        return stopsFilter === "direct" ? maxStops === 0 : maxStops <= 1;
      });
    }
    if (airlines.length) offers = offers.filter((o) => airlines.includes(o.owner.iata));
    if (baggageOnly) offers = offers.filter((o) => o.baggage.checkedBags > 0);
    if (refundableOnly) offers = offers.filter((o) => o.conditions?.refundBeforeDeparture?.allowed ?? o.refundable);
    if (depTime !== "all") offers = offers.filter((o) => inBand(depTime, localHour(o.slices[0].departingAt)));
    if (arrTime !== "all") offers = offers.filter((o) => inBand(arrTime, localHour(o.slices[0].arrivingAt)));
    if (maxDurationH > 0) offers = offers.filter((o) => sliceDuration(o) <= maxDurationH * 60);
    if (maxLayoverH > 0) offers = offers.filter((o) => maxLayoverMinutes(o) <= maxLayoverH * 60);
    if (priceMax !== null) offers = offers.filter((o) => totalOf(o) <= priceMax);
    if (originAirports.length) offers = offers.filter((o) => originAirports.includes(o.slices[0].origin.iata));
    if (destAirports.length) offers = offers.filter((o) => destAirports.includes(o.slices[0].destination.iata));
    if (sort === "earliest") {
      return [...offers].sort((a, b) => new Date(a.slices[0].departingAt).getTime() - new Date(b.slices[0].departingAt).getTime());
    }
    return rank(offers, sort, totalOf);
  }, [allOffers, totalOf, sort, stopsFilter, airlines, baggageOnly, refundableOnly, depTime, arrTime, maxDurationH, maxLayoverH, priceMax, originAirports, destAirports]);

  const summary = useMemo(() => {
    if (!allOffers.length) return null;
    const pick = (p: Preference) => rank(allOffers, p, totalOf)[0];
    return { best: pick("best"), cheapest: pick("cheapest"), fastest: pick("fastest"), family: family ? pick("family") : null };
  }, [allOffers, totalOf, family]);

  const fromAirport = airportByIata(from);
  const toAirport = airportByIata(to);

  // SEO: dynamic title «Fly Oslo → Istanbul 10. nov | HelloSky». Never indexed (parameterised).
  const routeTitle = isMulti
    ? `${t("sr.multicity")} ${legs.map((l) => l.from!.iata).join("–")}–${legs[legs.length - 1].to!.iata}`
    : from && to
      ? `Fly ${fromAirport?.city ?? from} → ${toAirport?.city ?? to}${depart ? ` ${formatDayMonth(depart)}` : ""}`
      : PAGE_META.search.title;
  usePageMeta({
    ...PAGE_META.search,
    title: routeTitle.slice(0, 60),
    description: `${routeTitle}. ${PAGE_META.search.description}`.slice(0, 155),
    canonicalPath: "/sok",
    noindex: true,
  });

  const selectOffer = (offer: Offer) => {
    sessionStorage.setItem(`hellosky:offer:${offer.id}`, JSON.stringify(offer));
    sessionStorage.setItem(`hellosky:offerctx:${offer.id}`, location.search);
    navigate(`/bestill?offer=${encodeURIComponent(offer.id)}`);
  };

  const compareOffers = useMemo(() => compareIds.map((id) => allOffers.find((o) => o.id === id)).filter((o): o is Offer => Boolean(o)), [compareIds, allOffers]);
  const toggleCompare = (offer: Offer) =>
    setCompareIds((prev) => (prev.includes(offer.id) ? prev.filter((x) => x !== offer.id) : prev.length >= 3 ? prev : [...prev, offer.id]));

  const shareText = (o: Offer) => {
    const route = `${o.slices[0].origin.iata} → ${o.slices[o.slices.length - 1].destination.iata}`;
    return t("sr.share", {
      route,
      date: formatDateShort(o.slices[0].departingAt),
      time: formatClock(o.slices[0].departingAt),
      price: formatMinor(totalOf(o), o.totalCurrency),
      count: o.passengers.length,
      url: `${window.location.origin}/sok${location.search}`,
    });
  };

  const resetFilters = () => {
    setStopsFilter("all");
    setAirlines([]);
    setBaggageOnly(false);
    setRefundableOnly(false);
    setDepTime("all");
    setArrTime("all");
    setMaxDurationH(0);
    setMaxLayoverH(0);
    setPriceMax(null);
    setOriginAirports([]);
    setDestAirports([]);
  };

  const activeFilters =
    (stopsFilter !== "all" ? 1 : 0) +
    airlines.length +
    (baggageOnly ? 1 : 0) +
    (refundableOnly ? 1 : 0) +
    (depTime !== "all" ? 1 : 0) +
    (arrTime !== "all" ? 1 : 0) +
    (maxDurationH > 0 ? 1 : 0) +
    (maxLayoverH > 0 ? 1 : 0) +
    (priceMax !== null ? 1 : 0) +
    originAirports.length +
    destAirports.length;

  const toggleIn = (list: string[], set: (v: string[]) => void, code: string, on: boolean) => set(on ? [...list, code] : list.filter((x) => x !== code));

  const filterPanel = (
    <div className="space-y-6">
      {priceBounds && priceBounds.max > priceBounds.min && (
        <FilterGroup title={t("sr.filter.maxprice")}>
          <Slider
            aria-label={t("sr.filter.maxprice")}
            min={priceBounds.min}
            max={priceBounds.max}
            step={Math.max(100, Math.round((priceBounds.max - priceBounds.min) / 50))}
            value={[priceMax ?? priceBounds.max]}
            onValueChange={([v]) => setPriceMax(v >= priceBounds.max ? null : v)}
          />
          <p className="mt-2 text-sm text-muted-foreground">
            {t("sr.filter.upto")} <span className="font-semibold tabular text-foreground">{formatMinor(priceMax ?? priceBounds.max, currency)}</span> {t("sr.filter.approxfee")}
          </p>
        </FilterGroup>
      )}
      <FilterGroup title={t("sr.filter.stops")}>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "all", label: "sr.time.all" },
              { key: "direct", label: "sr.filter.direct" },
              { key: "max1", label: "sr.filter.max1" },
            ] as const
          ).map((o) => (
            <Chip key={o.key} selected={stopsFilter === o.key} onClick={() => setStopsFilter(o.key)}>
              {t(o.label)}
            </Chip>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title={t("sr.filter.ticket")}>
        <CheckRow checked={baggageOnly} onChange={setBaggageOnly} label={t("sr.filter.baggage")} />
        <CheckRow checked={refundableOnly} onChange={setRefundableOnly} label={t("sr.filter.refundable")} />
      </FilterGroup>
      <FilterGroup title={t("sr.filter.deptime")}>
        <div className="flex flex-wrap gap-2">
          {TIME_BANDS.map((o) => (
            <Chip key={o.key} selected={depTime === o.key} onClick={() => setDepTime(o.key)}>
              {t(o.label)}
            </Chip>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title={t("sr.filter.arrtime")}>
        <div className="flex flex-wrap gap-2">
          {TIME_BANDS.map((o) => (
            <Chip key={o.key} selected={arrTime === o.key} onClick={() => setArrTime(o.key)}>
              {t(o.label)}
            </Chip>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title={t("sr.filter.maxduration")}>
        <div className="flex flex-wrap gap-2">
          {[0, 6, 10, 15, 24].map((h) => (
            <Chip key={h} selected={maxDurationH === h} onClick={() => setMaxDurationH(h)}>
              {h === 0 ? t("sr.filter.unlimited") : formatDuration(h * 60)}
            </Chip>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title={t("sr.filter.maxlayover")}>
        <div className="flex flex-wrap gap-2">
          {[0, 2, 4, 6].map((h) => (
            <Chip key={h} selected={maxLayoverH === h} onClick={() => setMaxLayoverH(h)}>
              {h === 0 ? t("sr.filter.unlimited") : formatDuration(h * 60)}
            </Chip>
          ))}
        </div>
      </FilterGroup>
      {originOptions.length > 1 && (
        <FilterGroup title={t("sr.filter.origin")}>
          {originOptions.map(([code, name]) => (
            <CheckRow key={code} checked={originAirports.includes(code)} onChange={(on) => toggleIn(originAirports, setOriginAirports, code, on)} label={name} code={code} />
          ))}
        </FilterGroup>
      )}
      {destOptions.length > 1 && (
        <FilterGroup title={t("sr.filter.dest")}>
          {destOptions.map(([code, name]) => (
            <CheckRow key={code} checked={destAirports.includes(code)} onChange={(on) => toggleIn(destAirports, setDestAirports, code, on)} label={name} code={code} />
          ))}
        </FilterGroup>
      )}
      {availableAirlines.length > 1 && (
        <FilterGroup title={t("sr.filter.airlines")}>
          {availableAirlines.map(([code, name]) => (
            <CheckRow key={code} checked={airlines.includes(code)} onChange={(on) => toggleIn(airlines, setAirlines, code, on)} label={name} code={code} />
          ))}
        </FilterGroup>
      )}
      {activeFilters > 0 && (
        <Button variant="outline" className="w-full" onClick={resetFilters}>
          {t("sr.filter.resetcount", { count: activeFilters })}
        </Button>
      )}
    </div>
  );

  // One card per distinct offer: when best, cheapest and fastest are the same
  // flight the labels merge instead of repeating one price three times.
  const summaryCards = useMemo(() => {
    if (!summary) return [] as { key: SortKey; keys: SortKey[]; label: string; offer: Offer }[];
    const raw: { key: SortKey; label: string; offer: Offer }[] = [
      { key: "best", label: t("pref.best"), offer: summary.best },
      { key: "cheapest", label: t("pref.cheapest"), offer: summary.cheapest },
      { key: "fastest", label: t("pref.fastest"), offer: summary.fastest },
      ...(summary.family ? [{ key: "family" as SortKey, label: t("pref.family"), offer: summary.family }] : []),
    ];
    const out: { key: SortKey; keys: SortKey[]; label: string; offer: Offer }[] = [];
    for (const c of raw) {
      const hit = out.find((o) => o.offer.id === c.offer.id);
      if (hit) {
        hit.keys.push(c.key);
        hit.label = `${hit.label} · ${c.label}`;
      } else out.push({ ...c, keys: [c.key] });
    }
    return out;
  }, [summary, t]);
  const summaryKeys = new Set(summaryCards.flatMap((c) => c.keys));

  /**
   * En lenke uten reisemål eller dato er ikke en feil, det er et uferdig søk.
   * Før falt siden i feilgrensen fordi datoformatereren fikk en tom streng.
   * Nå får du søket, ferdig åpnet, i stedet for et teknisk sammenbrudd.
   */
  if (!isMulti && slices.length === 0) {
    return (
      <div className="relative min-h-screen bg-background">
        <SiteHeader />
        <main id="main" tabIndex={-1} className="container-narrow pb-20 pt-28 outline-none sm:pt-32">
          <h1 className="t-h1">{t("sr.nosearch.title")}</h1>
          <p className="t-lead mt-3 max-w-lg text-muted-foreground">{t("sr.nosearch.body")}</p>
          <div className="surface-lift mt-8 p-4 sm:p-6">
            <SearchWidget initial={widgetInitial} />
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      {/* summary bar */}
      <div className="border-b border-border bg-card pt-20">
        <div className="container-x pb-5 pt-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="min-w-0">
              {isMulti ? (
                <h1 className="font-display text-2xl sm:text-3xl">
                  {t("sr.multicity")} · {legs.map((l) => l.from!.iata).join("–")}–{legs[legs.length - 1].to!.iata}
                </h1>
              ) : (
                <h1 className="font-display text-2xl sm:text-3xl">
                  {fromAirport?.city ?? from} <ArrowRight className="inline h-5 w-5 text-muted-foreground" aria-label={t("sr.to")} /> {toAirport?.city ?? to}
                </h1>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {isMulti ? legs.map((l) => formatDateShort(l.date)).join(" · ") : `${formatDateShort(depart)}${ret ? ` – ${formatDateShort(ret)}` : ` · ${t("sr.oneway")}`}`}
                {" · "}
                {t("common.pax", { count: passengers.length })} · {cabinLabel(cabin)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen((o) => !o)} aria-expanded={editOpen}>
                {t("sr.edit")}
                <ChevronDown className={cn("size-4 transition-transform", editOpen && "rotate-180")} aria-hidden="true" />
              </Button>
              {!isMulti && depart && priceAlertsAvailable && (
                <Button
                  variant={alertOpen ? "subtle" : "outline"}
                  size="sm"
                  onClick={() => {
                    setAlertOpen((o) => !o);
                    createAlert.reset();
                    if (!alertEmail && customer?.email) setAlertEmail(customer.email);
                  }}
                  aria-expanded={alertOpen}
                >
                  <Bell aria-hidden="true" /> {t("sr.alert")}
                </Button>
              )}
              {result?.demoMode && <span className="rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">{t("sr.demo")}</span>}
            </div>
          </div>

          {editOpen && (
            <div className="fade-up mt-5 max-w-3xl">
              <SearchWidget key={location.search} initial={widgetInitial} variant="compact" />
            </div>
          )}

          {alertOpen && !isMulti && depart && priceAlertsAvailable && (
            <div className="fade-up mt-5 max-w-md rounded-xl border border-border bg-card p-5 shadow-soft">
              <h2 className="font-display text-xl">{t("sr.alert.title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("sr.alert.body", { route: `${fromAirport?.city ?? from} → ${toAirport?.city ?? to}`, date: formatDateShort(depart) })}</p>
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  createAlert.mutate({ email: alertEmail.trim(), origin: from, destination: to, departDate: depart, targetPrice: Number(alertTarget) });
                }}
              >
                <label className="block">
                  <span className="sr-only">{t("common.emailaddress")}</span>
                  <Input type="email" required value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} placeholder={t("sr.alert.emailph")} />
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1">
                    <span className="sr-only">{t("sr.alert.target")}</span>
                    <Input
                      type="number"
                      required
                      min={100}
                      value={alertTarget}
                      onChange={(e) => setAlertTarget(e.target.value)}
                      placeholder={summary ? t("sr.alert.eg", { amount: Math.max(100, Math.round(totalOf(summary.cheapest) / 100) - 200) }) : t("sr.alert.targetph")}
                    />
                  </label>
                  <span className="text-sm font-semibold text-muted-foreground">kr</span>
                </div>
                {createAlert.isError && (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    {humanMessage(createAlert.error)}
                  </p>
                )}
                <Button type="submit" variant="dark" className="w-full" loading={createAlert.isPending}>
                  {t("sr.alert.activate")}
                </Button>
                {createAlert.isSuccess && <p className="text-sm font-medium text-success">{t("sr.alert.active")}</p>}
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ±3-day price strip + price calendar */}
      {stripDates.length > 0 && (
        <div className="border-b border-border bg-muted/50">
          <div className="no-scrollbar container-x flex items-center gap-2 overflow-x-auto py-3">
            {stripDates.map((d) => {
              const active = d === depart;
              const amount = hintByDate.get(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => goDate(d)}
                  aria-pressed={active}
                  className={cn(
                    "min-h-[52px] min-w-24 shrink-0 rounded-lg border px-3 py-2 text-center transition-colors",
                    active ? "border-primary/40 bg-primary-soft" : "border-border bg-card hover:border-foreground/30",
                  )}
                >
                  <span className="block text-xs font-semibold text-foreground">{formatDateShort(d)}</span>
                  <span className={cn("mt-0.5 block text-2xs tabular", active ? "text-accent-foreground" : "text-muted-foreground")}>
                    {amount ? t("sr.strip.from", { price: formatPrice(amount, "NOK") }) : hints.isLoading ? "…" : t("sr.strip.search")}
                  </span>
                </button>
              );
            })}
            <Chip selected={calOpen} onClick={() => setCalOpen((o) => !o)} aria-expanded={calOpen} className="min-h-[52px]" icon={<CalendarDays aria-hidden="true" />}>
              {t("sr.flexible")}
            </Chip>
          </div>
          {calOpen && (
            <div className="container-x pb-4">
              <div className="fade-up max-w-md">
                <PriceCalendar
                  origin={from}
                  destination={to}
                  depart={depart}
                  returnDays={tripDays}
                  cabinClass={cabin}
                  passengerTypes={passengers.map((p) => p.type)}
                  onPick={(d) => {
                    setCalOpen(false);
                    goDate(d);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* min-h keeps the footer below the fold while results stream in, so the skeleton→cards swap doesn't shift it (CLS). */}
      <main id="main" tabIndex={-1} className="container-x min-h-[100dvh] gap-8 py-6 outline-none sm:py-8 lg:grid lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-border bg-card p-5">
            <h2 className="mb-5 flex items-center gap-2 text-base font-semibold">
              <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" /> {t("sr.filter")}
            </h2>
            {filterPanel}
          </div>
        </aside>

        <section>
          {result && offersExpired && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-warning">
                <TimerReset className="size-4" aria-hidden="true" /> {t("sr.expired")}
              </p>
              <Button size="sm" onClick={doSearch}>
                {t("common.searchagain")}
              </Button>
            </div>
          )}

          {summaryCards.length > 1 && !search.isPending && (
            <div className="no-scrollbar -mx-5 mb-5 flex gap-1 overflow-x-auto border-b border-border px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0" role="radiogroup" aria-label={t("sr.sorting")}>
              {summaryCards.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={s.keys.includes(sort)}
                  onClick={() => setSort(s.key)}
                  className={cn(
                    "relative -mb-px min-w-0 shrink-0 px-3 py-3 text-left transition-colors duration-fast first:pl-0 sm:px-4",
                    s.keys.includes(sort) ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="block text-xs font-medium">{s.label}</span>
                  <span className="t-num mt-0.5 block text-lg font-semibold leading-tight">{formatMinor(totalOf(s.offer), s.offer.totalCurrency)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatDuration(sliceDuration(s.offer))} · {s.offer.owner.name}
                  </span>
                  {s.keys.includes(sort) && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary first:inset-x-0" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}

          {/* sort + mobile filter row: stays under the header while the list scrolls on phones */}
          <div className="sticky top-16 z-20 -mx-5 mb-5 flex items-center gap-2 bg-background/95 px-5 py-1 backdrop-blur-md sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:px-0 lg:py-0 lg:backdrop-blur-none">
            <div role="radiogroup" aria-label={t("sr.sorting")} className="no-scrollbar -ml-5 flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto py-1 pl-5 pr-6 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] sm:-ml-8 sm:pl-8 lg:ml-0 lg:flex-wrap lg:pl-0 lg:pr-0 lg:[mask-image:none]">
              {/* The summary cards above already carry best/cheapest/fastest (and family); the chips only add what they don't. */}
              {PREFERENCES.filter((p) => !summaryKeys.has(p.key)).map((p) => (
                <Chip
                  key={p.key}
                  role="radio"
                  aria-checked={sort === p.key}
                  selected={sort === p.key}
                  onClick={() => setSort(p.key)}
                  title={t(p.hint)}
                  icon={<p.icon aria-hidden="true" />}
                  className="shrink-0 snap-start"
                >
                  {t(p.label)}
                </Chip>
              ))}
              <Chip role="radio" aria-checked={sort === "earliest"} selected={sort === "earliest"} onClick={() => setSort("earliest")} className="shrink-0 snap-start">
                {t("sr.sort.earliest")}
              </Chip>
            </div>
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative shrink-0 lg:hidden">
                  <SlidersHorizontal aria-hidden="true" /> {t("sr.filter.short")}
                  {activeFilters > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-primary text-2xs font-bold text-primary-foreground">{activeFilters}</span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[88dvh]">
                <SheetHeader>
                  <SheetTitle>{t("sr.filter.title")}</SheetTitle>
                </SheetHeader>
                <SheetBody>{filterPanel}</SheetBody>
                <SheetFooter>
                  <Button size="lg" onClick={() => setFiltersOpen(false)}>
                    {t("sr.filter.show", { count: filtered.length })}
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>

          {search.isPending && (
            <div className="space-y-4" aria-live="polite" aria-busy="true">
              <div className="overflow-hidden rounded-xl border border-border bg-card px-5 py-6 text-center">
                <div className="relative mx-auto max-w-xs">
                  <svg viewBox="0 0 320 44" className="w-full text-primary" aria-hidden="true">
                    <path d="M8 34 C 90 6, 230 6, 312 28" fill="none" stroke="currentColor" strokeWidth="1.5" className="route-dash" opacity="0.4" />
                    <circle cx="8" cy="34" r="4" fill="currentColor" opacity="0.5" />
                    <circle cx="312" cy="28" r="4" fill="currentColor" />
                  </svg>
                  <Plane className="plane-fly absolute left-0 top-0 size-6 text-primary" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">{t("sr.searching", { to: toAirport ? t("sr.searching.to", { city: toAirport.city }) : "" })}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("sr.searching.sub")}</p>
              </div>
              <SkeletonFlightCard />
              <SkeletonFlightCard />
              <SkeletonFlightCard />
            </div>
          )}

          {search.isError && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-8 text-center">
              <ConnectionProblemSpot className="mx-auto" />
              <h2 className="mt-4 font-display text-2xl">{t("sr.error.title")}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{humanMessage(search.error)}</p>
              <Button className="mt-6" onClick={doSearch}>
                <RefreshCw aria-hidden="true" /> {t("common.retry")}
              </Button>
            </div>
          )}

          {result && !filtered.length && (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <NoFlightsSpot className="mx-auto" />
              <h2 className="mt-4 font-display text-2xl">{allOffers.length ? t("sr.empty.filtered") : t("sr.empty.none")}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{allOffers.length ? t("sr.empty.filteredsub") : t("sr.empty.nonesub")}</p>
              {allOffers.length > 0 && (
                <Button variant="outline" className="mt-6" onClick={resetFilters}>
                  {t("sr.filter.reset")}
                </Button>
              )}
            </div>
          )}

          {result && filtered.length > 0 && (
            <div className="space-y-4" aria-live="polite">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{t("sr.results", { count: filtered.length })}</span>
                {activeFilters > 0 ? ` ${t("sr.results.of", { count: allOffers.length })}` : ""}
                {" · "}
                {family ? t("sr.family.hint", { count: passengers.length }) : t("sr.totalnote")}
                {expiresInMin !== null && expiresInMin > 0 ? ` · ${t("sr.validfor", { count: expiresInMin })}` : ""}
              </p>
              {filtered.slice(0, visible).map((offer, i) => (
                <div key={offer.id} className={i < 8 ? "fade-up" : undefined} style={i < 8 ? { animationDelay: `${i * 45}ms` } : undefined}>
                <OfferCard
                  offer={offer}
                  onSelect={selectOffer}
                  comparing={compareIds.includes(offer.id)}
                  compareDisabled={compareIds.length >= 3}
                  onToggleCompare={toggleCompare}
                  shareText={shareText(offer)}
                  recommended={i === 0 && sort !== "earliest" ? sort : undefined}
                />
                </div>
              ))}
              {visible < filtered.length && (
                <Button variant="outline" size="lg" className="w-full" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  {t("sr.more", { count: filtered.length - visible })}
                </Button>
              )}
              <p className="pt-2 text-center text-xs text-muted-foreground">{t("sr.disclaimer")}</p>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />

      <CompareTray offers={compareOffers} onRemove={(id) => setCompareIds((p) => p.filter((x) => x !== id))} onClear={() => setCompareIds([])} onSelect={selectOffer} />
    </div>
  );
}
