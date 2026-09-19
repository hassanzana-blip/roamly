import { useId, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { ArrowLeftRight, ArrowRight, CalendarRange, ChevronDown, MoveRight, Plus, X } from "lucide-react";
import AirportField from "./AirportField";
import DateField, { DateRangeField } from "./DateField";
import PassengerCabinPicker from "./PassengerCabinPicker";
import { syncAges } from "./paxUtils";
import { Segmented } from "@/components/ui/segmented";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { saveRecentSearch } from "@/lib/recentSearches";
import { PREFERENCES, type Preference } from "@/lib/offers";
import { buildSearchQuery, defaultState, todayPlus, type SearchParamsState, type TripLeg, type TripType } from "./searchQuery";
export type { SearchParamsState, TripLeg, TripType } from "./searchQuery";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  initial?: Partial<SearchParamsState>;
  /** "hero" is the large homepage form; "compact" is the edit form on results */
  variant?: "hero" | "compact";
  onSubmitted?: () => void;
  /** Rendered on the same row as the trip-type control (e.g. product tabs on the front page). */
  leading?: ReactNode;
}

const PRIMARY_PREFS: Preference[] = ["best", "cheapest", "fastest"];

export default function SearchWidget({ initial, variant = "hero", onSubmitted, leading }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const [state, setState] = useState<SearchParamsState>(() => ({
    ...defaultState(),
    ...initial,
    ages: syncAges({ adult: 1, child: 0, infant_without_seat: 0, ...initial?.pax }, initial?.ages ?? { children: [], infants: [] }),
  }));
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [moreOpen, setMoreOpen] = useState(() => !PRIMARY_PREFS.includes(state.pref));
  const moreId = useId();

  const isMulti = state.tripType === "multicity";
  const isRound = state.tripType === "roundtrip";

  const problems = useMemo(() => {
    const p: { from?: boolean; to?: boolean; dates?: boolean; legs?: boolean } = {};
    if (isMulti) {
      p.legs = !(state.legs.length >= 2 && state.legs.every((l) => l.from && l.to && l.date && l.from.iata !== l.to.iata));
    } else {
      p.from = !state.from;
      p.to = !state.to || (!!state.from && state.from.iata === state.to.iata);
      p.dates = !state.depart || (isRound && !state.ret);
    }
    return p;
  }, [state, isMulti, isRound]);

  const canSubmit = !Object.values(problems).some(Boolean);

  const submit = () => {
    setTouched(true);
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
      aria-label={t("sw.aria")}
      className={cn("w-full", variant === "compact" && "card-soft p-3 sm:p-4")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1">
        {leading}
        <Segmented
          aria-label={t("sw.triptype")}
          value={state.tripType}
          onValueChange={(tripType) => setState((s) => ({ ...s, tripType }))}
          options={TRIP_TYPES}
          className="w-auto rounded-full bg-blush/70 [&>*]:rounded-full [&>*[data-state=on]]:bg-white"
          size={variant === "hero" ? "md" : "sm"}
        />
      </div>

      {isMulti ? (
        <div className="mt-3 space-y-3">
          {state.legs.map((leg, i) => (
            <fieldset key={i} className="rounded-xl border border-border bg-muted/40 p-3">
              <legend className="px-1 text-xs font-semibold text-muted-foreground">{t("sw.leg", { n: i + 1 })}</legend>
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                <AirportField label={t("search.from")} direction="from" value={leg.from} exclude={leg.to?.iata} onChange={(a) => setLeg(i, { from: a })} />
                <AirportField label={t("search.to")} direction="to" value={leg.to} exclude={leg.from?.iata} onChange={(a) => setLeg(i, { to: a })} />
                <DateField value={leg.date} min={i === 0 ? minDate : state.legs[i - 1]?.date || minDate} onChange={(iso) => setLeg(i, { date: iso })} />
                {state.legs.length > 2 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="self-center"
                    onClick={() => setState((s) => ({ ...s, legs: s.legs.filter((_, li) => li !== i) }))}
                    aria-label={t("sw.removeleg", { n: i + 1 })}
                  >
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
          <PassengerCabinPicker
            pax={state.pax}
            onPaxChange={(p) => setState((s) => ({ ...s, pax: p }))}
            ages={state.ages}
            onAgesChange={(a) => setState((s) => ({ ...s, ages: a }))}
            cabin={state.cabin}
            onCabinChange={(c) => setState((s) => ({ ...s, cabin: c }))}
          />
        </div>
      ) : (
        <div className={cn("mt-3", variant === "hero" ? "lg:[--field-h:4.5rem]" : "[--field-h:4rem]")}>
          {/* Telefon: to hvite blokker (fra/til, dato/reisende). Desktop: én hvit rad med alt i. */}
          <div className={cn("flex flex-col gap-2.5 lg:flex-row lg:items-stretch lg:gap-0 lg:overflow-hidden lg:rounded-[22px] lg:bg-white", variant === "compact" && "lg:rounded-2xl")}>
            {/* Origin + destination with a swap control on the seam */}
            <div className="relative grid flex-[2] divide-y divide-border overflow-hidden rounded-3xl bg-white md:grid-cols-2 md:divide-x md:divide-y-0 lg:rounded-none">
              <AirportField
                label={t("search.from")}
                direction="from"
                value={state.from}
                exclude={state.to?.iata}
                invalid={touched && problems.from}
                joined
                onChange={(a) => setState((s) => ({ ...s, from: a }))}
              />
              <AirportField
                label={t("search.to")}
                direction="to"
                value={state.to}
                exclude={state.from?.iata}
                invalid={touched && problems.to}
                joined
                onChange={(a) => setState((s) => ({ ...s, to: a }))}
              />
              <button
                type="button"
                onClick={swap}
                aria-label={t("sw.swap")}
                className={cn(
                  "absolute z-10 grid size-12 place-items-center rounded-full bg-blush text-foreground md:size-10",
                  "transition-[transform,background-color] duration-fast ease-out hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  "right-4 top-1/2 -translate-y-1/2 md:left-1/2 md:right-auto md:-translate-x-1/2",
                  "active:scale-95",
                )}
              >
                <ArrowLeftRight className="size-5 rotate-90 md:size-4 md:rotate-0" />
              </button>
            </div>

            <div className="grid flex-[2.7] grid-cols-2 divide-x divide-border overflow-hidden rounded-3xl bg-white lg:grid-cols-[1.25fr_1fr] lg:rounded-none lg:border-l lg:border-border">
              <DateRangeField
                depart={state.depart}
                ret={state.ret}
                roundtrip={isRound}
                min={minDate}
                invalid={touched && problems.dates}
                joined
                onChange={({ depart, ret }) => setState((s) => ({ ...s, depart, ret }))}
              />
              <PassengerCabinPicker
                pax={state.pax}
                onPaxChange={(p) => setState((s) => ({ ...s, pax: p }))}
                ages={state.ages}
                onAgesChange={(a) => setState((s) => ({ ...s, ages: a }))}
                cabin={state.cabin}
                onCabinChange={(c) => setState((s) => ({ ...s, cabin: c }))}
                joined
              />
            </div>
            {variant === "hero" && (
              <div className="hidden lg:flex lg:items-center lg:bg-white lg:p-2">
                <Button type="submit" size="xl" className="h-[calc(var(--field-h)-1rem)] rounded-full px-7">
                  {t("sw.search")}
                  <ArrowRight />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 px-1 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* The one action: full width on phones, inside the row from lg. */}
      <Button type="submit" size="xl" className={cn("mt-2.5 h-[60px] w-full rounded-full text-[19px]", variant === "hero" && !isMulti && "lg:hidden", variant === "compact" && "md:w-auto md:min-w-64")}>
        {t("sw.find")}
        <ArrowRight />
      </Button>

      {/* What matters most, flexible dates and direct only: quiet, under the action.
          The ranking control and the extra preferences sit behind one disclosure so
          the card never reads as a wall of equal pills. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-controls={moreId}
          className="inline-flex min-h-11 items-center gap-1 rounded-full px-2.5 text-[14px] font-medium text-foreground transition-colors hover:bg-blush sm:min-h-10"
        >
          {moreOpen ? t("sw.options.less") : t("sw.options")}
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-base ease-out", moreOpen && "rotate-180")} aria-hidden="true" />
        </button>
        {!isMulti && (
          <Chip selected={state.flex} onClick={() => setState((s) => ({ ...s, flex: !s.flex }))} title={t("sw.flex.hint")} icon={<CalendarRange aria-hidden="true" />} className="border-0 bg-transparent hover:bg-blush aria-pressed:bg-blush">
            {t("sw.flex")}
          </Chip>
        )}
        <Chip selected={state.direct} onClick={() => setState((s) => ({ ...s, direct: !s.direct }))} title={t("sw.direct.hint")} icon={<MoveRight aria-hidden="true" />} className="border-0 bg-transparent hover:bg-blush aria-pressed:bg-blush">
          {t("sw.direct")}
        </Chip>
      </div>
      {moreOpen && (
        <div id={moreId} role="group" aria-label={t("sw.pref.more")} className="mt-2 flex flex-col gap-3 px-1 pb-1 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{t("pref.title")}</span>
            <Segmented
              aria-label={t("pref.title")}
              value={PRIMARY_PREFS.includes(state.pref) ? state.pref : ("" as Preference)}
              onValueChange={(pref) => setState((s) => ({ ...s, pref }))}
              options={PREFERENCES.filter((p) => PRIMARY_PREFS.includes(p.key)).map((p) => ({ value: p.key, label: t(p.label) }))}
              size="sm"
              className="w-auto rounded-full bg-blush/70 [&>*]:rounded-full [&>*[data-state=on]]:bg-white"
            />
          </div>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
            {PREFERENCES.filter((p) => !PRIMARY_PREFS.includes(p.key)).map((p) => (
              <Chip key={p.key} selected={state.pref === p.key} onClick={() => setState((s) => ({ ...s, pref: p.key }))} title={t(p.hint)} icon={<p.icon aria-hidden="true" />} className="border-0 bg-white aria-pressed:bg-blush">
                {t(p.label)}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
