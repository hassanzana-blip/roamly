import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ArrowLeft,
  ArrowUpDown,
  BedDouble,
  Car,
  ChevronDown,
  CircleCheck,
  Fuel,
  Gauge,
  Info,
  Luggage,
  MapPin,
  Moon,
  Star,
  Users,
  X,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import Icon from "@/components/app/Icon";
import { formatPrice } from "@/lib/format";
import { humanMessage } from "@/lib/apiError";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@/providers/trpc";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type HotelItem = RouterOutputs["partners"]["searchHotels"]["results"][number];
type CarItem = RouterOutputs["partners"]["searchCars"]["results"][number];

const inputCls =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary";
const labelCls = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground";

type Sort = "price" | "class";

const SORTS: { id: Sort; label: string }[] = [
  { id: "price", label: "Billigst først" },
  { id: "class", label: "Stjerner / klasse" },
];

const PARTNER_NOTE = "Vi sender forespørselen til partner og svarer med pris — ingen betaling nå";

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
  });
}

/* ─── Booking-dialog: samler inn kontakt og forespørselen knyttes til valgt tilbud ── */

function BookDialog({
  kind,
  summary,
  details,
  onClose,
}: {
  kind: "hotel" | "car";
  summary: string;
  details: Record<string, string | number>;
  onClose: () => void;
}) {
  const submit = trpc.partners.submitRequest.useMutation();
  const [f, setF] = useState({ name: "", email: "", phone: "" });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-xl bg-card p-6" showCloseButton={false}>
        {submit.isSuccess ? (
          <div className="text-center">
            <CircleCheck className="mx-auto h-12 w-12 text-success" strokeWidth={1.6} aria-hidden="true" />
            <DialogTitle className="mt-4 font-display text-2xl">Forespørsel sendt!</DialogTitle>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              Vi sjekker pris og tilgjengelighet hos partneren og svarer deg på e-post. Du betaler ingenting nå.
            </DialogDescription>
            <p className="mt-3 rounded-xl bg-muted px-4 py-2.5 text-left text-xs text-muted-foreground">{summary}</p>
            <Link to="/" className="mt-5 inline-block min-h-11 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
              Tilbake til forsiden
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="font-display text-2xl">Be om tilbud</DialogTitle>
                <DialogDescription className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{summary}</DialogDescription>
              </div>
              <button type="button" onClick={onClose} aria-label="Lukk" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border hover:bg-muted">
                <Icon icon={X} size={16} />
              </button>
            </div>
            <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-muted px-3.5 py-2.5 text-[12px] leading-relaxed text-foreground">
              <Icon icon={Info} size={16} className="mt-0.5 shrink-0" />
              {PARTNER_NOTE}
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit.mutate({
                  type: kind,
                  customerName: f.name,
                  customerEmail: f.email,
                  customerPhone: f.phone || undefined,
                  details,
                });
              }}
            >
              <label className="block">
                <span className="sr-only">Fullt navn</span>
                <input required autoComplete="name" placeholder="Fullt navn" value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} className={inputCls} />
              </label>
              <label className="block">
                <span className="sr-only">E-post</span>
                <input required type="email" autoComplete="email" placeholder="E-post" value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} className={inputCls} />
              </label>
              <label className="block">
                <span className="sr-only">Telefon (valgfritt)</span>
                <input type="tel" autoComplete="tel" placeholder="Telefon (valgfritt)" value={f.phone} onChange={(e) => setF((p) => ({ ...p, phone: e.target.value }))} className={inputCls} />
              </label>
              {submit.isError && (
                <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
                  {humanMessage(submit.error)}
                </p>
              )}
              <button
                type="submit"
                disabled={submit.isPending}
                className="min-h-12 w-full rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
              >
                {submit.isPending ? "Sender …" : "Send forespørsel"}
              </button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Hotellkort ──────────────────────────────────────────────────────────── */

function HotelCard({ h, onBook }: { h: HotelItem; onBook: () => void }) {
  return (
    <article className="card-lift overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid sm:grid-cols-[220px_1fr]">
        <div className="img-zoom relative h-44 overflow-hidden sm:h-full">
          <img src={h.image} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[16px] font-semibold">{h.name}</h3>
              <span className="flex items-center gap-0.5 text-warning" role="img" aria-label={`${h.stars} stjerner`}>
                {Array.from({ length: h.stars }).map((_, i) => (
                  <Star key={i} size={12} className="fill-amber-400 text-amber-400" aria-hidden="true" />
                ))}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-[12px] text-muted-foreground">
              <Icon icon={MapPin} size={16} /> {h.area} · {h.distanceKm.toLocaleString("nb-NO")} km fra sentrum
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {h.amenities.map((a) => (
                <span key={a} className="rounded-md bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                  {a}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">{h.note}</p>
          </div>
          <div className="flex shrink-0 flex-row items-end justify-between gap-3 border-t border-border pt-3 sm:w-44 sm:flex-col sm:items-end sm:justify-center sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">
                {h.nights} {h.nights === 1 ? "natt" : "netter"} · {formatPrice(h.pricePerNight)}/natt
              </p>
              <p className="mt-0.5 text-[22px] font-semibold leading-none">{formatPrice(h.totalPrice)}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">veiledende for oppholdet</p>
            </div>
            <button
              type="button"
              onClick={onBook}
              className="min-h-11 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Be om tilbud
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ─── Bil-kort ────────────────────────────────────────────────────────────── */

function CarCard({ c, onBook }: { c: CarItem; onBook: () => void }) {
  return (
    <article className="card-lift rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{c.className}</p>
          <h3 className="mt-0.5 truncate text-[16px] font-semibold">{c.model} <span className="font-normal text-muted-foreground">eller lignende</span></h3>
          <p className="mt-1 text-[12px] font-semibold text-primary">{c.partner}</p>
        </div>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted">
          <Icon icon={Car} size={24} />
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-1"><Icon icon={Users} size={16} /> {c.seats} seter</span>
        <span className="flex items-center gap-1"><Icon icon={Luggage} size={16} /> {c.bags} kofferter</span>
        <span className="flex items-center gap-1"><Icon icon={Gauge} size={16} /> {c.transmission}</span>
        {c.unlimitedKm && <span className="flex items-center gap-1"><Icon icon={Fuel} size={16} /> Fri kilometer</span>}
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">{c.note}</p>
      <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
        <div>
          <p className="text-[11px] text-muted-foreground">
            {c.days} {c.days === 1 ? "dag" : "dager"} · {formatPrice(c.pricePerDay)}/dag
          </p>
          <p className="mt-0.5 text-[20px] font-semibold leading-none">{formatPrice(c.totalPrice)}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">veiledende for leieperioden</p>
        </div>
        <button
          type="button"
          onClick={onBook}
          className="min-h-11 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Be om tilbud
        </button>
      </div>
    </article>
  );
}

/* ─── Siden ───────────────────────────────────────────────────────────────── */

export default function StayResults() {
  usePageMeta(PAGE_META.stayResults);
  const [params, setParams] = useSearchParams();
  const type = params.get("type") === "bil" ? "bil" : "hotell";
  const place = params.get("sted") ?? "";
  const from = params.get("fra") ?? "";
  const to = params.get("til") ?? "";
  const count = Math.max(1, Math.min(8, Number(params.get("antall") ?? 2)));
  const [sort, setSort] = useState<Sort>("price");
  const [booking, setBooking] = useState<{ summary: string; details: Record<string, string | number> } | null>(null);

  const hotels = trpc.partners.searchHotels.useQuery(
    { place, checkin: from, checkout: to, guests: count },
    { enabled: type === "hotell" && place.length >= 2 && Boolean(from && to), retry: 1 },
  );
  const cars = trpc.partners.searchCars.useQuery(
    { place, pickupDate: from, returnDate: to },
    { enabled: type === "bil" && place.length >= 2 && Boolean(from && to), retry: 1 },
  );

  const hotelList = useMemo(() => {
    const list = [...(hotels.data?.results ?? [])];
    if (sort === "class") list.sort((a, b) => b.stars - a.stars || a.totalPrice - b.totalPrice);
    else list.sort((a, b) => a.totalPrice - b.totalPrice);
    return list;
  }, [hotels.data, sort]);

  const carList = useMemo(() => {
    const list = [...(cars.data?.results ?? [])];
    if (sort === "class") list.sort((a, b) => b.pricePerDay - a.pricePerDay);
    else list.sort((a, b) => a.totalPrice - b.totalPrice);
    return list;
  }, [cars.data, sort]);

  const loading = type === "hotell" ? hotels.isLoading : cars.isLoading;
  const error = type === "hotell" ? hotels.error : cars.error;
  const valid = place.length >= 2 && from && to;

  const updateQuery = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    setParams(next);
  };

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-4xl px-4 pb-20 pt-24 outline-none sm:px-6">
        <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <Icon icon={ArrowLeft} size={16} /> Tilbake til forsiden
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl sm:text-4xl">
            {type === "hotell" ? (
              <>Hoteller i <span className="hl">{place}</span></>
            ) : (
              <>Leiebil i <span className="hl">{place}</span></>
            )}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {fmtDate(from)} – {fmtDate(to)}
            {type === "hotell" ? ` · ${count} ${count === 1 ? "gjest" : "gjester"}` : ""}
          </p>
        </div>

        {/* Endre søket */}
        <details className="mt-5 rounded-lg border border-border bg-card">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
            Endre søket
            <Icon icon={ChevronDown} size={16} className="text-muted-foreground" />
          </summary>
          <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <span className={labelCls}>Sted</span>
              <input value={place} onChange={(e) => updateQuery({ sted: e.target.value })} className={inputCls} />
            </label>
            <label>
              <span className={labelCls}>{type === "hotell" ? "Innsjekk" : "Hentes"}</span>
              <input type="date" value={from} onChange={(e) => updateQuery({ fra: e.target.value })} className={inputCls} />
            </label>
            <label>
              <span className={labelCls}>{type === "hotell" ? "Utsjekk" : "Leveres"}</span>
              <input type="date" value={to} min={from} onChange={(e) => updateQuery({ til: e.target.value })} className={inputCls} />
            </label>
            {type === "hotell" && (
              <label>
                <span className={labelCls}>Gjester</span>
                <select value={count} onChange={(e) => updateQuery({ antall: e.target.value })} className={inputCls}>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
          </div>
        </details>

        {/* Sortering */}
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-[13px] leading-relaxed">
          <Icon icon={Info} size={16} className="mt-0.5 shrink-0" />
          {PARTNER_NOTE}. Prisene er veiledende{(hotels.data?.demoMode || cars.data?.demoMode) ? " (demodata)" : ""}.
        </p>

        <div className="mt-5 flex items-center gap-2" role="radiogroup" aria-label="Sortering">
          <Icon icon={ArrowUpDown} size={16} className="text-muted-foreground" />
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={sort === s.id}
              onClick={() => setSort(s.id)}
              className={cn(
                "min-h-11 rounded-lg px-3.5 text-[12px] font-semibold transition-colors",
                sort === s.id ? "bg-night text-white" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Resultater */}
        <div className="mt-5 space-y-4">
          {!valid && (
            <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Fyll inn sted og datoer for å se {type === "hotell" ? "hoteller" : "biler"}.
            </p>
          )}
          {loading && (
            <>
              <div className="shimmer h-40 rounded-xl" />
              <div className="shimmer h-40 rounded-xl" />
              <div className="shimmer h-40 rounded-xl" />
            </>
          )}
          {error && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-card p-8 text-center text-sm text-muted-foreground">
              {humanMessage(error)}
            </p>
          )}

          {type === "hotell" && hotelList.map((h) => (
            <HotelCard
              key={h.id}
              h={h}
              onBook={() =>
                setBooking({
                  summary: `${h.name}, ${h.area} · ${fmtDate(from)}–${fmtDate(to)} · ${h.nights} ${h.nights === 1 ? "natt" : "netter"} · ${formatPrice(h.totalPrice)} totalt`,
                  details: { tilbud: h.name, sted: place, checkin: from, checkout: to, gjester: count, netter: h.nights, total: h.totalPrice, valuta: "NOK" },
                })
              }
            />
          ))}

          {type === "bil" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {carList.map((c) => (
                <CarCard
                  key={c.id}
                  c={c}
                  onBook={() =>
                    setBooking({
                      summary: `${c.model} (${c.className}) hos ${c.partner} · ${fmtDate(from)}–${fmtDate(to)} · ${c.days} ${c.days === 1 ? "dag" : "dager"} · ${formatPrice(c.totalPrice)} totalt`,
                      details: { tilbud: `${c.model} hos ${c.partner}`, sted: place, hentes: from, leveres: to, dager: c.days, total: c.totalPrice, valuta: "NOK" },
                    })
                  }
                />
              ))}
            </div>
          )}

          {valid && !loading && !error && type === "hotell" && hotelList.length === 0 && (
            <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Fant ingen hoteller for disse datoene — prøv andre datoer.
            </p>
          )}
        </div>

        <p className="mt-6 flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
          <Icon icon={type === "hotell" ? BedDouble : Moon} size={16} className="mt-0.5 shrink-0" />
          Prisene er veiledende. Du betaler ingenting nå — vi bekrefter pris og vilkår hos partneren og
          sender deg et tilbud du kan takke ja eller nei til.
        </p>
      </main>
      <SiteFooter />

      {booking && (
        <BookDialog
          kind={type === "hotell" ? "hotel" : "car"}
          summary={booking.summary}
          details={booking.details}
          onClose={() => setBooking(null)}
        />
      )}
    </div>
  );
}
