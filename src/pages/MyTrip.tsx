import { useState } from "react";
import { Link } from "react-router";
import { KeyRound, Luggage, Radar, Search } from "lucide-react";
import { trpc } from "@/providers/trpc";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { SliceViz } from "@/components/offers/OfferCard";
import { CABIN_LABELS, formatDateLong, formatPrice } from "@/lib/format";
import type { Order, Segment } from "@contracts/types";

function SegmentStatus({ seg }: { seg: Segment }) {
  const date = seg.departingAt.slice(0, 10);
  const status = trpc.flights.flightStatus.useQuery(
    { carrier: seg.carrier.iata, flightNumber: seg.flightNumber, date },
    { retry: 0, staleTime: 60_000 },
  );
  if (!status.data) return null;
  return (
    <Link
      to={`/flystatus?carrier=${seg.carrier.iata}&flight=${seg.flightNumber}&date=${date}`}
      className="mt-2 flex items-center gap-2 text-xs font-medium text-gold transition-opacity hover:opacity-80"
    >
      <Radar className="h-3.5 w-3.5" />
      {status.data.status === "landed"
        ? "Landet"
        : status.data.delayMinutes > 0
          ? `Forsinket ca. ${status.data.delayMinutes} min — se status`
          : "I rute — se sanntidsstatus"}
    </Link>
  );
}

function OrderView({ order: o }: { order: Order }) {
  return (
    <div className="fade-up space-y-6">
      <section className="rounded-3xl border hairline bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Bookingreferanse
            </p>
            <p className="mt-1 font-display text-4xl tracking-[0.1em] text-gold">
              {o.bookingReference}
            </p>
          </div>
          <span className="rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-sm font-bold text-gold">
            Bekreftet
          </span>
        </div>
        <div className="mt-5 grid gap-2 border-t hairline pt-5 text-sm sm:grid-cols-2">
          <p className="text-muted-foreground">
            Reisende:{" "}
            <span className="font-medium text-foreground">
              {o.passengers.map((p) => `${p.givenName} ${p.familyName}`).join(", ")}
            </span>
          </p>
          <p className="text-muted-foreground">
            Klasse: <span className="font-medium text-foreground">{CABIN_LABELS[o.cabinClass]}</span>
          </p>
          <p className="text-muted-foreground">
            Betalt: <span className="font-medium text-gold">{formatPrice(o.totalAmount, o.totalCurrency)}</span>
          </p>
          <p className="text-muted-foreground">
            Bestilt:{" "}
            <span className="font-medium text-foreground">{formatDateLong(o.createdAt)}</span>
          </p>
        </div>
      </section>

      {o.slices.map((s, i) => (
        <section key={s.id} className="rounded-3xl border hairline bg-card p-6 sm:p-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-skyline">
            {i === 0 ? "Utreise" : "Hjemreise"} · {formatDateLong(s.departingAt)}
          </p>
          <SliceViz slice={s} />
          <div className="mt-4 space-y-1.5">
            {s.segments.map((seg) => (
              <div key={seg.id} className="rounded-2xl bg-muted/50 px-4 py-3">
                <p className="text-sm">
                  <span className="font-bold">
                    {seg.carrier.iata} {seg.flightNumber}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    · {seg.origin.iata} → {seg.destination.iata} · {seg.aircraft}
                  </span>
                </p>
                <SegmentStatus seg={seg} />
              </div>
            ))}
          </div>
        </section>
      ))}

      {o.services && (o.services.extraBags > 0 || Object.keys(o.services.seats).length > 0) && (
        <section className="rounded-3xl border hairline bg-card p-6 sm:p-8">
          <h2 className="mb-4 font-display text-2xl">Tilvalg</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            {o.services.extraBags > 0 && (
              <p>
                Ekstra innsjekket bagasje:{" "}
                <span className="font-medium text-foreground">{o.services.extraBags} kolli</span>
              </p>
            )}
            {Object.keys(o.services.seats).length > 0 && (
              <p>
                Seter:{" "}
                <span className="font-medium text-foreground">
                  {o.passengers
                    .filter((p) => o.services!.seats[p.id])
                    .map((p) => `${p.givenName} → ${o.services!.seats[p.id]}`)
                    .join(", ")}
                </span>
              </p>
            )}
          </div>
        </section>
      )}

      <section className="rounded-3xl border hairline bg-card p-6 text-center">
        <p className="font-display text-xl">Trenger du å endre noe?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Vi ordner endringer og kanselleringer for deg — oppgi bookingreferansen{" "}
          {o.bookingReference}, så ser vi hva billetten din tillater.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link
            to={`/hjelp?ref=${o.bookingReference}&topic=change`}
            className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
          >
            Be om endring
          </Link>
          <Link
            to={`/hjelp?ref=${o.bookingReference}&topic=refund`}
            className="rounded-2xl border hairline px-6 py-3 text-sm font-medium transition-colors hover:border-gold hover:text-gold"
          >
            Be om kansellering
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function MyTrip() {
  const [ref, setRef] = useState("");
  const [email, setEmail] = useState("");
  const [lookup, setLookup] = useState<{ r: string; e: string } | null>(null);

  const query = trpc.flights.findBooking.useQuery(
    { bookingReference: lookup!.r, email: lookup!.e },
    { enabled: Boolean(lookup), retry: 0 },
  );

  const inputCls =
    "w-full rounded-xl border hairline bg-card px-4 py-3.5 text-base outline-none transition-colors focus:border-accent placeholder:text-muted-foreground/60";

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-28 sm:px-6">
        <div className="aurora-band -mx-4 -mt-28 mb-8 px-4 pb-10 pt-32 sm:-mx-6 sm:px-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-skyline">
            <Luggage className="h-4 w-4 text-gold" /> Min reise
          </p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Finn bestillingen din</h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Se reiserute, billettstatus og sanntidsinfo om flyene dine — alt du
            trenger er bookingreferansen fra bekreftelsen.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setLookup({ r: ref.trim().toUpperCase(), e: email.trim() });
          }}
          className="rounded-3xl border hairline glass p-5 sm:p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Bookingreferanse
              </span>
              <input
                placeholder="f.eks. X7K2P9"
                value={ref}
                onChange={(e) => setRef(e.target.value.toUpperCase())}
                maxLength={8}
                className={inputCls + " font-mono tracking-[0.2em]"}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                E-post brukt ved bestilling
              </span>
              <input
                type="email"
                placeholder="deg@eksempel.no"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          {query.isError && (
            <p className="mt-4 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
              {query.error.message}
            </p>
          )}
          <button
            type="submit"
            disabled={ref.trim().length < 5 || !email.includes("@") || query.isFetching}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-40"
          >
            <Search className="h-4 w-4" />
            {query.isFetching ? "Ser etter reisen din …" : "Vis min reise"}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <KeyRound className="h-3 w-3" /> Vi deler aldri reiseinformasjonen din med andre.
          </p>
        </form>

        <div className="mt-8">{query.data && <OrderView order={query.data} />}</div>
      </main>

      <SiteFooter />
    </div>
  );
}
