import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeftRight, Plus, Search, X } from "lucide-react";
import AirportField from "./AirportField";
import DateField, { DateRangeField } from "./DateField";
import PassengerCabinPicker from "./PassengerCabinPicker";
import { syncAges } from "./paxUtils";
import { Segmented } from "@/components/ui/segmented";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { saveRecentSearch } from "@/lib/recentSearches";
import { PREFERENCES } from "@/lib/offers";
import { buildSearchQuery, defaultState, todayPlus, type SearchParamsState, type TripLeg, type TripType } from "./searchQuery";
export type { SearchParamsState, TripLeg, TripType } from "./searchQuery";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  initial?: Partial<SearchParamsState>;
  /** "hero" is the large homepage form; "compact" is the edit form on results */
  variant?: "hero" | "compact";
  onSubmitted?: () => void;
}

export default function SearchWidget({ initial, variant = "hero", onSubmitted }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const [state, setState] = useState<SearchParamsState>(() => ({
    ...defaultState(),
    ...initial,
    ages: syncAges({ adult: 1, child: 0, infant_without_seat: 0, ...initial?.pax }, initial?.ages ?? { children: [], infants: [] }),
  }));
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

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
      className={cn("w-full rounded-2xl border border-border bg-card p-3 shadow-md sm:p-4", variant === "hero" && "md:p-5")}
    >
      <Segmented aria-label={t("sw.triptype")} value={state.tripType} onValueChange={(tripType) => setState((s) => ({ ...s, tripType }))} options={TRIP_TYPES} />

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
        <div className="mt-3 grid gap-2 md:grid-cols-[1.1fr_1.1fr_1fr_1fr]">
          {/* Origin + destination with a swap control on the seam */}
          <div className="relative grid gap-2 md:col-span-2 md:grid-cols-2">
            <AirportField
              label={t("search.from")}
              direction="from"
              value={state.from}
              exclude={state.to?.iata}
              invalid={touched && problems.from}
              onChange={(a) => setState((s) => ({ ...s, from: a }))}
            />
            <AirportField
              label={t("search.to")}
              direction="to"
              value={state.to}
              exclude={state.from?.iata}
              invalid={touched && problems.to}
              onChange={(a) => setState((s) => ({ ...s, to: a }))}
            />
            <button
              type="button"
              onClick={swap}
              aria-label={t("sw.swap")}
              className={cn(
                "absolute z-10 grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm",
                "transition-[transform,color,border-color] duration-base ease-out hover:border-foreground/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                "right-3 top-1/2 -translate-y-1/2 md:left-1/2 md:right-auto md:-translate-x-1/2",
                "active:rotate-180 motion-reduce:active:rotate-0",
              )}
            >
              <ArrowLeftRight className="size-4 rotate-90 md:rotate-0" />
            </button>
          </div>

          <DateRangeField
            depart={state.depart}
            ret={state.ret}
            roundtrip={isRound}
            min={minDate}
            invalid={touched && problems.dates}
            onChange={({ depart, ret }) => setState((s) => ({ ...s, depart, ret }))}
          />

          <PassengerCabinPicker
            pax={state.pax}
            onPaxChange={(p) => setState((s) => ({ ...s, pax: p }))}
            ages={state.ages}
            onAgesChange={(a) => setState((s) => ({ ...s, ages: a }))}
            cabin={state.cabin}
            onCabinChange={(c) => setState((s) => ({ ...s, cabin: c }))}
          />
        </div>
      )}

      {/* What matters most: sets the default ranking of results */}
      <div className="mt-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">{t("pref.title")}</p>
        <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t("pref.title")}>
          {PREFERENCES.map((p) => (
            <Chip key={p.key} selected={state.pref === p.key} onClick={() => setState((s) => ({ ...s, pref: p.key }))} icon={<p.icon />} title={t(p.hint)}>
              {t(p.label)}
            </Chip>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="xl" className="mt-3 w-full md:mt-4">
        <Search />
        {t("sw.submit")}
      </Button>
    </form>
  );
}
