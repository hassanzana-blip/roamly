import { Link, useParams } from "react-router";
import { motion } from "motion/react";
import { Clock, MessageCircle, Phone, ShieldCheck, Ticket, CheckCircle2, AlertCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import RoamlyMark from "@/components/brand/RoamlyMark";

type Slice = {
  origin?: { city?: string; cityName?: string; iata?: string };
  destination?: { city?: string; cityName?: string; iata?: string };
  departingAt?: string;
  arrivingAt?: string;
  duration?: string;
};

const money = (amount: string, currency: string) =>
  new Intl.NumberFormat("nb-NO", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount));

const dt = (value: string | Date | undefined) => {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat("nb-NO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
};

function place(p?: { city?: string; cityName?: string; iata?: string }) {
  const name = p?.city ?? p?.cityName ?? "";
  return p?.iata ? `${name} (${p.iata})` : name || "–";
}

export default function QuotePage() {
  const { token } = useParams<{ token: string }>();
  const quote = trpc.quotesPublic.getByToken.useQuery(
    { token: token ?? "" },
    { enabled: Boolean(token && token.length >= 32), retry: false },
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <RoamlyMark className="h-7 w-7" />
            <span className="font-display text-xl font-bold text-night">roamly</span>
          </Link>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Sikker tilbudslenke
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {quote.isLoading && (
          <div className="space-y-4" aria-label="Laster tilbud">
            <div className="h-10 w-2/3 animate-pulse rounded-xl bg-night/5" />
            <div className="h-48 animate-pulse rounded-3xl bg-night/5" />
          </div>
        )}

        {quote.error && (
          <div className="rounded-3xl border border-border bg-white p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
            <h1 className="mt-4 font-display text-2xl font-bold text-night">Lenken er ikke gyldig</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {quote.error.message} Kontakt oss, så sender vi en ny.
            </p>
            <a
              href="https://wa.me/4797917976"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white hover:brightness-110"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Kontakt oss på WhatsApp
            </a>
          </div>
        )}

        {quote.data && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
              Tilbud {quote.data.reference}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-night sm:text-4xl">
              Hei {quote.data.customerName} – reisen din er klar til bestilling
            </h1>
            <p className="mt-2 text-muted-foreground">
              {quote.data.route} · {quote.data.passengers} {quote.data.passengers === 1 ? "passasjer" : "passasjerer"}
              {quote.data.cabinClass ? ` · ${quote.data.cabinClass}` : ""}
            </p>

            {quote.data.status === "expired" ? (
              <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center">
                <Clock className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
                <p className="mt-3 font-display text-xl font-bold text-night">Tilbudet er utløpt</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Flypriser endrer seg raskt. Kontakt oss, så lager vi et ferskt tilbud til deg.
                </p>
                <a
                  href="https://wa.me/4797917976"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white hover:brightness-110"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" /> Få nytt tilbud
                </a>
              </div>
            ) : quote.data.status === "booked" || quote.data.status === "paid" ? (
              <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
                <p className="mt-3 font-display text-xl font-bold text-night">
                  {quote.data.status === "booked" ? "Denne reisen er allerede booket" : "Betalingen er registrert"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Du mottar bekreftelse og billetter på e-post. Kontakt oss hvis du har spørsmål.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-8 space-y-3">
                  {(quote.data.slices as Slice[]).map((s, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Ticket className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-night">
                          {place(s.origin)} → {place(s.destination)}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {dt(s.departingAt)}{s.arrivingAt ? ` – ${dt(s.arrivingAt)}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-3xl border border-border bg-white p-6 shadow-sm">
                  <h2 className="font-display text-lg font-bold text-night">Pris</h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Flybilletter</dt>
                      <dd className="font-semibold text-night">{money(quote.data.offerAmount, quote.data.currency)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Servicegebyr Roamly</dt>
                      <dd className="font-semibold text-night">{money(quote.data.serviceFeeAmount, quote.data.currency)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-border pt-3">
                      <dt className="font-display text-base font-bold text-night">Totalt</dt>
                      <dd className="font-display text-xl font-bold text-primary">
                        {money(quote.data.totalAmount, quote.data.currency)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Prisen er holdt av til {dt(quote.data.expiresAt)}
                  </p>
                </div>

                <div className="mt-6 rounded-3xl bg-night p-6 text-white">
                  <h2 className="font-display text-lg font-bold">Slik fullfører du</h2>
                  <p className="mt-2 text-sm text-white/80">
                    Roamly ber aldri om kortinformasjon på e-post eller i skjema. Ta kontakt, så
                    bekrefter vi detaljene og sender deg trygg betalingsinformasjon – deretter
                    bookes billettene umiddelbart.
                  </p>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <a
                      href="https://wa.me/4797917976"
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3.5 text-sm font-bold text-night hover:brightness-105"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp 979 17 976
                    </a>
                    <a
                      href="tel:+4797917976"
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/30 px-6 py-3.5 text-sm font-bold text-white hover:bg-white/10"
                    >
                      <Phone className="h-4 w-4" aria-hidden="true" /> Ring oss
                    </a>
                  </div>
                  <p className="mt-4 text-center text-xs text-white/50">Personlig reisehjelp · alle dager 06–24</p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
