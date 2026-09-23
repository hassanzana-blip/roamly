import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, ArrowUpDown, CalendarRange, Check, ChevronDown, MoveRight, Plus, X } from "lucide-react";
import AirportField from "./AirportField";
import DateField, { DateRangeField } from "./DateField";
import PassengerCabinPicker from "./PassengerCabinPicker";
import { syncAges } from "./paxUtils";
import { Segmented } from "@/components/ui/segmented";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { saveRecentSearch } from "@/lib/recentSearches";
import { PREFERENCES, type Preference } from "@/lib/offers";
import { buildSearchQuery, defaultState, todayPlus, type SearchParamsState, type TripLeg, type TripType } from "./searchQuery";
export type { SearchParamsState, TripLeg, TripType } from "./searchQuery";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { searchDateIssue } from "./searchDates";

interface Props {
  initial?: Partial<SearchParamsState>;
  /** "hero" is the large homepage form; "compact" is the edit form on results */
  variant?: "hero" | "compact";
  onSubmitted?: () => void;
  /** Rendered above the form (e.g. product tabs). */
  leading?: ReactNode;
}

const PRIMARY_PREFS: Preference[] = ["best", "cheapest", "fastest"];

/** Utkastet til søket lever i fanen (sessionStorage), aldri lenger. */
const DRAFT_KEY = "hellosky:search-draft";
function readDraft(): Partial<SearchParamsState> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<SearchParamsState>;
    // Datoer som har passert forkastes; ellers kommer gårsdagens søk tilbake.
    if (d.depart && d.depart < todayPlus(0)) return null;
    return d;
  } catch {
    return null;
  }
}
function writeDraft(s: SearchParamsState) {
  try {
    const { from, to, depart, ret, tripType, legs, pax, ages, cabin, pref, flex, direct } = s;
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ from, to, depart, ret, tripType, legs, pax, ages, cabin, pref, flex, direct }));
  } catch {
    /* privat modus – utkastet lever bare i minnet */
  }
}

/** «Tur/retur ⌄»: the trip type as a dropdown, as in the reference. */
function TripTypeSelect({ value, onChange, options, label }: { value: TripType; onChange: (v: TripType) => void; options: { value: TripType; label: string }[]; label: string }) {
  const current = options.find((o) => o.value === value)?.label ?? "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${current}`}
          className="group flex h-12 w-full items-center gap-3 rounded-xl border border-border bg-white px-4 text-left outline-none transition-[border-color,box-shadow] duration-fast hover:border-petrol/40 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-ring"
        >
          <span className="min-w-0 flex-1 truncate text-[17px] font-semibold text-petrol">{current}</span>
          <ChevronDown className="size-5 shrink-0 text-petrol transition-transform duration-fast group-data-[state=open]:rotate-180" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-48 rounded-xl border-border p-1.5">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as TripType)}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value} className="min-h-12 rounded-lg pl-3 pr-10 text-[16px] font-medium text-petrol [&>span:first-child]:left-auto [&>span:first-child]:right-3">
              {o.label}
              <span className="sr-only">{o.value === value ? " ✓" : ""}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function SearchWidget({ initial, variant = "hero", onSubmitted, leading }: Props) {
  const t = useT();
  const navigate = useNavigate();
  // Uten `initial` (forsiden) tar skjemaet opp igjen der du slapp i denne
  // fanen, så et trykk på «tilbake» fra resultatene ikke nullstiller søket.
  const [state, setState] = useState<SearchParamsState>(() => {
    const base = initial ?? readDraft() ?? {};
    return {
      ...defaultState(),
      ...base,
      ages: syncAges({ adult: 1, child: 0, infant_without_seat: 0, ...base?.pax }, base?.ages ?? { children: [], infants: [] }),
    };
  });
  useEffect(() => {
    if (!initial) writeDraft(state);
  }, [state, initial]);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [moreOpen, setMoreOpen] = useState(() => !PRIMARY_PREFS.includes(state.pref));
  const moreId = useId();

  const isMulti = state.tripType === "multicity";
  const isRound = state.tripType === "roundtrip";
  const dates = isMulti ? state.legs.map((leg) => leg.date) : isRound ? [state.depart, state.ret] : [state.depart];
  const dateProblem = searchDateIssue(dates);

  const problems = useMemo(() => {
    const p: { from?: boolean; to?: boolean; dates?: boolean; legs?: boolean } = {};
    if (isMulti) {
      p.legs = !(state.legs.length >= 2 && state.legs.every((l) => l.from && l.to && l.date && l.from.iata !== l.to.iata));
      p.dates = !!dateProblem;
    } else {
      p.from = !state.from;
      p.to = !state.to || (!!state.from && state.from.iata === state.to.iata);
      p.dates = !!dateProblem;
    }
    return p;
  }, [state, isMulti, dateProblem]);

  const canSubmit = !Object.values(problems).some(Boolean);

  const submit = () => {
    setTouched(true);
    // Recheck at submission too: a tab can stay open across local midnight.
    const latestDateProblem = searchDateIssue(dates);
    if (latestDateProblem && latestDateProblem !== "missing") {
      setError(t(`sw.err.dates.${latestDateProblem}`));
      return;
    }
    if (!canSubmit) {
      setError(
        isMulti
          ? t("sw.err.legs")
          : problems.to && state.from && state.to && state.from.iata === state.to.iata
            ? t("sw.err.same")
            : problems.dates
              ? isRound
                ? t("sw.err.dates.round")
                : t("sw.err.dates.one")
              : t("sw.err.where"),
      );
      return;
    }
    setError("");
    if (!isMulti && state.from && state.to) {
      saveRecentSearch({
        from: state.from.iata,
        to: state.to.iata,
        fromLabel: state.from.city,
        toLabel: state.to.city,
        depart: state.depart,
        ret: isRound ? state.ret : undefined,
        adults: state.pax.adult,
        children: state.pax.child,
        infants: state.pax.infant_without_seat,
        cabin: state.cabin,
      });
    }
    onSubmitted?.();
    navigate(`/sok?${buildSearchQuery(state)}`);
  };

  const minDate = todayPlus(0);
  const setLeg = (i: number, patch: Partial<TripLeg>) => setState((s) => ({ ...s, legs: s.legs.map((l, li) => (li === i ? { ...l, ...patch } : l)) }));
  const swap = () => setState((s) => ({ ...s, from: s.to, to: s.from }));

  const TRIP_TYPES: { value: TripType; label: string }[] = [
    { value: "roundtrip", label: t("sw.roundtrip") },
    { value: "oneway", label: t("sw.oneway") },
    { value: "multicity", label: t("sw.multicity") },
  ];

  const pax = (
    <PassengerCabinPicker
      pax={state.pax}
      onPaxChange={(p) => setState((s) => ({ ...s, pax: p }))}
      ages={state.ages}
      onAgesChange={(a) => setState((s) => ({ ...s, ages: a }))}
      cabin={state.cabin}
      onCabinChange={(c) => setState((s) => ({ ...s, cabin: c }))}
      variant="dropdown"
    />
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
      aria-label={t("sw.aria")}
      className="w-full"
    >
      {leading}

      {/* The mint search area: trip type + travellers, origin/destination, dates, the one action. */}
      <div className={cn("rounded-2xl bg-mint p-3 sm:p-4", variant === "compact" && "rounded-2xl")}>
        <div className="grid grid-cols-2 gap-3">
          <TripTypeSelect value={state.tripType} onChange={(tripType) => setState((s) => ({ ...s, tripType }))} options={TRIP_TYPES} label={t("sw.triptype")} />
          {pax}
        </div>

        {isMulti ? (
          <div className="mt-3 space-y-3">
            {state.legs.map((leg, i) => (
              <fieldset key={i} className="rounded-xl border border-border bg-white p-3">
                <legend className="px-1 text-xs font-semibold text-muted-foreground">{t("sw.leg", { n: i + 1 })}</legend>
                <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <AirportField label={t("search.from")} direction="from" value={leg.from} exclude={leg.to?.iata} onChange={(a) => setLeg(i, { from: a })} />
                  <AirportField label={t("search.to")} direction="to" value={leg.to} exclude={leg.from?.iata} origin={leg.from} onChange={(a) => setLeg(i, { to: a })} />
                  <DateField value={leg.date} min={i === 0 ? minDate : [minDate, state.legs[i - 1]?.date || minDate].sort().at(-1)} error={touched && problems.dates} onChange={(iso) => setLeg(i, { date: iso })} />
                  {state.legs.length > 2 ? (
                    <Button type="button" variant="ghost" size="icon" className="self-center" onClick={() => setState((s) => ({ ...s, legs: s.legs.filter((_, li) => li !== i) }))} aria-label={t("sw.removeleg", { n: i + 1 })}>
                      <X />
                    </Button>
                  ) : (
                    <span className="hidden md:block" />
                  )}
                </div>
              </fieldset>
            ))}
            {state.legs.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() =>
                  setState((s) => {
                    const last = s.legs[s.legs.length - 1];
                    return { ...s, legs: [...s.legs, { from: last?.to ?? null, to: null, date: last?.date || todayPlus(21) }] };
                  })
                }
              >
                <Plus /> {t("sw.addleg")}
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-3 md:grid md:grid-cols-[1.4fr_1fr] md:gap-3">
            {/* Origin over destination, a hairline between them, the swap on the seam. */}
            <div className="relative rounded-xl border border-border bg-white">
              <AirportField
                label={t("search.from")}
                direction="from"
                value={state.from}
                exclude={state.to?.iata}
                invalid={touched && problems.from}
                joined
                onChange={(a) => setState((s) => ({ ...s, from: a }))}
              />
              <div className="mx-4 mr-24 h-px bg-border" aria-hidden="true" />
              <AirportField
                label={t("search.to")}
                direction="to"
                value={state.to}
                exclude={state.from?.iata}
                invalid={touched && problems.to}
                joined
                origin={state.from}
                onAnywhere={() => navigate("/utforsk")}
                onChange={(a) => setState((s) => ({ ...s, to: a }))}
              />
              <button
                type="button"
                onClick={swap}
                aria-label={t("sw.swap")}
                className="absolute right-4 top-1/2 grid size-14 -translate-y-1/2 place-items-center rounded-full bg-mint text-petrol transition-[background-color,transform] duration-fast ease-out hover:bg-mint-deep focus-visible:ring-2 focus-visible:ring-ring active:scale-95 motion-reduce:active:scale-100"
              >
                <ArrowUpDown className="size-6" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-3 md:mt-0">
              <DateRangeField
                depart={state.depart}
                ret={state.ret}
                roundtrip={isRound}
                min={minDate}
                invalid={touched && problems.dates}
                variant="row"
                onChange={({ depart, ret }) => setState((s) => ({ ...s, depart, ret }))}
              />
              <Button type="submit" size="xl" className="h-[52px] w-full rounded-xl text-[18px] font-bold md:mt-auto">
                {t("sw.find")}
                <ArrowRight className="size-6" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
        {isMulti && (
          <Button type="submit" size="xl" className="mt-3 h-[52px] w-full rounded-xl text-[18px] font-bold">
            {t("sw.find")}
            <ArrowRight className="size-6" aria-hidden="true" />
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-3 px-1 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* What matters most, flexible dates and direct only: quiet, under the action. */}
      <div className="mt-2 flex flex-wrap items-center gap-1 px-1">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-controls={moreId}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2.5 text-[14px] font-semibold text-petrol transition-colors hover:bg-secondary"
        >
          {moreOpen ? t("sw.options.less") : t("sw.options")}
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-base ease-out", moreOpen && "rotate-180")} aria-hidden="true" />
        </button>
        {/* Active choices stay visible even when the disclosure is closed. */}
        {!moreOpen && state.flex && !isMulti && <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-mint px-3 text-[14px] font-medium text-petrol"><Check className="size-4" aria-hidden="true" /> {t("sw.flex")}</span>}
        {!moreOpen && state.direct && <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-mint px-3 text-[14px] font-medium text-petrol"><Check className="size-4" aria-hidden="true" /> {t("sw.direct")}</span>}
      </div>
      {moreOpen && (
        <div id={moreId} role="group" aria-label={t("sw.pref.more")} className="mt-2 flex flex-col gap-3 px-1 pb-1 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-wrap gap-2">
            {!isMulti && (
              <Chip selected={state.flex} onClick={() => setState((s) => ({ ...s, flex: !s.flex }))} title={t("sw.flex.hint")} icon={state.flex ? <Check aria-hidden="true" /> : <CalendarRange aria-hidden="true" />} className="h-11 aria-pressed:border-petrol aria-pressed:bg-mint aria-pressed:text-petrol">
                {t("sw.flex")}
              </Chip>
            )}
            <Chip selected={state.direct} onClick={() => setState((s) => ({ ...s, direct: !s.direct }))} title={t("sw.direct.hint")} icon={state.direct ? <Check aria-hidden="true" /> : <MoveRight aria-hidden="true" />} className="h-11 aria-pressed:border-petrol aria-pressed:bg-mint aria-pressed:text-petrol">
              {t("sw.direct")}
            </Chip>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{t("pref.title")}</span>
            <Segmented
              aria-label={t("pref.title")}
              value={PRIMARY_PREFS.includes(state.pref) ? state.pref : ("" as Preference)}
              onValueChange={(pref) => setState((s) => ({ ...s, pref }))}
              options={PREFERENCES.filter((p) => PRIMARY_PREFS.includes(p.key)).map((p) => ({ value: p.key, label: t(p.label) }))}
              size="sm"
              className="w-auto rounded-xl bg-secondary [&>*]:rounded-lg [&>*[data-state=on]]:bg-white"
            />
          </div>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
            {PREFERENCES.filter((p) => !PRIMARY_PREFS.includes(p.key)).map((p) => (
              <Chip key={p.key} selected={state.pref === p.key} onClick={() => setState((s) => ({ ...s, pref: p.key }))} title={t(p.hint)} icon={<p.icon aria-hidden="true" />} className="h-11 aria-pressed:border-petrol aria-pressed:bg-mint aria-pressed:text-petrol">
                {t(p.label)}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
