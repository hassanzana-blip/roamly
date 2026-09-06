import { Link, useParams } from "react-router";
import { CheckCircle2, Copy, Mail, Radar, LifeBuoy } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { SliceViz } from "@/components/offers/OfferCard";
import { CABIN_LABELS, formatDateLong, formatPrice } from "@/lib/format";

export default function Confirmation() {
  const { orderId = "" } = useParams();
  const order = trpc.flights.getOrder.useQuery({ orderId }, { enabled: Boolean(orderId), retry: 1 });
  const [copied, setCopied] = useState(false);

  const copyRef = (ref: string) => {
    navigator.clipboard.writeText(ref).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const o = order.data;
  const firstSlice = o?.slices[0];

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-28 sm:px-6">
        {order.isLoading && (
          <div className="space-y-4">
            <div className="shimmer h-24 rounded-3xl" />
            <div className="shimmer h-56 rounded-3xl" />
          </div>
        )}

        {order.isError && (
          <div className="rounded-3xl border hairline bg-card p-8 text-center">
            <p className="font-display text-2xl">Vi fant ikke bestillingen</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Den kan ha blitt opprettet i en annen økt. Prøv å slå den opp med referanse og e-post.
            </p>
            <Link
              to="/reise"
              className="mt-6 inline-block rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
            >
              Finn bestilling
            </Link>
          </div>
        )}

        {o && (
          <div className="space-y-6">
            {/* hero */}
            <section className="fade-up rounded-3xl border hairline bg-card p-8 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-gold" strokeWidth={1.6} />
              <h1 className="mt-4 font-display text-4xl sm:text-5xl">
                God tur{o.passengers[0] ? `, ${o.passengers[0].givenName}` : ""}!
              </h1>
              <p className="mt-3 text-muted-foreground">
                Billetten er utstedt og sendt til{" "}
                <span className="font-medium text-foreground">{o.contactEmail}</span>
              </p>
              <button
                onClick={() => copyRef(o.bookingReference)}
                className="group mx-auto mt-6 flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 px-6 py-3 transition-colors hover:bg-gold/20"
                aria-label="Kopier bookingreferanse"
              >
                <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Bookingreferanse
                </span>
                <span className="font-display text-3xl tracking-[0.12em] text-gold">
                  {o.bookingReference}
                </span>
                <Copy className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-gold" />
              </button>
              {copied && <p className="mt-2 text-xs font-medium text-gold">Kopiert!</p>}
              {o.demoMode && (
                <p className="mt-4 inline-block rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                  Demobestilling — ingen reell billett er utstedt
                </p>
              )}
            </section>

            {/* itinerary */}
            <section className="fade-up fade-up-1 rounded-3xl border hairline bg-card p-6 sm:p-8">
              <h2 className="mb-6 font-display text-2xl">Reiserute</h2>
              <div className="space-y-8">
                {o.slices.map((s, i) => (
                  <div key={s.id}>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-skyline">
                      {i === 0 ? "Utreise" : "Hjemreise"} · {formatDateLong(s.departingAt)}
                    </p>
                    <SliceViz slice={s} />
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {s.segments.map((seg) => (
                        <span key={seg.id}>
                          {seg.carrier.name} {seg.carrier.iata} {seg.flightNumber} · {seg.aircraft}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid gap-2 border-t hairline pt-5 text-sm sm:grid-cols-2">
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
                  Betalt:{" "}
                  <span className="font-medium text-gold">{formatPrice(o.totalAmount, o.totalCurrency)}</span>
                </p>
                <p className="text-muted-foreground">
                  Status: <span className="font-medium text-gold">Bekreftet</span>
                </p>
                {o.services && (o.services.extraBags > 0 || Object.keys(o.services.seats).length > 0) && (
                  <p className="text-muted-foreground sm:col-span-2">
                    Tilvalg:{" "}
                    <span className="font-medium text-foreground">
                      {[
                        o.services.extraBags > 0 ? `${o.services.extraBags} ekstra kolli` : "",
                        Object.keys(o.services.seats).length > 0
                          ? `seter ${Object.values(o.services.seats).join(", ")}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </p>
                )}
              </div>
            </section>

            {/* next steps */}
            <section className="fade-up fade-up-2 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border hairline bg-card p-5">
                <Mail className="h-5 w-5 text-gold" />
                <h3 className="mt-3 text-sm font-bold">Sjekk innboksen</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Reisekvittering med billettnummer er sendt. Sjekk søppelpost hvis den ikke dukker opp.
                </p>
              </div>
              <Link to={`/flystatus?carrier=${firstSlice?.segments[0]?.carrier.iata ?? ""}&flight=${firstSlice?.segments[0]?.flightNumber ?? ""}&date=${firstSlice?.departingAt.slice(0, 10) ?? ""}`} className="card-lift rounded-3xl border hairline bg-card p-5">
                <Radar className="h-5 w-5 text-gold" />
                <h3 className="mt-3 text-sm font-bold">Følg flyet ditt</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Se gate, tidspunkt og status for {firstSlice?.segments[0]?.carrier.iata} {firstSlice?.segments[0]?.flightNumber}.
                </p>
              </Link>
              <Link to="/hjelp" className="card-lift rounded-3xl border hairline bg-card p-5">
                <LifeBuoy className="h-5 w-5 text-gold" />
                <h3 className="mt-3 text-sm font-bold">Trenger du noe?</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Vår norske kundeservice hjelper deg alle dager 06–24.
                </p>
              </Link>
            </section>

            <div className="text-center">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-2xl border hairline px-8 py-4 text-sm font-bold transition-colors hover:border-gold hover:text-gold"
              >
                Planlegg neste reise
              </Link>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
