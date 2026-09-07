import { useState } from "react";
import { useSearchParams } from "react-router";
import { ArrowRight, Clock, DoorOpen, ExternalLink, Plane, Radar, TriangleAlert } from "lucide-react";
import { trpc } from "@/providers/trpc";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import DateField from "@/components/search/DateField";
import { TRACKABLE_CARRIERS } from "@contracts/carriers";
import type { FlightStatus as FlightStatusType } from "@contracts/types";
import { STATUS_LABELS, formatClock, formatDateLong } from "@/lib/format";
import { humanMessage } from "@/lib/apiError";
import { PAGE_META, usePageMeta } from "@/lib/seo";

/** Flyselskapenes egne statussider — brukes når vi ikke har en datakilde selv. */
const CARRIER_STATUS_LINKS: Record<string, string> = {
  DY: "https://www.norwegian.com/no/reiseinformasjon/flystatus/",
  SK: "https://www.flysas.com/no-no/flystatus/",
  WF: "https://www.wideroe.no/flystatus",
  KL: "https://www.klm.com/information/flight-status",
  LH: "https://www.lufthansa.com/no/no/flystatus",
  BA: "https://www.britishairways.com/travel/flightstatus/public/en_gb",
  AF: "https://wwws.airfrance.no/flight-status",
  AY: "https://www.finnair.com/no-no/flystatus",
  FI: "https://www.icelandair.com/flight-status/",
  TK: "https://www.turkishairlines.com/en-int/flights/flight-status/",
  EK: "https://www.emirates.com/no/norwegian/travel/flight-status/",
  QR: "https://www.qatarairways.com/en/flight-status.html",
  SQ: "https://www.singaporeair.com/en_UK/no/plan-travel/flight-status/",
  FR: "https://www.ryanair.com/no/no/flight-info",
  U2: "https://www.easyjet.com/no/flight-tracker",
  DL: "https://www.delta.com/flightstatus/",
  UA: "https://www.united.com/en/us/flightstatus",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "text-primary border-skyline/40 bg-primary/10",
  boarding: "text-primary border-skyline/40 bg-primary/10",
  departed: "text-primary border-skyline/40 bg-primary/10",
  in_air: "text-primary border-skyline/40 bg-primary/10",
  landed: "text-emerald-300 border-emerald-300/40 bg-emerald-300/10",
  delayed: "text-destructive border-destructive/30 bg-destructive/5",
  cancelled: "text-destructive border-destructive/30 bg-destructive/5",
};

function UnavailablePanel({ reason, carrier }: { reason: string; carrier: string }) {
  const own = CARRIER_STATUS_LINKS[carrier];
  const name = TRACKABLE_CARRIERS.find((c) => c.iata === carrier)?.name ?? carrier;
  return (
    <section role="status" className="fade-up rounded-xl border border-border bg-card p-6 sm:p-8">
      <h2 className="font-display text-2xl">Flystatus er ikke tilgjengelig ennå</h2>
      <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
      <p className="mt-3 text-sm text-muted-foreground">Sjekk flyselskapets egen nettside eller flyplassens avgangstavle — de har alltid siste informasjon om gate, forsinkelser og kanselleringer.</p>
      <ul className="mt-4 space-y-2 text-sm">
        {own && (
          <li>
            <a href={own} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 font-semibold text-primary-foreground">
              Flystatus hos {name} <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </li>
        )}
        <li>
          <a href="https://avinor.no/flyplass/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-5 font-medium">
            Avinor — avganger og ankomster <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </li>
      </ul>
    </section>
  );
}

function StatusCard({ status, demo }: { status: FlightStatusType; demo?: boolean }) {
  const airborne = status.status === "in_air" || status.status === "departed";
  const pct = Math.round(status.progress * 100);
  return (
    <section className="fade-up rounded-xl border border-border bg-card p-6 sm:p-8">
      {demo && (
        <p className="mb-4 inline-block rounded-md border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">
          Demodata — ikke reell flystatus
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {formatDateLong(status.date)}
          </p>
          <h2 className="mt-1 font-display text-3xl">
            {status.carrier.name} {status.carrier.iata} {status.flightNumber}
          </h2>
        </div>
        <span className={`rounded-md border px-4 py-1.5 text-sm font-semibold ${STATUS_COLORS[status.status]}`}>
          {STATUS_LABELS[status.status]}
          {status.delayMinutes > 0 && status.status !== "landed" && ` · +${status.delayMinutes} min`}
        </span>
      </div>

      {/* route timeline */}
      <div className="mt-8">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>{status.origin.city}</span>
          <span>{status.destination.city}</span>
        </div>
        <div className="relative mt-3 h-1 rounded-full bg-secondary">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-skyline to-gold transition-all duration-1000"
            style={{ width: `${Math.max(2, pct)}%` }}
          />
          <Plane
            className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rotate-45 text-primary transition-all duration-1000"
            style={{ left: `calc(${Math.max(2, Math.min(96, pct))}% - 10px)` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{status.origin.iata}</span>
          {airborne && <span className="font-medium text-primary">{pct}% av flyturen</span>}
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
          <div key={t.label} className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{t.label}</p>
            <p className={`mt-1 font-display text-2xl ${t.late ? "text-primary" : ""}`}>{t.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-5 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-foreground" /> Gate {status.gate ?? "annonseres"}
        </span>
        <span className="flex items-center gap-2">
          <Plane className="h-4 w-4 text-foreground" /> {status.aircraft}
        </span>
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-foreground" />
          {status.fetchedAt
            ? `Sist oppdatert ${new Date(status.fetchedAt).toLocaleTimeString("nb-NO", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "Hentet akkurat nå"}
        </span>
      </div>
    </section>
  );
}

export default function FlightStatus() {
  usePageMeta(PAGE_META.flightStatus);
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
    submitted
      ? { carrier: submitted.c, flightNumber: submitted.f, date: submitted.d }
      : { carrier: "DY", flightNumber: "0", date: "2000-01-01" },
    { enabled: Boolean(submitted), retry: 1 },
  );

  const inputCls =
    "w-full rounded-xl border hairline bg-card px-4 py-3 text-base outline-none transition-colors focus:border-accent";

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 pb-20 pt-28 outline-none sm:px-6">
        <div className="bg-muted/40 border-b border-border -mx-4 -mt-28 mb-8 px-4 pb-10 pt-32 sm:-mx-6 sm:px-6">
          <p className="flex items-center gap-2 font-mono-label text-[11px] text-primary">
            <Radar className="h-4 w-4 text-foreground" aria-hidden="true" /> Flystatus
          </p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Hvor er flyet?</h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Slå opp et flightnummer for å se planlagte tider. Vi henviser til flyselskapet for
            oppdatert status når vi ikke har egne data.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (flight.trim()) setSubmitted({ c: carrier, f: flight.trim(), d: date });
          }}
          className="grid gap-3 rounded-xl border border-border bg-card shadow-soft p-5 sm:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <label className="block">
            <span className="mb-1.5 block eyebrow">
              Flyselskap
            </span>
            <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputCls + " min-h-11"}>
              {TRACKABLE_CARRIERS.map((c) => (
                <option key={c.iata} value={c.iata}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block eyebrow">
              Flightnummer
            </span>
            <input
              inputMode="numeric"
              placeholder="f.eks. 452"
              value={flight}
              onChange={(e) => setFlight(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className={inputCls + " min-h-11"}
            />
          </label>
          <div>
            <DateField value={date} onChange={setDate} placeholder="Dato" />
          </div>
          <button
            type="submit"
            disabled={!flight.trim()}
            className="flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40"
          >
            Sjekk fly <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <div className="mt-6">
          {status.isLoading && <div className="shimmer h-72 rounded-xl" />}
          {status.isError && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-8 text-center">
              <TriangleAlert className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
              <p className="mt-3 font-display text-2xl">Fant ikke flyvningen</p>
              <p className="mt-2 text-sm text-muted-foreground">{humanMessage(status.error)}</p>
            </div>
          )}
          {status.data && "unavailable" in status.data && <UnavailablePanel reason={status.data.reason} carrier={submitted?.c ?? carrier} />}
          {status.data && !("unavailable" in status.data) && <StatusCard status={status.data} demo={status.data.demo} />}
          {!submitted && (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Skriv inn flightnummeret — det står på billetten din, f.eks.{" "}
              <span className="font-semibold text-primary">DY 452</span> eller{" "}
              <span className="font-semibold text-primary">SK 278</span>.
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
