import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { ArrowUpDown, Bell, CalendarDays, Check, ChevronDown, Info, RefreshCw, SlidersHorizontal, TimerReset } from "lucide-react";
import { trpc } from "@/providers/trpc";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import HeroBar from "@/components/app/HeroBar";
import ServiceTabs from "@/components/app/ServiceTabs";
import { SERVICES, type ServiceId } from "@/components/app/services";
import { carSearchHref, hotelSearchHref } from "@/components/stays/stayLinks";
import { DESTINATIONS } from "@/content/discover";
import { useSavedDestinations } from "@/lib/useAccount";
import { useCollections } from "@/lib/collections";
import OfferCard from "@/components/offers/OfferCard";
import { CurrencyNote } from "@/components/stays/StayLayout";
import { partyLabel, providerName } from "@/components/offers/offerUtils";
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
import { cabinLabel, formatClock, formatDateShort, formatDayMonth, formatDuration, formatMinor, formatPrice, layoverInfo, previewTotalMinor, toMinor } from "@/lib/format";
import { useFeeConfig } from "@/lib/useFeeConfig";
import { useLocale, useT, type I18nKey } from "@/lib/i18n";
import { searchSessionId } from "@/lib/kayakSession";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { PREFERENCES, isFamily, isPreference, rank, type Preference } from "@/lib/offers";
import { ConnectionProblemSpot, NoFlightsSpot, SkeletonFlightCard } from "@/components/graphics";
import { cn } from "@/lib/utils";
import { DEFAULT_CHILD_AGE, DEFAULT_INFANT_AGE, passengersFromParams } from "@/components/search/searchQuery";

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

// KAYAK er ikke flyleverandør lenger: gamle lenker med provider=kayak søker som vanlig (Duffel).
const PROVIDERS = ["duffel", "travelport", "demo"] as const;
type ProviderParam = (typeof PROVIDERS)[number];
const providerParam = (v: string | null): ProviderParam | undefined => (PROVIDERS as readonly string[]).includes(v ?? "") ? (v as ProviderParam) : undefined;

export default function SearchResults() {
  const t = useT();
  const feeConfig = useFeeConfig();
  const { currency: preferredCurrency } = useLocale();
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
  const directOnly = params.get("direct") === "1";
  const requestedProvider = providerParam(params.get("provider"));

  const slices = useMemo<SearchSliceInput[]>(() => {
    if (isMulti) return legs.map((l) => ({ origin: l.from!.iata, destination: l.to!.iata, departureDate: l.date }));
    if (!from || !to || !depart) return [];
    const s: SearchSliceInput[] = [{ origin: from, destination: to, departureDate: depart }];
    if (ret) s.push({ origin: to, destination: from, departureDate: ret });
    return s;
  }, [isMulti, legs, from, to, depart, ret]);

  // Antallet i lenken er fasit; alderslistene presiserer den. Se
  // passengersFromParams – lagrede og nylige søk bærer bare antall.
  const passengers = useMemo<SearchPassengerInput[]>(() => passengersFromParams(params), [params]);
  const childAges = useMemo(() => passengers.filter((p) => p.type === "child").map((p) => p.age ?? DEFAULT_CHILD_AGE), [passengers]);
  const infantAges = useMemo(() => passengers.filter((p) => p.type === "infant_without_seat").map((p) => p.age ?? DEFAULT_INFANT_AGE), [passengers]);
  const family = isFamily(passengers);

  const search = trpc.flights.search.useMutation();
  const serviceStatus = trpc.flights.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const [sort, setSort] = useState<SortKey>(() => (isPreference(sortParam) ? sortParam : "best"));
  const [stopsFilter, setStopsFilter] = useState<"all" | "direct" | "max1">("all");
  const [airlines, setAirlines] = useState<string[]>([]);
  const [baggageOnly, setBaggageOnly] = useState(false);
  const [airlineDirectOnly, setAirlineDirectOnly] = useState(false);
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
  const [sortOpen, setSortOpen] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const collections = useCollections((city) => t("sv.trip", { city }));
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [now, setNow] = useState(() => Date.now());
  const { customer } = useCustomer();
  const recordSearch = useRecordSearch();
  const createAlert = trpc.extras.createPriceAlert.useMutation({ onSuccess: () => setAlertTarget("") });

  const doSearch = () => {
    if (!slices.length) return;
    setVisible(PAGE_SIZE);
    setPriceMax(null);
    search.mutate({
      slices,
      passengers,
      cabinClass: cabin,
      currency: preferredCurrency,
      ...(directOnly ? { directOnly: true } : {}),
      ...(requestedProvider ? { provider: requestedProvider } : {}),
      sessionId: searchSessionId(),
    });
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
  // Metasøk: kunden bestiller hos leverandøren – ingen HelloSky-gebyr på prisen.
  const externalBooking = result?.bookingMode === "external";

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
      direct: directOnly,
      provider: requestedProvider,
    }),
    [from, to, depart, ret, isMulti, legs, params, childAges, infantAges, cabin, sortParam, directOnly, requestedProvider],
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
  const totalOf = useCallback(
    (o: Offer) => (o.booking?.kind === "external" ? toMinor(o.totalAmount, o.totalCurrency) : previewTotalMinor(o.totalAmount, o.totalCurrency, feeConfig)),
    [feeConfig],
  );
  const hasAgencyOffers = useMemo(() => allOffers.some((o) => o.booking && o.booking.sellerKind !== "airline"), [allOffers]);
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
    if (airlineDirectOnly) offers = offers.filter((o) => !o.booking || o.booking.sellerKind === "airline");
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
  }, [allOffers, totalOf, sort, stopsFilter, airlines, baggageOnly, airlineDirectOnly, refundableOnly, depTime, arrTime, maxDurationH, maxLayoverH, priceMax, originAirports, destAirports]);

  const summary = useMemo(() => {
    if (!allOffers.length) return null;
    const pick = (p: Preference) => rank(allOffers, p, totalOf)[0];
    return { best: pick("best"), cheapest: pick("cheapest"), fastest: pick("fastest"), family: family ? pick("family") : null };
  }, [allOffers, totalOf, family]);

  const fromAirport = airportByIata(from);
  const toAirport = airportByIata(to);
  // Hjertet i toppen lagrer reisemålet – når det er et vi kjenner.
  const heroDest = useMemo(() => (isMulti ? undefined : DESTINATIONS.find((d) => d.iata === to)), [isMulti, to]);
  const { ids: savedIds, toggle: toggleSaved } = useSavedDestinations();

  // «Lagre» på et kort: tilbudet inn i samlingen for reisemålet, med prisen slik den var nå.
  const toggleSaveOffer = (o: Offer) => {
    if (collections.savedOfferIds.has(o.id)) {
      collections.unsaveOffer(o.id);
      setSaveNote("");
      return;
    }
    const first = o.slices[0];
    const last = o.slices[o.slices.length - 1];
    const c = collections.saveFlight({
      offerId: o.id,
      from: first.origin.iata,
      to: first.destination.iata,
      fromCity: airportByIata(first.origin.iata)?.city ?? first.origin.city,
      toCity: airportByIata(first.destination.iata)?.city ?? first.destination.city,
      depart: first.departingAt.slice(0, 10),
      ret: o.slices.length > 1 ? last.departingAt.slice(0, 10) : undefined,
      airline: o.owner.name,
      airlineIata: o.owner.iata,
      provider: providerName(o),
      priceMinor: totalOf(o),
      currency: o.totalCurrency,
      travellers: o.passengers.length,
      searchHref: `/sok${location.search}`,
    });
    setSaveNote(t("sv.saved.toast", { title: c.title }));
  };
  // Samme datoer og reisende med over til hotell og leiebil; cruise sier ærlig fra.
  const serviceHref = (id: ServiceId) => {
    if (id === "hotell" && toAirport && depart) return hotelSearchHref({ dest: "", place: toAirport.city, checkin: depart, checkout: ret ?? new Date(Date.parse(depart) + 3 * 86_400_000).toISOString().slice(0, 10), adults: Math.max(1, Number(params.get("adults") ?? 1)), rooms: 1 });
    if (id === "bil" && toAirport && depart) return carSearchHref({ type: "airport", value: toAirport.iata, place: `${toAirport.city} (${toAirport.iata})`, pickup: depart, dropoff: ret ?? new Date(Date.parse(depart) + 3 * 86_400_000).toISOString().slice(0, 10) });
    return SERVICES.find((s) => s.id === id)!.to;
  };

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
    // Ekstern bestilling: kunden går til leverandøren via KAYAKs offisielle
    // klikklenke. Ingen checkout hos HelloSky – vi verken selger eller utsteder.
    if (offer.booking?.kind === "external") {
      window.open(offer.booking.url, "_blank", "noopener,noreferrer");
      return;
    }
    sessionStorage.setItem(`hellosky:offer:${offer.id}`, JSON.stringify(offer));
    sessionStorage.setItem(`hellosky:offerctx:${offer.id}`, location.search);
    navigate(`/bestill?offer=${encodeURIComponent(offer.id)}`);
  };

  const compareOffers = useMemo(() => compareIds.map((id) => allOffers.find((o) => o.id === id)).filter((o): o is Offer => Boolean(o)), [compareIds, allOffers]);
  const toggleCompare = (offer: Offer) =>
    setCompareIds((prev) => (prev.includes(offer.id) ? prev.filter((x) => x !== offer.id) : prev.length >= 3 ? prev : [...prev, offer.id]));

  const shareText = (o: Offer) => {
    // Første strekning sier hvor reisen går; siste strekning på en tur/retur ender der den startet.
    const route = `${o.slices[0].origin.iata} → ${o.slices[0].destination.iata}`;
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
    setAirlineDirectOnly(false);
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
    (airlineDirectOnly ? 1 : 0) +
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
            {t("sr.filter.upto")} <span className="font-semibold tabular text-foreground">{formatMinor(priceMax ?? priceBounds.max, currency)}</span>
            {externalBooking ? "" : ` ${t("sr.filter.approxfee")}`}
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
        {hasAgencyOffers && <CheckRow checked={airlineDirectOnly} onChange={setAirlineDirectOnly} label={t("sr.filter.airlinedirect")} />}
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

  // Sorteringsfanene: Anbefalt · Billigst · Raskest (+ Familie når det reiser barn).
  // Alltid alle tre, også når samme fly vinner alle – rekkefølgen under er fortsatt ulik.
  const tabKeys: SortKey[] = summary?.family ? ["best", "cheapest", "fastest", "family"] : ["best", "cheapest", "fastest"];
  const tabs: { key: SortKey; label: string; offer: Offer | null }[] = summary
    ? tabKeys.map((key) => ({
        key,
        label: key === "best" ? t("sr.sort.recommended") : t(PREFERENCES.find((p) => p.key === key)!.label),
        offer: key === "family" ? summary.family : summary[key as "best" | "cheapest" | "fastest"],
      }))
    : [];

  // ±3-dagers prisstripe + priskalender: i «Endre søk»-panelet, sammen med resten av søket.
  const priceStrip = stripDates.length > 0 && (
    <div className="mt-4">
      <div className="no-scrollbar -mx-5 flex items-center gap-2 overflow-x-auto px-5 py-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0">
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
                "min-h-12 min-w-[88px] shrink-0 rounded-xl border px-3 py-1.5 text-center transition-colors",
                active ? "border-petrol bg-petrol text-white" : "border-border bg-white text-foreground hover:bg-secondary",
              )}
            >
              <span className="block text-[12px] font-medium">{formatDateShort(d)}</span>
              <span className={cn("mt-0.5 block text-[11px] tabular", active ? "text-white/80" : "text-muted-foreground")}>
                {amount ? t("sr.strip.from", { price: formatPrice(amount, "NOK") }) : hints.isLoading ? "…" : t("sr.strip.search")}
              </span>
            </button>
          );
        })}
        <Chip selected={calOpen} onClick={() => setCalOpen((o) => !o)} aria-expanded={calOpen} className="min-h-12 rounded-xl" icon={<CalendarDays aria-hidden="true" />}>
          {t("sr.flexible")}
        </Chip>
      </div>
      {calOpen && (
        <div className="fade-up mt-2 max-w-md">
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
      )}
    </div>
  );

  // Alle sorteringene i én liste: de tre (fire) hovedvalgene med sitt beste tilbud, så resten.
  const sortOptions: { key: SortKey; label: string; hint?: string; offer: Offer | null }[] = [
    ...tabs,
    ...PREFERENCES.filter((p) => !tabKeys.includes(p.key)).map((p) => ({ key: p.key as SortKey, label: t(p.label), hint: t(p.hint), offer: null })),
    { key: "earliest", label: t("sr.sort.earliest"), offer: null },
  ];
  const sortLabel = sortOptions.find((o) => o.key === sort)?.label ?? t("sr.sort.recommended");

  const sortList = (
    <ul role="radiogroup" aria-label={t("sr.sort.title")} className="divide-y divide-border">
      {sortOptions.map((o) => {
        const on = sort === o.key;
        return (
          <li key={o.key}>
            <button
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setSort(o.key);
                setSortOpen(false);
              }}
              className="flex min-h-14 w-full items-center gap-3 px-1 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[17px]", on ? "font-bold text-petrol" : "font-medium text-foreground")}>{o.label}</span>
                {o.offer ? (
                  <span className="block text-[14px] text-muted-foreground">
                    {formatMinor(totalOf(o.offer), o.offer.totalCurrency)} · {formatDuration(sliceDuration(o.offer))} · {o.offer.owner.name}
                  </span>
                ) : o.hint ? (
                  <span className="block text-[14px] text-muted-foreground">{o.hint}</span>
                ) : null}
              </span>
              {on && <Check className="size-6 shrink-0 text-petrol" aria-hidden="true" />}
            </button>
          </li>
        );
      })}
    </ul>
  );

  /**
   * En lenke uten reisemål eller dato er ikke en feil, det er et uferdig søk.
   * Før falt siden i feilgrensen fordi datoformatereren fikk en tom streng.
   * Nå får du søket, ferdig åpnet, i stedet for et teknisk sammenbrudd.
   */
  if (!isMulti && slices.length === 0) {
    return (
      <div className="relative min-h-screen bg-background">
        <div className="hidden lg:block"><SiteHeader /></div>
        <main id="main" tabIndex={-1} className="container-x pb-20 pt-6 outline-none lg:pt-28">
          <HeroBar backTo="/" tone="dark" className="lg:hidden" />
          <h1 className="t-h1 mt-6">{t("sr.nosearch.title")}</h1>
          <p className="t-lead mt-3 max-w-lg">{t("sr.nosearch.body")}</p>
          <div className="mt-8">
            <SearchWidget initial={widgetInitial} />
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const title = isMulti ? (
    <>
      {t("sr.multicity")} · {legs.map((l) => l.from!.iata).join("–")}–{legs[legs.length - 1].to!.iata}
    </>
  ) : (
    <>
      {fromAirport?.city ?? from} <span aria-label={t("sr.to")}>→</span> {toAirport?.city ?? to}
    </>
  );
  // «16. okt. · Én vei · 1 voksen»
  const summaryLine = (
    <>
      {isMulti ? legs.map((l) => formatDayMonth(l.date)).join(" · ") : ret ? `${formatDayMonth(depart)} – ${formatDayMonth(ret)} · ${t("sr.roundtrip.cap")}` : `${formatDayMonth(depart)} · ${t("sr.oneway.cap")}`}
      {" · "}
      {partyLabel(passengers, t)}
      {cabin !== "economy" ? ` · ${cabinLabel(cabin)}` : ""}
    </>
  );
  const heroBar = (
    <HeroBar
      backTo="/"
      tone="dark"
      saved={heroDest ? savedIds.has(heroDest.id) : undefined}
      onToggleSaved={heroDest ? () => toggleSaved(heroDest.id) : undefined}
      saveLabel={heroDest ? (savedIds.has(heroDest.id) ? t("sr.unsavedest", { city: heroDest.city }) : t("sr.savedest", { city: heroDest.city })) : undefined}
      className="lg:hidden"
    />
  );

  return (
    <div className="relative min-h-screen bg-background">
      <div className="hidden lg:block"><SiteHeader /></div>

      {/* Den mintgrønne toppen: ruten, datoen og reisefølget, og «Endre søk». */}
      <header className="bg-mint text-petrol lg:mt-16">
        <div className="container-x pb-5 pt-[max(8px,env(safe-area-inset-top))] lg:pb-7 lg:pt-6">
          {heroBar}
          <h1 className="t-display mt-4 lg:mt-2">{title}</h1>
          <p className="mt-1.5 text-[18px] font-medium">{summaryLine}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditOpen((o) => !o)}
              aria-expanded={editOpen}
              className="inline-flex h-12 items-center gap-2.5 rounded-xl bg-petrol/10 px-4 text-[17px] font-semibold text-petrol transition-colors hover:bg-petrol/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <CalendarDays className="size-6" aria-hidden="true" />
              {t("sr.edit")}
              <ChevronDown className={cn("size-4 transition-transform", editOpen && "rotate-180")} aria-hidden="true" />
            </button>
            {!isMulti && depart && priceAlertsAvailable && (
              <Button
                variant={alertOpen ? "subtle" : "ghost"}
                size="md"
                className="h-12 rounded-xl text-[15px] hover:bg-petrol/10"
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
            {result?.demoMode && <span className="rounded-lg bg-warning/10 px-2.5 py-1.5 text-[13px] font-semibold text-warning">{t("sr.demo")}</span>}
            {result?.sandbox && !result.demoMode && (
              <span role="status" className="rounded-lg bg-warning/10 px-2.5 py-1.5 text-[13px] font-semibold text-warning">
                {t("sr.sandbox")}
              </span>
            )}
          </div>
        </div>
        {allOffers.length > 0 && <CurrencyNote currency={currency} preferred={preferredCurrency} />}
      </header>

      <div className="container-x pt-4">
        <ServiceTabs variant="pill" active="fly" hrefFor={serviceHref} />

        {editOpen && (
          <div className="fade-up mt-4 max-w-4xl">
            <SearchWidget key={location.search} initial={widgetInitial} variant="compact" />
            {priceStrip}
          </div>
        )}

        {alertOpen && !isMulti && depart && priceAlertsAvailable && (
          <div className="card-soft fade-up mt-5 max-w-md p-5">
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

      {/* min-h keeps the footer below the fold while results stream in, so the skeleton→cards swap doesn't shift it (CLS). */}
      <main id="main" tabIndex={-1} className="container-x min-h-[100dvh] gap-8 py-4 outline-none sm:py-6 lg:grid lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <div className="card-soft sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto p-5">
            <h2 className="mb-5 flex items-center gap-2 text-[17px] font-medium">
              <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" /> {t("sr.filter")}
            </h2>
            {filterPanel}
          </div>
        </aside>

        <section>
          {result && offersExpired && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning/10 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-warning">
                <TimerReset className="size-4" aria-hidden="true" /> {t("sr.expired")}
              </p>
              <Button size="sm" className="rounded-full" onClick={doSearch}>
                {t("common.searchagain")}
              </Button>
            </div>
          )}

          {/* Filtrer og Sorter: to store kontroller, som i referansen. Filtrene bor i sidestolpen fra lg. */}
          <div className="mb-4 grid grid-cols-[auto_1fr] gap-3 lg:grid-cols-[auto_auto] lg:justify-end">
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <button type="button" aria-label={t("sr.filters.open")} className="flex h-[52px] items-center gap-2.5 rounded-xl border border-border bg-white px-4 text-[16px] font-semibold text-petrol transition-colors hover:border-petrol/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden">
                  <SlidersHorizontal className="size-6 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t("sr.filter")}</span>
                  {activeFilters > 0 && <span className="ml-auto grid size-6 shrink-0 place-items-center rounded-full bg-petrol text-[12px] font-bold text-white">{activeFilters}</span>}
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-[20px]">
                <SheetHeader>
                  <SheetTitle>{t("sr.filter.title")}</SheetTitle>
                </SheetHeader>
                <SheetBody>{filterPanel}</SheetBody>
                <SheetFooter>
                  <Button size="lg" className="h-[52px] rounded-xl text-[17px] font-bold" onClick={() => setFiltersOpen(false)}>
                    {t("sr.filter.show", { count: filtered.length })}
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            <Sheet open={sortOpen} onOpenChange={setSortOpen}>
              <SheetTrigger asChild>
                <button type="button" aria-label={`${t("sr.sort.title")}: ${sortLabel}`} className="flex h-[52px] min-w-0 items-center gap-2.5 rounded-xl border border-border bg-white px-3.5 text-[16px] font-semibold text-petrol transition-colors hover:border-petrol/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:col-start-2 lg:px-4">
                  <ArrowUpDown className="size-6 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t("sr.sortby", { label: sortLabel })}</span>
                  <ChevronDown className="ml-auto size-5 shrink-0" aria-hidden="true" />
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-[20px]">
                <SheetHeader>
                  <SheetTitle>{t("sr.sort.title")}</SheetTitle>
                </SheetHeader>
                <SheetBody>{sortList}</SheetBody>
              </SheetContent>
            </Sheet>
          </div>
          {saveNote && (
            <p role="status" className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-lavender px-4 py-3 text-[15px] font-medium text-petrol">
              {saveNote}
              <Link to="/lagret" className="shrink-0 font-semibold text-azure-ink underline-offset-4 hover:underline">{t("sv.open")}</Link>
            </p>
          )}

          {search.isPending && (
            <div className="space-y-4" aria-live="polite" aria-busy="true">
              <div className="card-soft px-5 py-4">
                <p className="text-[15px] font-medium text-foreground">{t("sr.searching", { to: toAirport ? t("sr.searching.to", { city: toAirport.city }) : "" })}</p>
                <p className="mt-1 text-[13px] text-muted-foreground">{t("sr.searching.sub")}</p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full w-1/3 rounded-full bg-primary progress-slide" />
                </div>
              </div>
              <SkeletonFlightCard />
              <SkeletonFlightCard />
              <SkeletonFlightCard />
              <SkeletonFlightCard />
            </div>
          )}

          {search.isError && (
            <div role="alert" className="card-soft p-8 text-center">
              <ConnectionProblemSpot className="mx-auto" />
              <h2 className="t-h2 mt-4">{t("sr.error.title")}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{humanMessage(search.error)}</p>
              <Button className="mt-6 rounded-full" onClick={doSearch}>
                <RefreshCw aria-hidden="true" /> {t("common.retry")}
              </Button>
            </div>
          )}

          {result && !filtered.length && (
            <div className="card-soft p-8 text-center">
              <NoFlightsSpot className="mx-auto" />
              <h2 className="t-h2 mt-4">{allOffers.length ? t("sr.empty.filtered") : t("sr.empty.none")}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{allOffers.length ? t("sr.empty.filteredsub") : t("sr.empty.nonesub")}</p>
              {allOffers.length > 0 && (
                <Button variant="subtle" className="mt-6 rounded-full" onClick={resetFilters}>
                  {t("sr.filter.reset")}
                </Button>
              )}
            </div>
          )}

          {result && filtered.length > 0 && (
            <div className="space-y-3 sm:space-y-4" aria-live="polite">
              {/* «Testdata · Totalpris for 1 voksen»: hva tallene er, før det første kortet. */}
              <p className="text-[15px] leading-snug text-muted-foreground">
                {result.sandbox || result.demoMode ? `${t("sr.examples")} · ` : ""}
                {t("sr.totalfor", { party: partyLabel(passengers, t) })}
                {" · "}
                <span className="text-foreground">{t("sr.results", { count: filtered.length })}</span>
                {activeFilters > 0 ? ` ${t("sr.results.of", { count: allOffers.length })}` : ""}
                {!externalBooking ? ` · ${t("sr.totalnote")}` : ""}
                {expiresInMin !== null && expiresInMin > 0 ? ` · ${t("sr.validfor", { count: expiresInMin })}` : ""}
              </p>
              {result.partial && (
                <p role="status" className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {t("sr.partial")}
                </p>
              )}
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
                  saved={collections.savedOfferIds.has(offer.id)}
                  onToggleSave={toggleSaveOffer}
                />
                </div>
              ))}
              {visible < filtered.length && (
                <Button variant="outline" size="lg" className="h-[52px] w-full rounded-xl text-[17px] font-bold" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  {t("sr.more", { count: filtered.length - visible })}
                </Button>
              )}
              {/* Hvor bestillingen skjer, og hva du bør sjekke der. */}
              <div className="flex items-start gap-3 rounded-2xl bg-lavender px-4 py-4 text-[15px] leading-snug text-petrol">
                <Info className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
                <p>
                  {externalBooking ? t("sr.bookingnote") : t("sr.disclaimer")}
                  {externalBooking && <span className="mt-1 block text-[13px] text-muted-foreground">{t("sr.disclaimer.external")}</span>}
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />

      <CompareTray offers={compareOffers} onRemove={(id) => setCompareIds((p) => p.filter((x) => x !== id))} onClear={() => setCompareIds([])} onSelect={selectOffer} />
    </div>
  );
}
