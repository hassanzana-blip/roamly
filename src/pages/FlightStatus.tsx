import { useState } from "react";
import { useSearchParams } from "react-router";
import { ArrowRight, Clock, DoorOpen, Plane, Radar, TriangleAlert } from "lucide-react";
import { trpc } from "@/providers/trpc";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import DateField from "@/components/search/DateField";
import { TRACKABLE_CARRIERS } from "@contracts/carriers";
import type { FlightStatus as FlightStatusType } from "@contracts/types";
import { STATUS_LABELS, formatClock, formatDateLong } from "@/lib/format";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "text-skyline border-skyline/40 bg-skyline/10",
  boarding: "text-gold border-gold/40 bg-gold/10",
  departed: "text-gold border-gold/40 bg-gold/10",
  in_air: "text-gold border-gold/40 bg-gold/10",
  landed: "text-emerald-300 border-emerald-300/40 bg-emerald-300/10",
  delayed: "text-primary border-primary/40 bg-primary/10",
  cancelled: "text-primary border-primary/40 bg-primary/10",
};

function StatusCard({ status }: { status: FlightStatusType }) {
  const airborne = status.status === "in_air" || status.status === "departed";
  const pct = Math.round(status.progress * 100);
  return (
    <section className="fade-up rounded-3xl border hairline bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {formatDateLong(status.date)}
          </p>
          <h2 className="mt-1 font-display text-3xl">
            {status.carrier.name} {status.carrier.iata} {status.flightNumber}
          </h2>
        </div>
        <span className={`rounded-full border px-4 py-1.5 text-sm font-bold ${STATUS_COLORS[status.status]}`}>
          {STATUS_LABELS[status.status]}
          {status.delayMinutes > 0 && status.status !== "landed" && ` · +${status.delayMinutes} min`}
        </span>
      </div>

      {/* route timeline */}
      <div className="mt-8">
        <div className="flex items-center justify-between text-sm font-bold">
          <span>{status.origin.city}</span>
          <span>{status.destination.city}</span>
        </div>
        <div className="relative mt-3 h-1 rounded-full bg-secondary">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-skyline to-gold transition-all duration-1000"
            style={{ width: `${Math.max(2, pct)}%` }}
          />
          <Plane
            className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rotate-45 text-gold transition-all duration-1000"
            style={{ left: `calc(${Math.max(2, Math.min(96, pct))}% - 10px)` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{status.origin.iata}</span>
          {airborne && <span className="font-medium text-gold">{pct}% av flyturen</span>}
          <span>{status.destination.iata}</span>
        </div>
      </div>

      {/* times */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Planlagt avgang", value: formatClock(status.scheduledDeparture) },
          {
            label: "Forventet avgang",
            value: formatClock(status.estimatedDeparture),
            late: status.delayMinutes > 0,
          },
          { label: "Planlagt ankomst", value: formatClock(status.scheduledArrival) },
          {
            label: "Forventet ankomst",
            value: formatClock(status.estimatedArrival),
            late: status.delayMinutes > 0,
          },
        ].map((t) => (
          <div key={t.label} className="rounded-2xl border hairline bg-muted/50 p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{t.label}</p>
            <p className={`mt-1 font-display text-2xl ${t.late ? "text-primary" : ""}`}>{t.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t hairline pt-5 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-gold" /> Gate {status.gate ?? "annonseres"}
        </span>
        <span className="flex items-center gap-2">
          <Plane className="h-4 w-4 text-gold" /> {status.aircraft}
        </span>
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gold" /> Oppdatert akkurat nå
        </span>
      </div>
    </section>
  );
}

export default function FlightStatus() {
  const [params] = useSearchParams();
  const [carrier, setCarrier] = useState(params.get("carrier") ?? "DY");
  const [flight, setFlight] = useState(params.get("flight") ?? "");
  const [date, setDate] = useState(
    params.get("date") ?? new Date().toISOString().slice(0, 10),
  );
  const [submitted, setSubmitted] = useState<{ c: string; f: string; d: string } | null>(
    params.get("flight") ? { c: carrier, f: params.get("flight")!, d: date } : null,
  );

  const status = trpc.flights.flightStatus.useQuery(
    { carrier: submitted!.c, flightNumber: submitted!.f, date: submitted!.d },
    { enabled: Boolean(submitted), retry: 1 },
  );

  const inputCls =
    "w-full rounded-xl border hairline bg-card px-4 py-3 text-base outline-none transition-colors focus:border-accent";

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-28 sm:px-6">
        <div className="aurora-band -mx-4 -mt-28 mb-8 px-4 pb-10 pt-32 sm:-mx-6 sm:px-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-skyline">
            <Radar className="h-4 w-4 text-gold" /> Flyradar
          </p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Hvor er flyet?</h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Følg avganger og ankomster i sanntid — enten du skal ut å fly selv
            eller hente noen du er glad i.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (flight.trim()) setSubmitted({ c: carrier, f: flight.trim(), d: date });
          }}
          className="grid gap-3 rounded-3xl border hairline glass p-5 sm:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Flyselskap
            </span>
            <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputCls}>
              {TRACKABLE_CARRIERS.map((c) => (
                <option key={c.iata} value={c.iata}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Flightnummer
            </span>
            <input
              inputMode="numeric"
              placeholder="f.eks. 452"
              value={flight}
              onChange={(e) => setFlight(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className={inputCls}
            />
          </label>
          <div>
            <DateField value={date} onChange={setDate} placeholder="Dato" />
          </div>
          <button
            type="submit"
            disabled={!flight.trim()}
            className="flex items-center justify-center gap-2 self-end rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-40"
          >
            Spor fly <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-6">
          {status.isLoading && <div className="shimmer h-72 rounded-3xl" />}
          {status.isError && (
            <div className="rounded-3xl border border-primary/40 bg-card p-8 text-center">
              <TriangleAlert className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-3 font-display text-2xl">Fant ikke flyvningen</p>
              <p className="mt-2 text-sm text-muted-foreground">{status.error.message}</p>
            </div>
          )}
          {status.data && <StatusCard status={status.data} />}
          {!submitted && (
            <div className="rounded-3xl border hairline bg-card p-8 text-center text-sm text-muted-foreground">
              Skriv inn flightnummeret — det står på billetten din, f.eks.{" "}
              <span className="font-semibold text-skyline">DY 452</span> eller{" "}
              <span className="font-semibold text-skyline">SK 278</span>.
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
