import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { ArrowRight, Bell, CalendarDays, ChevronDown, Filter, PencilLine, Plane, Rabbit, RefreshCw, SearchX, ThumbsUp, TimerReset, TriangleAlert, Wallet } from "lucide-react";
import { trpc } from "@/providers/trpc";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import OfferCard from "@/components/offers/OfferCard";
import SearchWidget, { type SearchParamsState, type TripLeg } from "@/components/search/SearchWidget";
import PriceCalendar from "@/components/search/PriceCalendar";
import CompareTray from "@/components/search/CompareTray";
import { Slider } from "@/components/ui/slider";
import { useCustomer } from "@/lib/useCustomer";
import { humanMessage } from "@/lib/apiError";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { CabinClass, Offer, SearchPassengerInput, SearchSliceInput } from "@contracts/types";
import { airportByIata } from "@contracts/airports";
import { cabinLabel, formatClock, formatDateShort, formatDayMonth, formatDuration, formatMinor, formatPrice, layoverInfo, previewTotalMinor } from "@/lib/format";
import { useFeeConfig } from "@/lib/useFeeConfig";
import { useT, type I18nKey } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

type SortKey = "best" | "cheapest" | "fastest" | "earliest";

const SORTS: { key: SortKey; label: I18nKey }[] = [
  { key: "best", label: "sr.sort.best" },
  { key: "cheapest", label: "sr.sort.cheapest" },
  { key: "fastest", label: "sr.sort.fastest" },
  { key: "earliest", label: "sr.sort.earliest" },
];

const TIME_BANDS = [
  { key: "all", label: "sr.time.all" },
  { key: "night", label: "sr.time.night" },
  { key: "morning", label: "sr.time.morning" },
  { key: "day", label: "sr.time.day" },
  { key: "evening", label: "sr.time.evening" },
] as const satisfies readonly { key: string; label: I18nKey }[];
type TimeBand = (typeof TIME_BANDS)[number]["key"];

const PAGE_SIZE = 20;

const chipCls = (active: boolean) =>
  cn(
    "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
    active ? "border-foreground/25 bg-muted text-foreground" : "hairline text-muted-foreground hover:text-foreground",
  );

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card" aria-hidden="true">
      <div className="border-b hairline px-5 py-3">
        <div className="shimmer h-6 w-40 rounded-lg" />
      </div>
      <div className="space-y-4 px-5 py-6">
        <div className="shimmer h-8 w-full rounded-lg" />
        <div className="shimmer h-8 w-2/3 rounded-lg" />
      </div>
      <div className="flex items-center justify-between border-t hairline px-5 py-4">
        <div className="shimmer h-9 w-32 rounded-lg" />
        <div className="shimmer h-11 w-24 rounded-xl" />
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

  const search = trpc.flights.search.useMutation();
  const serviceStatus = trpc.flights.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const [sort, setSort] = useState<SortKey>("best");
  const [stopsFilter, setStopsFilter] = useState<"all" | "direct" | "max1">("all");
  const [airlines, setAirlines] = useState<string[]>([]);
  const [baggageOnly, setBaggageOnly] = useState(false);
  const [refundableOnly, setRefundableOnly] = useState(false);
  const [depTime, setDepTime] = useState<TimeBand>("all");
  const [arrTime, setArrTime] = useState<TimeBand>("all");
  const [maxDurationH, setMaxDurationH] = useState(0); // 0 = ubegrenset
  const [maxLayoverH, setMaxLayoverH] = useState(0); // 0 = ubegrenset
  const [priceMax, setPriceMax] = useState<number | null>(null); // minor, null = ubegrenset
  const [originAirports, setOriginAirports] = useState<string[]>([]);
  const [destAirports, setDestAirports] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [calOpen, setCalOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertTarget, setAlertTarget] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [now, setNow] = useState(() => Date.now());
  const { customer } = useCustomer();
  const createAlert = trpc.extras.createPriceAlert.useMutation({ onSuccess: () => setAlertTarget("") });

  const doSearch = () => {
    if (!slices.length) return;
    setVisible(PAGE_SIZE);
    setPriceMax(null);
    search.mutate({ slices, passengers, cabinClass: cabin });
  };

  useEffect(() => {
    doSearch();
    setEditOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const result = search.data;
  const priceAlertsAvailable = serviceStatus.data?.demoMode === true;

  // ── Tilbudenes gyldighet ──
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
    }),
    [from, to, depart, ret, isMulti, legs, params, childAges, infantAges, cabin],
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
    const byPrice = (a: Offer, b: Offer) => totalOf(a) - totalOf(b);
    switch (sort) {
      case "cheapest":
        return [...offers].sort(byPrice);
      case "fastest":
        return [...offers].sort((a, b) => sliceDuration(a) - sliceDuration(b));
      case "earliest":
        return [...offers].sort((a, b) => new Date(a.slices[0].departingAt).getTime() - new Date(b.slices[0].departingAt).getTime());
      default:
        return [...offers].sort((a, b) => byPrice(a, b) / 100 + (sliceDuration(a) - sliceDuration(b)) * 0.5);
    }
  }, [allOffers, totalOf, sort, stopsFilter, airlines, baggageOnly, refundableOnly, depTime, arrTime, maxDurationH, maxLayoverH, priceMax, originAirports, destAirports]);

  const summary = useMemo(() => {
    if (!allOffers.length) return null;
    const byPrice = (a: Offer, b: Offer) => totalOf(a) - totalOf(b);
    const cheapest = [...allOffers].sort(byPrice)[0];
    const fastest = [...allOffers].sort((a, b) => sliceDuration(a) - sliceDuration(b))[0];
    const best = [...allOffers].sort((a, b) => byPrice(a, b) / 100 + (sliceDuration(a) - sliceDuration(b)) * 0.5)[0];
    return { best, cheapest, fastest };
  }, [allOffers, totalOf]);

  const fromAirport = airportByIata(from);
  const toAirport = airportByIata(to);

  // SEO: dynamisk tittel «Fly Oslo → Istanbul 10. nov | HelloSky» — aldri indeksert (parameterisert).
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
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">{t("sr.filter.maxprice")}</h3>
          <Slider
            aria-label={t("sr.filter.maxprice")}
            min={priceBounds.min}
            max={priceBounds.max}
            step={Math.max(100, Math.round((priceBounds.max - priceBounds.min) / 50))}
            value={[priceMax ?? priceBounds.max]}
            onValueChange={([v]) => setPriceMax(v >= priceBounds.max ? null : v)}
          />
          <p className="mt-2 text-sm text-muted-foreground">
            {t("sr.filter.upto")} <span className="font-semibold text-foreground">{formatMinor(priceMax ?? priceBounds.max, currency)}</span> {t("sr.filter.approxfee")}
          </p>
        </div>
      )}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">{t("sr.filter.stops")}</h3>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "all", label: "sr.time.all" },
              { key: "direct", label: "sr.filter.direct" },
              { key: "max1", label: "sr.filter.max1" },
            ] as const
          ).map((o) => (
            <button key={o.key} type="button" onClick={() => setStopsFilter(o.key)} aria-pressed={stopsFilter === o.key} className={chipCls(stopsFilter === o.key)}>
              {t(o.label)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">{t("sr.filter.ticket")}</h3>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 transition-colors hover:bg-secondary/60">
          <input type="checkbox" checked={baggageOnly} onChange={(e) => setBaggageOnly(e.target.checked)} className="h-5 w-5 accent-primary" />
          <span className="text-sm">{t("sr.filter.baggage")}</span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 transition-colors hover:bg-secondary/60">
          <input type="checkbox" checked={refundableOnly} onChange={(e) => setRefundableOnly(e.target.checked)} className="h-5 w-5 accent-primary" />
          <span className="text-sm">{t("sr.filter.refundable")}</span>
        </label>
      </div>
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">{t("sr.filter.deptime")}</h3>
        <div className="flex flex-wrap gap-2">
          {TIME_BANDS.map((o) => (
            <button key={o.key} type="button" onClick={() => setDepTime(o.key)} aria-pressed={depTime === o.key} className={chipCls(depTime === o.key)}>
              {t(o.label)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">{t("sr.filter.arrtime")}</h3>
        <div className="flex flex-wrap gap-2">
          {TIME_BANDS.map((o) => (
            <button key={o.key} type="button" onClick={() => setArrTime(o.key)} aria-pressed={arrTime === o.key} className={chipCls(arrTime === o.key)}>
              {t(o.label)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">{t("sr.filter.maxduration")}</h3>
        <div className="flex flex-wrap gap-2">
          {[0, 6, 10, 15, 24].map((h) => (
            <button key={h} type="button" onClick={() => setMaxDurationH(h)} aria-pressed={maxDurationH === h} className={chipCls(maxDurationH === h)}>
              {h === 0 ? t("sr.filter.unlimited") : formatDuration(h * 60)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">{t("sr.filter.maxlayover")}</h3>
        <div className="flex flex-wrap gap-2">
          {[0, 2, 4, 6].map((h) => (
            <button key={h} type="button" onClick={() => setMaxLayoverH(h)} aria-pressed={maxLayoverH === h} className={chipCls(maxLayoverH === h)}>
              {h === 0 ? t("sr.filter.unlimited") : formatDuration(h * 60)}
            </button>
          ))}
        </div>
      </div>
      {originOptions.length > 1 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">{t("sr.filter.origin")}</h3>
          <div className="space-y-1">
            {originOptions.map(([code, name]) => (
              <label key={code} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 transition-colors hover:bg-secondary/60">
                <input type="checkbox" checked={originAirports.includes(code)} onChange={(e) => toggleIn(originAirports, setOriginAirports, code, e.target.checked)} className="h-5 w-5 accent-primary" />
                <span className="flex-1 text-sm">{name}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-foreground">{code}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {destOptions.length > 1 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">{t("sr.filter.dest")}</h3>
          <div className="space-y-1">
            {destOptions.map(([code, name]) => (
              <label key={code} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 transition-colors hover:bg-secondary/60">
                <input type="checkbox" checked={destAirports.includes(code)} onChange={(e) => toggleIn(destAirports, setDestAirports, code, e.target.checked)} className="h-5 w-5 accent-primary" />
                <span className="flex-1 text-sm">{name}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-foreground">{code}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {availableAirlines.length > 1 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">{t("sr.filter.airlines")}</h3>
          <div className="space-y-1">
            {availableAirlines.map(([code, name]) => (
              <label key={code} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 transition-colors hover:bg-secondary/60">
                <input type="checkbox" checked={airlines.includes(code)} onChange={(e) => toggleIn(airlines, setAirlines, code, e.target.checked)} className="h-5 w-5 accent-primary" />
                <span className="flex-1 text-sm">{name}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-foreground">{code}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {activeFilters > 0 && (
        <button type="button" onClick={resetFilters} className="min-h-11 w-full rounded-full border hairline text-sm font-medium hover:border-foreground/25">
          {t("sr.filter.resetcount", { count: activeFilters })}
        </button>
      )}
    </div>
  );

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      {/* summary bar */}
      <div className="border-b border-border bg-muted/40 pt-24">
        <div className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              {isMulti ? (
                <h1 className="font-display text-2xl sm:text-3xl">
                  {t("sr.multicity")} · {legs.map((l) => l.from!.iata).join("–")}–{legs[legs.length - 1].to!.iata}
                </h1>
              ) : (
                <h1 className="font-display text-2xl sm:text-3xl">
                  {fromAirport?.city ?? from} <ArrowRight className="inline h-5 w-5 text-foreground" aria-label={t("sr.to")} /> {toAirport?.city ?? to}
                </h1>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {isMulti ? legs.map((l) => formatDateShort(l.date)).join(" · ") : `${formatDateShort(depart)}${ret ? ` – ${formatDateShort(ret)}` : ` · ${t("sr.oneway")}`}`}
                {" · "}
                {t("common.pax", { count: passengers.length })} · {cabinLabel(cabin)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditOpen((o) => !o)}
              aria-expanded={editOpen}
              className="flex min-h-11 items-center gap-2 rounded-full border hairline px-4 text-sm font-medium text-foreground transition-colors hover:border-foreground/25"
            >
              <PencilLine className="h-4 w-4" aria-hidden="true" /> {t("sr.edit")}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${editOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {!isMulti && depart && priceAlertsAvailable && (
              <button
                type="button"
                onClick={() => {
                  setAlertOpen((o) => !o);
                  createAlert.reset();
                  if (!alertEmail && customer?.email) setAlertEmail(customer.email);
                }}
                aria-expanded={alertOpen}
                className={cn("flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors", alertOpen ? "border-foreground/25 bg-muted text-foreground" : "hairline text-foreground hover:border-foreground/25")}
              >
                <Bell className="h-4 w-4" aria-hidden="true" /> {t("sr.alert")}
              </button>
            )}
            {result?.demoMode && (
              <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">{t("sr.demo")}</span>
            )}
          </div>

          {editOpen && (
            <div className="fade-up mt-5 max-w-3xl">
              <SearchWidget key={location.search} initial={widgetInitial} />
            </div>
          )}

          {alertOpen && !isMulti && depart && priceAlertsAvailable && (
            <div className="fade-up mt-5 max-w-md rounded-3xl border border-border bg-white p-5 shadow-soft">
              <h2 className="font-display text-lg">{t("sr.alert.title")}</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {t("sr.alert.body", { route: `${fromAirport?.city ?? from} → ${toAirport?.city ?? to}`, date: formatDateShort(depart) })}
              </p>
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  createAlert.mutate({ email: alertEmail.trim(), origin: from, destination: to, departDate: depart, targetPrice: Number(alertTarget) });
                }}
              >
                <label className="block">
                  <span className="sr-only">{t("common.emailaddress")}</span>
                  <input type="email" required value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} placeholder={t("sr.alert.emailph")} className="min-h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:border-foreground/30" />
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1">
                    <span className="sr-only">{t("sr.alert.target")}</span>
                    <input
                      type="number"
                      required
                      min={100}
                      value={alertTarget}
                      onChange={(e) => setAlertTarget(e.target.value)}
                      placeholder={summary ? t("sr.alert.eg", { amount: Math.max(100, Math.round(totalOf(summary.cheapest) / 100) - 200) }) : t("sr.alert.targetph")}
                      className="min-h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:border-foreground/30"
                    />
                  </label>
                  <span className="text-sm font-semibold text-muted-foreground">kr</span>
                </div>
                {createAlert.isError && (
                  <p role="alert" className="text-[12px] font-medium text-coral">
                    {humanMessage(createAlert.error)}
                  </p>
                )}
                <button type="submit" disabled={createAlert.isPending} className="min-h-11 w-full rounded-full bg-night text-sm font-bold text-white transition-colors hover:brightness-125 disabled:opacity-50">
                  {createAlert.isPending ? t("sr.alert.saving") : t("sr.alert.activate")}
                </button>
                {createAlert.isSuccess && <p className="text-[12px] font-semibold text-emerald-700">{t("sr.alert.active")}</p>}
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ±3-day price strip + priskalender */}
      {stripDates.length > 0 && (
        <div className="border-b hairline bg-muted/50">
          <div className="no-scrollbar mx-auto flex w-full max-w-6xl items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6">
            {stripDates.map((d) => {
              const active = d === depart;
              const amount = hintByDate.get(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => goDate(d)}
                  aria-pressed={active}
                  className={cn("min-h-[52px] min-w-24 shrink-0 rounded-3xl border px-3 py-2 text-center transition-colors", active ? "border-foreground/25 bg-muted" : "hairline hover:border-accent/60")}
                >
                  <span className="block text-xs font-semibold text-foreground">{formatDateShort(d)}</span>
                  <span className={cn("mt-0.5 block text-[11px]", active ? "text-foreground/80" : "text-muted-foreground")}>
                    {amount ? t("sr.strip.from", { price: formatPrice(amount, "NOK") }) : hints.isLoading ? "…" : t("sr.strip.search")}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCalOpen((o) => !o)}
              aria-expanded={calOpen}
              className={cn("flex min-h-[52px] shrink-0 items-center gap-2 rounded-3xl border px-4 text-xs font-semibold transition-colors", calOpen ? "border-foreground/25 bg-night text-white" : "hairline text-foreground hover:border-foreground/25")}
            >
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {t("sr.flexible")}
            </button>
          </div>
          {calOpen && (
            <div className="mx-auto w-full max-w-6xl px-4 pb-4 sm:px-6">
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

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl gap-8 px-4 py-8 outline-none sm:px-6 lg:grid lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-3xl border hairline bg-card p-5">
            <h2 className="mb-5 flex items-center gap-2 font-display text-xl">
              <Filter className="h-4 w-4 text-foreground" aria-hidden="true" /> {t("sr.filter")}
            </h2>
            {filterPanel}
          </div>
        </aside>

        <section>
          {/* Gyldighet */}
          {result && offersExpired && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-primary/40 bg-primary/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                <TimerReset className="h-4 w-4" aria-hidden="true" /> {t("sr.expired")}
              </p>
              <button type="button" onClick={doSearch} className="min-h-11 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">
                {t("common.searchagain")}
              </button>
            </div>
          )}

          {summary && !search.isPending && (
            <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { key: "best" as SortKey, label: t("sr.sort.best"), offer: summary.best, icon: ThumbsUp },
                { key: "cheapest" as SortKey, label: t("sr.sort.cheapest"), offer: summary.cheapest, icon: Wallet },
                { key: "fastest" as SortKey, label: t("sr.sort.fastest"), offer: summary.fastest, icon: Rabbit },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  aria-pressed={sort === s.key}
                  className={cn("min-h-11 rounded-3xl border p-3 text-left transition-colors sm:p-4", sort === s.key ? "border-foreground/25 bg-muted" : "hairline bg-card hover:border-accent/60")}
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <s.icon className="h-3.5 w-3.5 text-foreground" aria-hidden="true" /> {s.label}
                  </span>
                  <span className="mt-1 block font-display text-lg text-foreground sm:text-xl">{formatMinor(totalOf(s.offer), s.offer.totalCurrency)}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {formatDuration(sliceDuration(s.offer))} · {s.offer.owner.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* sort + mobile filter row */}
          <div className="mb-5 flex items-center gap-2">
            {/* Mobil: horisontalt rullbar rad med snap og luft til høyre, så siste chip («Raskest») aldri kuttes. */}
            <div
              role="radiogroup"
              aria-label={t("sr.sorting")}
              className="no-scrollbar -mx-4 flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto px-4 pr-8 sm:mx-0 sm:px-0 sm:pr-0"
            >
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={sort === s.key}
                  onClick={() => setSort(s.key)}
                  className={cn("shrink-0 snap-start whitespace-nowrap", chipCls(sort === s.key))}
                >
                  {t(s.label)}
                </button>
              ))}
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <button type="button" className="relative flex min-h-11 shrink-0 items-center gap-2 rounded-full border hairline px-4 text-sm font-medium lg:hidden">
                  <Filter className="h-4 w-4" aria-hidden="true" /> {t("sr.filter.short")}
                  {activeFilters > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">{activeFilters}</span>
                  )}
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-3xl border-t hairline bg-card text-foreground">
                <h2 className="mb-5 font-display text-2xl">{t("sr.filter.title")}</h2>
                {filterPanel}
              </SheetContent>
            </Sheet>
          </div>

          {search.isPending && (
            <div className="space-y-4" aria-live="polite" aria-busy="true">
              <div className="overflow-hidden rounded-3xl border border-border bg-card px-5 py-6 text-center">
                <div className="relative mx-auto max-w-xs">
                  <svg viewBox="0 0 320 44" className="w-full text-primary" aria-hidden="true">
                    <path d="M8 34 C 90 6, 230 6, 312 28" fill="none" stroke="currentColor" strokeWidth="1.5" className="route-dash" opacity="0.4" />
                    <circle cx="8" cy="34" r="4" fill="currentColor" opacity="0.5" />
                    <circle cx="312" cy="28" r="4" fill="currentColor" />
                  </svg>
                  <Plane className="plane-fly absolute left-0 top-0 h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">{t("sr.searching", { to: toAirport ? t("sr.searching.to", { city: toAirport.city }) : "" })}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("sr.searching.sub")}</p>
              </div>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {search.isError && (
            <div role="alert" className="rounded-3xl border border-primary/40 bg-card p-8 text-center">
              <TriangleAlert className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
              <h2 className="mt-4 font-display text-2xl">{t("sr.error.title")}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{humanMessage(search.error)}</p>
              <button type="button" onClick={doSearch} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t("common.retry")}
              </button>
            </div>
          )}

          {result && !filtered.length && (
            <div className="rounded-3xl border hairline bg-card p-8 text-center">
              <SearchX className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <h2 className="mt-4 font-display text-2xl">{allOffers.length ? t("sr.empty.filtered") : t("sr.empty.none")}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{allOffers.length ? t("sr.empty.filteredsub") : t("sr.empty.nonesub")}</p>
              {allOffers.length > 0 && (
                <button type="button" onClick={resetFilters} className="mt-6 min-h-11 rounded-3xl border hairline px-6 text-sm font-medium hover:border-foreground/25 hover:text-foreground">
                  {t("sr.filter.reset")}
                </button>
              )}
            </div>
          )}

          {result && filtered.length > 0 && (
            <div className="space-y-4" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <p>
                  {t("sr.results", { count: filtered.length })}
                  {activeFilters > 0 ? ` ${t("sr.results.of", { count: allOffers.length })}` : ""}
                </p>
                {expiresInMin !== null && expiresInMin > 0 && <p className="text-xs">{t("sr.validfor", { count: expiresInMin })}</p>}
              </div>
              {filtered.slice(0, visible).map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  onSelect={selectOffer}
                  comparing={compareIds.includes(offer.id)}
                  compareDisabled={compareIds.length >= 3}
                  onToggleCompare={toggleCompare}
                  shareText={shareText(offer)}
                />
              ))}
              {visible < filtered.length && (
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="min-h-12 w-full rounded-full border hairline text-sm font-semibold transition-colors hover:border-foreground/25"
                >
                  {t("sr.more", { count: filtered.length - visible })}
                </button>
              )}
              <p className="pt-2 text-center text-xs text-muted-foreground">
                {t("sr.disclaimer")}
              </p>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />

      <CompareTray offers={compareOffers} onRemove={(id) => setCompareIds((p) => p.filter((x) => x !== id))} onClear={() => setCompareIds([])} onSelect={selectOffer} />
    </div>
  );
}
