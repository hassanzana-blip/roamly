import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeftRight, Plus, Search, X } from "lucide-react";
import AirportField from "./AirportField";
import DateField from "./DateField";
import PassengerCabinPicker from "./PassengerCabinPicker";
import { syncAges, type PaxAges, type PaxCount } from "./paxUtils";
import { airportByIata, type Airport } from "@contracts/airports";
import type { CabinClass } from "@contracts/types";
import { saveRecentSearch } from "@/lib/recentSearches";

export interface TripLeg {
  from: Airport | null;
  to: Airport | null;
  date: string;
}

export interface SearchParamsState {
  from: Airport | null;
  to: Airport | null;
  depart: string;
  ret: string;
  tripType: "roundtrip" | "oneway" | "multicity";
  legs: TripLeg[];
  pax: PaxCount;
  ages: PaxAges;
  cabin: CabinClass;
}

function todayPlus(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function defaultState(): SearchParamsState {
  return {
    from: airportByIata("OSL") ?? null,
    to: null,
    depart: todayPlus(21),
    ret: todayPlus(28),
    tripType: "roundtrip",
    legs: [
      { from: airportByIata("OSL") ?? null, to: null, date: todayPlus(21) },
      { from: null, to: null, date: todayPlus(28) },
    ],
    pax: { adult: 1, child: 0, infant_without_seat: 0 },
    ages: { children: [], infants: [] },
    cabin: "economy",
  };
}

function buildSearchQuery(s: SearchParamsState): string {
  const q = new URLSearchParams({
    adults: String(s.pax.adult),
    children: String(s.pax.child),
    infants: String(s.pax.infant_without_seat),
    cabin: s.cabin,
  });
  if (s.ages.children.length) q.set("childAges", s.ages.children.join(","));
  if (s.ages.infants.length) q.set("infantAges", s.ages.infants.join(","));
  if (s.tripType === "multicity") {
    q.set(
      "legs",
      s.legs.map((l) => `${l.from!.iata}:${l.to!.iata}:${l.date}`).join(","),
    );
  } else {
    q.set("from", s.from!.iata);
    q.set("to", s.to!.iata);
    q.set("depart", s.depart);
    if (s.tripType === "roundtrip" && s.ret) q.set("ret", s.ret);
  }
  return q.toString();
}

const TRIP_TYPES = [
  { id: "roundtrip", label: "Tur/retur" },
  { id: "oneway", label: "Én vei" },
  { id: "multicity", label: "Flerby" },
] as const;

export default function SearchWidget({ initial }: { initial?: Partial<SearchParamsState> }) {
  const navigate = useNavigate();
  const [state, setState] = useState<SearchParamsState>(() => ({
    ...defaultState(),
    ...initial,
    ages: syncAges(
      { adult: 1, child: 0, infant_without_seat: 0, ...initial?.pax },
      initial?.ages ?? { children: [], infants: [] },
    ),
  }));
  const [error, setError] = useState("");

  const isMulti = state.tripType === "multicity";

  const canSubmit = useMemo(() => {
    if (isMulti) {
      return (
        state.legs.length >= 2 &&
        state.legs.every((l) => l.from && l.to && l.date && l.from.iata !== l.to.iata)
      );
    }
    return (
      state.from && state.to && state.from.iata !== state.to.iata && state.depart
    );
  }, [state, isMulti]);

  const submit = () => {
    if (!canSubmit) {
      setError(
        isMulti
          ? "Fyll inn flyplasser og dato for alle strekninger."
          : "Velg både avreiseflyplass og destinasjon — de må være forskjellige.",
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
        ret: state.tripType === "roundtrip" ? state.ret : undefined,
        adults: state.pax.adult,
        children: state.pax.child,
        infants: state.pax.infant_without_seat,
        cabin: state.cabin,
      });
    }
    navigate(`/sok?${buildSearchQuery(state)}`);
  };

  const minDate = todayPlus(0);

  const setLeg = (i: number, patch: Partial<TripLeg>) =>
    setState((s) => ({
      ...s,
      legs: s.legs.map((l, li) => (li === i ? { ...l, ...patch } : l)),
    }));

  return (
    <div className="w-full rounded-2xl border border-border bg-white p-4 shadow-[0_12px_40px_-16px_hsl(var(--night)/0.35)] sm:p-5">
      {/* trip type — segmentert kontroll */}
      <div
        className="mb-4 inline-flex flex-wrap gap-1 rounded-full bg-muted p-1"
        role="tablist"
        aria-label="Reisetype"
      >
        {TRIP_TYPES.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={state.tripType === t.id}
            onClick={() => setState((s) => ({ ...s, tripType: t.id }))}
            className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all ${
              state.tripType === t.id
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isMulti ? (
        <div className="space-y-3">
          {state.legs.map((leg, i) => (
            <div key={i} className="relative grid gap-3 rounded-2xl border hairline bg-muted/50 p-3 sm:grid-cols-[1fr_1fr_1fr]">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-foreground">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <AirportField
                    label="Fra"
                    direction="from"
                    value={leg.from}
                    exclude={leg.to?.iata}
                    onChange={(a) => setLeg(i, { from: a })}
                  />
                </div>
              </div>
              <AirportField
                label="Til"
                direction="to"
                value={leg.to}
                exclude={leg.from?.iata}
                onChange={(a) => setLeg(i, { to: a })}
              />
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <DateField
                    value={leg.date}
                    min={i === 0 ? minDate : state.legs[i - 1]?.date || minDate}
                    placeholder="Dato"
                    onChange={(iso) => setLeg(i, { date: iso })}
                  />
                </div>
                {state.legs.length > 2 && (
                  <button
                    type="button"
                    onClick={() =>
                      setState((s) => ({ ...s, legs: s.legs.filter((_, li) => li !== i) }))
                    }
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border hairline text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    aria-label={`Fjern strekning ${i + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {state.legs.length < 3 && (
            <button
              type="button"
              onClick={() =>
                setState((s) => {
                  const last = s.legs[s.legs.length - 1];
                  return {
                    ...s,
                    legs: [
                      ...s.legs,
                      {
                        from: last?.to ?? null,
                        to: null,
                        date: last?.date || todayPlus(21),
                      },
                    ],
                  };
                })
              }
              className="flex items-center gap-2 rounded-xl border border-dashed hairline px-4 py-2.5 text-sm font-medium text-skyline transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Legg til strekning
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
            <AirportField
              label="Fra"
              direction="from"
              value={state.from}
              exclude={state.to?.iata}
              onChange={(a) => setState((s) => ({ ...s, from: a }))}
            />
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, from: s.to, to: s.from }))}
              aria-label="Bytt om avreise og destinasjon"
              className="mx-auto hidden h-11 w-11 place-items-center self-center rounded-full border hairline text-skyline transition-all hover:rotate-180 hover:border-accent md:grid"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <AirportField
              label="Til"
              direction="to"
              value={state.to}
              exclude={state.from?.iata}
              onChange={(a) => setState((s) => ({ ...s, to: a }))}
            />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.3fr]">
            <DateField
              value={state.depart}
              min={minDate}
              placeholder="Utreise"
              onChange={(iso) =>
                setState((s) => ({
                  ...s,
                  depart: iso,
                  ret: s.ret < iso ? iso : s.ret,
                }))
              }
            />
            <div className={state.tripType === "roundtrip" ? "" : "pointer-events-none opacity-40"}>
              <DateField
                value={state.ret}
                min={state.depart}
                placeholder="Hjemreise"
                onChange={(iso) => setState((s) => ({ ...s, ret: iso }))}
              />
            </div>
            <PassengerCabinPicker
              pax={state.pax}
              onPaxChange={(p) => setState((s) => ({ ...s, pax: p }))}
              ages={state.ages}
              onAgesChange={(a) => setState((s) => ({ ...s, ages: a }))}
              cabin={state.cabin}
              onCabinChange={(c) => setState((s) => ({ ...s, cabin: c }))}
            />
          </div>
        </>
      )}

      {isMulti && (
        <div className="mt-3">
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

      {error && (
        <p className="mt-3 text-sm font-medium text-primary" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:brightness-[0.94] active:scale-[0.99] disabled:opacity-40"
      >
        <Search className="h-5 w-5" />
        Søk
      </button>
    </div>
  );
}
