import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { Bell, CalendarDays, Check, ChevronDown, Info, Luggage, Pencil, RefreshCw, SlidersHorizontal, TimerReset } from "lucide-react";
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
import ResultCard from "@/components/offers/ResultCard";
import { groupOffers } from "@/lib/itineraryGroups";
import OfferDetailsSheet from "@/components/offers/OfferDetailsSheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { CabinClass, Offer, SearchPassengerInput, SearchSliceInput } from "@contracts/types";
import { airportByIata } from "@contracts/airports";
import { cabinLabel, formatClock, formatDateShort, formatDayMonth, formatDuration, formatMinor, formatPrice, layoverInfo, previewTotalMinor, toMinor } from "@/lib/format";
import { useFeeConfig } from "@/lib/useFeeConfig";
import { useLocale, useT, type I18nKey } from "@/lib/i18n";
import { searchSessionId } from "@/lib/kayakSession";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { PREFERENCES, isFamily, isPreference, rank, type Preference } from "@/lib/offers";
import {
  activeFilterCount,
  applyFilters,
  clearFilters,
  filtersFromParams,
  searchRequestKey,
  type SearchFilters,
  type StopsFilter,
} from "@/lib/searchFilters";
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

const PROVIDERS = ["duffel", "travelport", "kayak", "demo"] as const;
type ProviderParam = (typeof PROVIDERS)[number];
const providerParam = (v: string | null): ProviderParam | undefined => (PROVIDERS as readonly string[]).includes(v ?? "") ? (v as ProviderParam) : undefined;

/**
 * Nabodatoer som ekte søk.
 *
 * «Prøv andre datoer» er et råd. Dette er lenker som faktisk kjører søket,
 * bygget av den søkestrengen brukeren allerede står i, så vi lover ingen
 * treff – bare et søk som er verdt å prøve.
 */
function NearbyDates({ links }: { links: { days: number; href: string; label: string }[] }) {
  const t = useT();
  if (!links.length) return null;
  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="text-[14px] font-semibold">{t("sr.nearby.title")}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {links.map((l) => (
          <Link
            key={l.days}
            to={l.href}
            className="press inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-[15px] font-semibold text-azure-ink hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function SearchResults() {
  const t = useT();
  const feeConfig = useFeeConfig();
  const { currency: preferredCurrency } = useLocale();
  const [params, setParams] = useSearchParams();
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
  /**
   * Budsjett og bagasjekrav kommer fra prisfinneren på forsiden – «maxpris»
   * og «bagasje» leses av filtermodellen sammen med resten, så lenkene fra
   * forsiden fortsetter å virke uendret.
   */
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
  /**
   * Filtrene bor i lenken, ikke i komponenten.
   *
   * Det gir tilbake/fram, oppdatering, deling og bokmerke gratis, og det
   * fjerner hele klassen av feil der komponenten og URL-en er uenige. Ett
   * sted å lese fra, ett sted å skrive til.
   */
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const patchFilters = useCallback(
    (patch: Partial<SearchFilters>) => {
      // Vi leser forrige tilstand ut av forrige lenke, aldri av en variabel
      // som kan være foreldet – to raske klikk skal ikke miste det første.
      setParams((prev) => applyFilters(prev, { ...filtersFromParams(prev), ...patch }), { replace: false, preventScrollReset: true });
    },
    [setParams],
  );

  const { sort, stops: stopsFilter, airlines, baggageOnly, airlineDirectOnly, refundableOnly, depTime, arrTime, maxDurationH, maxLayoverH, originAirports, destAirports } = filters;
  const priceMax = filters.priceMaxMinor;

  const setSort = useCallback((v: SortKey) => patchFilters({ sort: v }), [patchFilters]);
  const setStopsFilter = useCallback((v: StopsFilter) => patchFilters({ stops: v }), [patchFilters]);
  const setAirlines = useCallback((v: string[]) => patchFilters({ airlines: v }), [patchFilters]);
  const setBaggageOnly = useCallback((v: boolean) => patchFilters({ baggageOnly: v }), [patchFilters]);
  const setAirlineDirectOnly = useCallback((v: boolean) => patchFilters({ airlineDirectOnly: v }), [patchFilters]);
  const setRefundableOnly = useCallback((v: boolean) => patchFilters({ refundableOnly: v }), [patchFilters]);
  const setDepTime = useCallback((v: TimeBand) => patchFilters({ depTime: v }), [patchFilters]);
  const setArrTime = useCallback((v: TimeBand) => patchFilters({ arrTime: v }), [patchFilters]);
  const setMaxDurationH = useCallback((v: number) => patchFilters({ maxDurationH: v }), [patchFilters]);
  const setMaxLayoverH = useCallback((v: number) => patchFilters({ maxLayoverH: v }), [patchFilters]);
  const setPriceMax = useCallback((v: number | null) => patchFilters({ priceMaxMinor: v }), [patchFilters]);
  const setOriginAirports = useCallback((v: string[]) => patchFilters({ originAirports: v }), [patchFilters]);
  const setDestAirports = useCallback((v: string[]) => patchFilters({ destAirports: v }), [patchFilters]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [calOpen, setCalOpen] = useState(() => params.get("flex") === "1");
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertTarget, setAlertTarget] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailsOffer, setDetailsOffer] = useState<Offer | null>(null);
  const [headerPassed, setHeaderPassed] = useState(false);
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

  /**
   * Søket lytter på søkeparameterne, ikke på hele lenken. Et filterklikk
   * endrer URL-en, men ikke denne nøkkelen, så det koster ingen
   * leverandørkall – filtrering skjer på svaret vi allerede har.
   */
  const requestKey = searchRequestKey(params);
  useEffect(() => {
    doSearch();
    setEditOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  // Nye filtre gir en ny liste; da skal man se toppen av den, ikke side tre.
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [filterKey]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  /**
   * Toppen med ruten ruller bort når man begynner å lese tilbud; da overtar
   * den klebrige linjen og viser ruten i kortform. Én klebrig linje, ikke tre.
   */
  const headerSentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = headerSentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setHeaderPassed(!entry.isIntersecting), { rootMargin: "-72px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
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

  /** Filtrene alene. Fanene over listen leser herfra, slik at prisen de viser alltid finnes i listen under. */
  const filteredBase = useMemo(() => {
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
    return offers;
  }, [allOffers, totalOf, stopsFilter, airlines, baggageOnly, airlineDirectOnly, refundableOnly, depTime, arrTime, maxDurationH, maxLayoverH, priceMax, originAirports, destAirports]);

  const filtered = useMemo(() => {
    if (sort === "earliest") {
      return [...filteredBase].sort((a, b) => new Date(a.slices[0].departingAt).getTime() - new Date(b.slices[0].departingAt).getTime());
    }
    return rank(filteredBase, sort, totalOf);
  }, [filteredBase, sort, totalOf]);

  // Samme reise solgt av flere kanaler blir ett kort. Grupperingen skjer etter
  // filtrering og rangering, så den kan verken skjule en reise eller flytte på
  // rekkefølgen – den slår bare sammen det som allerede var likt.
  const groups = useMemo(() => groupOffers(filtered, totalOf), [filtered, totalOf]);

  /**
   * «Ingen treff» skal ikke være en blindvei. Nabodatoene bygges av søket
   * brukeren allerede har gjort, så lenkene er ekte søk – ikke forslag vi
   * ikke kan innfri.
   */
  const nearbyDateLinks = useMemo(() => {
    if (isMulti || !depart) return [];
    const shift = (iso: string, days: number) => {
      const d = new Date(`${iso}T12:00:00Z`);
      if (Number.isNaN(d.getTime())) return null;
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const today = new Date().toISOString().slice(0, 10);
    return [-3, -1, 1, 3]
      .map((days) => {
        const nextDepart = shift(depart, days);
        const nextRet = ret ? shift(ret, days) : null;
        if (!nextDepart || nextDepart < today || (ret && !nextRet)) return null;
        const next = new URLSearchParams(params);
        next.set("depart", nextDepart);
        if (nextRet) next.set("ret", nextRet);
        return { days, href: `/sok?${next.toString()}`, label: formatDayMonth(nextDepart) };
      })
      .filter((x): x is { days: number; href: string; label: string } => x !== null);
  }, [isMulti, depart, ret, params]);

  const summary = useMemo(() => {
    if (!filteredBase.length) return null;
    const pick = (p: Preference) => rank(filteredBase, p, totalOf)[0];
    return { best: pick("best"), cheapest: pick("cheapest"), fastest: pick("fastest"), family: family ? pick("family") : null };
  }, [filteredBase, totalOf, family]);

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
    setParams((prev) => clearFilters(prev), { replace: false, preventScrollReset: true });
  };

  const activeFilters = activeFilterCount(filters);

  const toggleIn = (list: string[], set: (v: string[]) => void, code: string, on: boolean) => set(on ? [...list, code] : list.filter((x) => x !== code));

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
                setFiltersOpen(false);
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

  const filterPanel = (
    <div className="space-y-6">
      <FilterGroup title={t("sr.sort.title")}>{sortList}</FilterGroup>
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

  /**
   * Fanene over listen: tre måter å lese det samme utvalget på, hver med
   * prisen på det tilbudet som faktisk vinner den kategorien. Prisen er hentet
   * fra et tilbud som ligger i listen under – aldri en påstand om markedet.
   */
  const sortTabs = tabs.length > 0 && (
    // Bare på telefon og nettbrett. På desktop eier sidemenyen sorteringen,
    // og den viser alle seks intensjonene med pris, reisetid og selskap –
    // to kontroller for samme valg er én for mye.
    <div role="tablist" aria-label={t("sr.sort.title")} className={cn("grid border-b border-border lg:hidden", tabs.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
      {tabs.map((tab) => {
        const on = sort === tab.key;
        const price = tab.offer ? formatMinor(totalOf(tab.offer), tab.offer.totalCurrency) : null;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={price ? t("sr.tab.aria", { label: tab.label, price }) : tab.label}
            onClick={() => setSort(tab.key)}
            className={cn(
              "min-h-[58px] border-b-[3px] px-1.5 py-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
              on ? "border-primary bg-sky-soft" : "border-transparent hover:bg-muted/60",
            )}
          >
            <span className={cn("block truncate text-[13.5px] leading-tight", on ? "font-bold text-azure-ink" : "font-semibold text-muted-foreground")}>{tab.label}</span>
            <span className={cn("t-num mt-0.5 block truncate text-[16px] font-bold leading-tight", on ? "text-azure-ink" : "text-foreground")}>
              {price ?? t("sr.tab.nooffer")}
            </span>
          </button>
        );
      })}
    </div>
  );

  /** Filterknapp + de fire som faktisk brukes: stopp, bagasje, tider, selskap. */
  const quickFilterChip = "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[14px] font-semibold text-foreground transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  const quickFilters = (
    // Raden ruller. Den skal rulle fra kant til kant, ikke kuttes midt i et
    // ord innenfor sidemargen – da ser den ødelagt ut i stedet for rullbar.
    <div className="no-scrollbar -mx-5 flex items-center gap-2 overflow-x-auto px-5 py-2.5 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0">
      <button type="button" onClick={() => setFiltersOpen(true)} className={cn(quickFilterChip, activeFilters > 0 && "border-primary text-azure-ink")}>
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {t("sr.filter")}
        {activeFilters > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{activeFilters}</span>}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger className={cn(quickFilterChip, stopsFilter !== "all" && "border-primary text-azure-ink")}>
          {t("sr.q.stops")}
          <ChevronDown className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup value={stopsFilter} onValueChange={(v) => setStopsFilter(v as typeof stopsFilter)}>
            <DropdownMenuRadioItem value="all">{t("sr.time.all")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="direct">{t("sr.filter.direct")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="max1">{t("sr.filter.max1")}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className={cn(quickFilterChip, baggageOnly && "border-primary text-azure-ink")}>
          <Luggage className="size-4" aria-hidden="true" />
          {t("sr.q.baggage")}
          <ChevronDown className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup value={baggageOnly ? "checked" : "all"} onValueChange={(v) => setBaggageOnly(v === "checked")}>
            <DropdownMenuRadioItem value="all">{t("sr.time.all")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="checked">{t("sr.filter.baggage")}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className={cn(quickFilterChip, depTime !== "all" && "border-primary text-azure-ink")}>
          {t("sr.q.times")}
          <ChevronDown className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup value={depTime} onValueChange={(v) => setDepTime(v as TimeBand)}>
            {TIME_BANDS.map((b) => (
              <DropdownMenuRadioItem key={b.key} value={b.key}>
                {t(b.label)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {availableAirlines.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(quickFilterChip, airlines.length > 0 && "border-primary text-azure-ink")}>
            {t("sr.q.airlines")}
            {airlines.length > 0 && <span className="t-num">{airlines.length}</span>}
            <ChevronDown className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[60vh] overflow-y-auto">
            {availableAirlines.map(([code, name]) => (
              <DropdownMenuCheckboxItem
                key={code}
                checked={airlines.includes(code)}
                onCheckedChange={(on) => toggleIn(airlines, setAirlines, code, on === true)}
                onSelect={(e) => e.preventDefault()}
              >
                {name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

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
      {isMulti ? legs.map((l) => formatDayMonth(l.date)).join(" · ") : ret ? `${formatDayMonth(depart)} – ${formatDayMonth(ret)}` : `${formatDayMonth(depart)} · ${t("sr.oneway.cap")}`}
      {" · "}
      {partyLabel(passengers, t)}
      {cabin !== "economy" ? ` · ${cabinLabel(cabin)}` : ""}
    </>
  );
  const heroBar = (
    <HeroBar
      backTo="/"
      tone="light"
      saved={heroDest ? savedIds.has(heroDest.id) : undefined}
      onToggleSaved={heroDest ? () => toggleSaved(heroDest.id) : undefined}
      saveLabel={heroDest ? (savedIds.has(heroDest.id) ? t("sr.unsavedest", { city: heroDest.city }) : t("sr.savedest", { city: heroDest.city })) : undefined}
      className="lg:hidden"
    />
  );

  return (
    <div className="relative min-h-screen bg-background">
      <div className="hidden lg:block"><SiteHeader /></div>

      {/*
        Toppen: hvem som flyr hvor, når, og hvor mange – og én vei tilbake til
        søket. Den ruller bort når man begynner å lese tilbud; den klebrige
        linjen under overtar da med ruten i kortform, slik at skjermen viser
        tilbud og ikke kontroller.
      */}
      <header className="bg-petrol text-white lg:mt-16">
        <div className="container-x pb-4 pt-[max(6px,env(safe-area-inset-top))] lg:pb-5 lg:pt-5">
          {heroBar}
          <div className="mt-2.5 flex items-start justify-between gap-3 lg:mt-0">
            <div className="min-w-0">
              {/* Ruten er det siden handler om; den får bryte over to linjer heller enn
                  å ende som «Oslo → Colom…». */}
              <h1 className="text-balance text-[26px] font-bold leading-tight sm:text-[30px]">{title}</h1>
              <p className="mt-1 text-[14.5px] text-white/75 sm:text-[15px]">{summaryLine}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditOpen((o) => !o)}
              aria-expanded={editOpen}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-[15px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Pencil className="size-[18px]" aria-hidden="true" />
              {t("sr.edit")}
              <ChevronDown className={cn("size-4 transition-transform", editOpen && "rotate-180")} aria-hidden="true" />
            </button>
          </div>
          {(result?.demoMode || result?.sandbox || (!isMulti && depart && priceAlertsAvailable)) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!isMulti && depart && priceAlertsAvailable && (
                <button
                  type="button"
                  onClick={() => {
                    setAlertOpen((o) => !o);
                    createAlert.reset();
                    if (!alertEmail && customer?.email) setAlertEmail(customer.email);
                  }}
                  aria-expanded={alertOpen}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-white/10 px-3 text-[14px] font-semibold text-white transition-colors hover:bg-white/20"
                >
                  <Bell className="size-4" aria-hidden="true" /> {t("sr.alert")}
                </button>
              )}
              {result?.demoMode && <span className="rounded-lg bg-sunny px-2.5 py-1.5 text-[13px] font-semibold text-sunny-ink">{t("sr.demo")}</span>}
              {result?.sandbox && !result.demoMode && (
                <span role="status" className="rounded-lg bg-sunny px-2.5 py-1.5 text-[13px] font-semibold text-sunny-ink">
                  {t("sr.sandbox")}
                </span>
              )}
            </div>
          )}
        </div>
      </header>
      <div ref={headerSentinel} aria-hidden="true" />

      <div className="container-x pt-3">
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

      {/* Den ene klebrige linjen på siden. Alt annet ruller. */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md lg:top-16">
        {/* Fra lg står filtrene i en 280 px sidestolpe med 32 px luft; fanene
            følger resultatkolonnen så de hører til listen og ikke til filtrene. */}
        <div className="container-x lg:pl-[calc(theme(spacing.8)+280px+2rem)]">
          {headerPassed && (
            <div className="flex items-center justify-between gap-3 border-b border-border/70 py-2 lg:hidden">
              <p className="min-w-0 truncate text-[14px] font-semibold text-foreground">
                {isMulti ? `${fromAirport?.iata ?? from}–${legs[legs.length - 1]?.to?.iata ?? to}` : `${fromAirport?.iata ?? from} → ${toAirport?.iata ?? to}`}
                <span className="font-normal text-muted-foreground"> · {isMulti ? t("sr.multicity") : ret ? `${formatDayMonth(depart)}–${formatDayMonth(ret)}` : formatDayMonth(depart)}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditOpen(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[14px] font-semibold text-azure-ink hover:bg-muted"
              >
                <Pencil className="size-4" aria-hidden="true" /> {t("sr.edit")}
              </button>
            </div>
          )}
          {/* Fanene finnes først når det finnes treff å prise. Under lasting
              holder vi av nøyaktig samme høyde, ellers dytter de hele listen
              nedover i det de dukker opp – det var den største enkeltkilden
              til layouthopp på resultatsiden. */}
          {sortTabs || (search.isPending && <div className="h-[58px] border-b border-border lg:hidden" aria-hidden="true" />)}
          <div className="lg:hidden">{quickFilters}</div>
        </div>
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

          {/* Alle filtrene (og sorteringen) i ett ark. Åpnes fra linjen over. */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
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
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{humanMessage(search.error, undefined, "search")}</p>
              <Button className="mt-6 rounded-full" onClick={doSearch}>
                <RefreshCw aria-hidden="true" /> {t("common.retry")}
              </Button>
              <NearbyDates links={nearbyDateLinks} />
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
              {!allOffers.length && <NearbyDates links={nearbyDateLinks} />}
            </div>
          )}

          {result && filtered.length > 0 && (
            <div className="space-y-3 sm:space-y-4" aria-live="polite">
              {/* «Testdata · Totalpris for 1 voksen»: hva tallene er, før det første kortet. */}
              <p className="text-[15px] leading-snug text-muted-foreground">
                {result.sandbox || result.demoMode ? `${t("sr.examples")} · ` : ""}
                {t("sr.totalfor", { party: partyLabel(passengers, t) })}
                {" · "}
                {/* Reisen er enheten brukeren sammenligner. Antall tilbud står
                    ved siden av når de er flere, så tallet ikke ser ut til å ha
                    krympet etter grupperingen. */}
                <span className="text-foreground">{t("sr.results", { count: groups.length })}</span>
                {groups.length !== filtered.length ? ` · ${t("sr.offers", { count: filtered.length })}` : ""}
                {activeFilters > 0 ? ` ${t("sr.results.of", { count: allOffers.length })}` : ""}
                {!externalBooking ? ` · ${t("sr.totalnote")}` : ""}
                {expiresInMin !== null && expiresInMin > 0 ? ` · ${t("sr.validfor", { count: expiresInMin })}` : ""}
              </p>
              <CurrencyNote currency={currency} preferred={preferredCurrency} />
              {result.partial && (
                <p role="status" className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {t("sr.partial")}
                </p>
              )}
              {groups.slice(0, visible).map((group, i) => (
                <div key={group.key} className={i < 8 ? "fade-up" : undefined} style={i < 8 ? { animationDelay: `${i * 45}ms` } : undefined}>
                  <ResultCard
                    offer={group.best}
                    totalMinor={group.bestTotal}
                    sellers={group.sellers}
                    onDetails={setDetailsOffer}
                    onSelect={selectOffer}
                    badge={i === 0 && sort !== "earliest" ? tabs.find((x) => x.key === sort)?.label ?? sortLabel : undefined}
                  />
                </div>
              ))}
              {visible < groups.length && (
                <Button variant="outline" size="lg" className="h-[52px] w-full rounded-xl text-[17px] font-bold" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  {t("sr.more", { count: groups.length - visible })}
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

      <OfferDetailsSheet
        offer={detailsOffer}
        totalMinor={detailsOffer ? totalOf(detailsOffer) : 0}
        onClose={() => setDetailsOffer(null)}
        onSelect={(o) => {
          setDetailsOffer(null);
          selectOffer(o);
        }}
        actions={{
          saved: detailsOffer ? collections.savedOfferIds.has(detailsOffer.id) : false,
          onToggleSave: toggleSaveOffer,
          comparing: detailsOffer ? compareIds.includes(detailsOffer.id) : false,
          compareDisabled: compareIds.length >= 3,
          onToggleCompare: toggleCompare,
          shareUrl: detailsOffer ? `https://wa.me/?text=${encodeURIComponent(shareText(detailsOffer))}` : undefined,
        }}
      />

      <CompareTray offers={compareOffers} onRemove={(id) => setCompareIds((p) => p.filter((x) => x !== id))} onClear={() => setCompareIds([])} onSelect={selectOffer} />
    </div>
  );
}
