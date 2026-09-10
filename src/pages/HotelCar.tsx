import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  BedDouble,
  Car,
  CheckCircle2,
  ChevronDown,
  Ship,
  ShieldCheck,
  Clock,
  Sparkles,
} from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { trpc } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { PAGE_META, usePageMeta } from "@/lib/seo";

const PARTNER_NOTE = "Vi sender forespørselen til partner og svarer med pris – ingen betaling nå";

const CAR_PARTNERS = ["Europcar", "Hertz", "Avis", "Sixt"];
const CAR_CLASSES = ["Liten og smart", "Kompakt", "Familiebil / SUV", "Premium", "Elbil"];

const inputCls =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary";
const labelCls = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground";

type Tab = "hotel" | "car" | "cruise";

const CRUISE_REGIONS = ["Norske fjorder", "Middelhavet", "Karibien", "Adriaterhavet", "Vet ikke ennå – finn noe fint"];
const CRUISE_LINES_LIST = ["Norwegian Cruise Line", "MSC Cruises", "Royal Caribbean", "Costa Cruises", "Hurtigruten", "Princess Cruises"];
const CABIN_WISHES = ["Ingen preferanse", "Innvendig lugar", "Utvendig lugar", "Balkonglugar", "Suite"];

export default function HotelCar() {
  usePageMeta(PAGE_META.hotelCar);
  const [params] = useSearchParams();
  const fane = params.get("fane");
  const [tab, setTab] = useState<Tab>(fane === "bil" ? "car" : fane === "cruise" ? "cruise" : "hotel");

  // Kommer man fra forsidesøket, rulles man rett til skjemaet
  useEffect(() => {
    if (params.get("sted")) {
      setTimeout(() => document.getElementById("skjema")?.scrollIntoView({ behavior: "smooth" }), 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">

      {/* ── Hero med to kort ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 sm:pt-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Mer enn fly
          </p>
          <h1 className="mt-2 font-display text-4xl leading-[1.05] sm:text-5xl">
            Hotell, cruise og leiebil, ordnet av oss
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Fortell oss hvor du skal – vi sjekker pris og tilgjengelighet hos partnerne våre
            og kommer tilbake til deg med et konkret tilbud. {PARTNER_NOTE}.
          </p>

          <div className="mt-8 grid gap-4 pb-10 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                {
                  key: "hotel" as Tab,
                  img: "/partners/hotel.jpg",
                  icon: BedDouble,
                  title: "Hotell",
                  sub: "Håndplukkede hoteller over hele verden",
                },
                {
                  key: "cruise" as Tab,
                  img: "/photos/cruise-hero.jpg",
                  icon: Ship,
                  title: "Cruise",
                  sub: "Karibien, Middelhavet og norske fjorder",
                },
                {
                  key: "car" as Tab,
                  img: "/partners/car.jpg",
                  icon: Car,
                  title: "Leiebil",
                  sub: "Europcar, Hertz, Avis og Sixt",
                },
              ]
            ).map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  setTab(c.key);
                  document.getElementById("skjema")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={cn(
                  "group relative overflow-hidden rounded-lg border border-border text-left transition-[border-color,box-shadow,background-color] duration-base",
                  tab === c.key ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "opacity-90 hover:opacity-100",
                )}
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <img
                    src={c.img}
                    alt={c.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/25 to-transparent" />
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
                  <div>
                    <p className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
                      <c.icon className="h-5 w-5" /> {c.title}
                    </p>
                    <p className="mt-1 text-xs text-white/75">{c.sub}</p>
                  </div>
                  {tab === c.key && (
                    <span className="rounded-md bg-primary px-3 py-1 text-[11px] font-semibold text-white">Valgt</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <p className="pb-10 text-sm text-muted-foreground">
            Vil du se veiledende priser med en gang?{" "}
            <Link to={`/overnatting-bil?type=${tab === "car" ? "bil" : tab === "cruise" ? "cruise" : "hotell"}`} className="font-semibold text-foreground underline underline-offset-4">
              Bla i katalogen først
            </Link>
          </p>
        </div>
      </section>

      {/* ── Fordelsstripe ────────────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
          {[
            { icon: ShieldCheck, title: "Etablerte partnere", sub: "Vi bruker kjente hotell- og bilutleiepartnere" },
            { icon: Clock, title: "Svar innen 24 timer", sub: "Et menneske hos oss finner alternativer til deg" },
            { icon: Sparkles, title: "Uforpliktende", sub: "Du får et tilbud – og betaler ingenting nå" },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                <f.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">{f.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Skjema ───────────────────────────────────────────────────── */}
      <section id="skjema" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-14 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-8">
              {tab === "hotel" ? <HotelForm /> : tab === "cruise" ? <CruiseForm /> : <CarForm />}
            </div>
          </motion.div>
        </AnimatePresence>
      </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/* ── Hotellskjema ─────────────────────────────────────────────────────────── */

function HotelForm() {
  const submit = trpc.partners.submitRequest.useMutation();
  const [params] = useSearchParams();
  const [f, setF] = useState({
    city: params.get("sted") ?? "",
    checkin: params.get("fra") ?? "",
    checkout: params.get("til") ?? "",
    guests: params.get("antall") ?? "2",
    wishes: "",
    customerName: "", customerEmail: "", customerPhone: "", website: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  if (submit.isSuccess) return <SuccessMessage what="hotellforespørselen" />;

  return (
    <div>
      <h2 className="font-display text-2xl sm:text-3xl">
        <BedDouble className="mr-2 inline h-7 w-7 text-primary" aria-hidden="true" /> Be om hotelltilbud
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Fortell oss hvor og når – vi sjekker priser og tilgjengelighet og sender deg alternativer på e-post.
      </p>
      <form
        className="mt-7 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate({
            type: "hotel",
            customerName: f.customerName,
            customerEmail: f.customerEmail,
            customerPhone: f.customerPhone || undefined,
            website: f.website,
            details: { city: f.city, checkin: f.checkin, checkout: f.checkout, guests: f.guests, wishes: f.wishes },
          });
        }}
      >
        <label className="block sm:col-span-2">
          <span className={labelCls}>Hvor skal du bo?</span>
          <input required className={cn(inputCls, "min-h-11")} value={f.city} onChange={set("city")} placeholder="F.eks. Roma, sentrum" />
        </label>
        <label className="block">
          <span className={labelCls}>Innsjekk</span>
          <input required type="date" className={cn(inputCls, "min-h-11")} value={f.checkin} onChange={set("checkin")} />
        </label>
        <label className="block">
          <span className={labelCls}>Utsjekk</span>
          <input required type="date" className={cn(inputCls, "min-h-11")} value={f.checkout} onChange={set("checkout")} />
        </label>
        <label className="block">
          <span className={labelCls}>Gjester</span>
          <div className="relative">
            <select className={cn(inputCls, "min-h-11 appearance-none")} value={f.guests} onChange={set("guests")}>
              {["1", "2", "3", "4", "5+"].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          </div>
        </label>
        <label className="block">
          <span className={labelCls}>Ønsker (valgfritt)</span>
          <input className={cn(inputCls, "min-h-11")} value={f.wishes} onChange={set("wishes")} placeholder="Basseng, frokost, romantisk …" />
        </label>
        <ContactFields f={f} set={set} />
        <SubmitRow pending={submit.isPending} error={submit.error ? humanMessage(submit.error) : undefined} label="Send forespørsel" />
      </form>
    </div>
  );
}

/* ── Bilskjema ────────────────────────────────────────────────────────────── */

function CarForm() {
  const submit = trpc.partners.submitRequest.useMutation();
  const [params] = useSearchParams();
  const [partner, setPartner] = useState<string>("Europcar");
  const [f, setF] = useState({
    pickup: params.get("sted") ?? "",
    pickupDate: params.get("fra") ?? "",
    returnDate: params.get("til") ?? "",
    carClass: CAR_CLASSES[1],
    driverAge: "30",
    customerName: "", customerEmail: "", customerPhone: "", website: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  if (submit.isSuccess) return <SuccessMessage what="forespørselen om leiebil" />;

  return (
    <div>
      <h2 className="font-display text-2xl sm:text-3xl">
        <Car className="mr-2 inline h-7 w-7 text-primary" aria-hidden="true" /> Be om leiebiltilbud
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Vi samarbeider med Europcar, Hertz, Avis og Sixt – velg favoritten din, eller la oss finne beste pris.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {CAR_PARTNERS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPartner(p)}
            aria-pressed={partner === p}
            className={cn(
              "min-h-11 rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors",
              partner === p
                ? "border-primary bg-primary text-white shadow-md shadow-primary/25"
                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPartner("Beste pris")}
          aria-pressed={partner === "Beste pris"}
          className={cn(
            "min-h-11 rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors",
            partner === "Beste pris"
              ? "border-primary bg-primary text-white shadow-md shadow-primary/25"
              : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
          )}
        >
          ✦ Beste pris
        </button>
      </div>

      <form
        className="mt-6 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate({
            type: "car",
            partner,
            customerName: f.customerName,
            customerEmail: f.customerEmail,
            customerPhone: f.customerPhone || undefined,
            website: f.website,
            details: {
              pickup: f.pickup, pickupDate: f.pickupDate, returnDate: f.returnDate,
              carClass: f.carClass, driverAge: f.driverAge,
            },
          });
        }}
      >
        <label className="block sm:col-span-2">
          <span className={labelCls}>Hentested</span>
          <input required className={cn(inputCls, "min-h-11")} value={f.pickup} onChange={set("pickup")} placeholder="F.eks. Roma Fiumicino flyplass" />
        </label>
        <label className="block">
          <span className={labelCls}>Hentedato</span>
          <input required type="date" className={cn(inputCls, "min-h-11")} value={f.pickupDate} onChange={set("pickupDate")} />
        </label>
        <label className="block">
          <span className={labelCls}>Returdato</span>
          <input required type="date" className={cn(inputCls, "min-h-11")} value={f.returnDate} onChange={set("returnDate")} />
        </label>
        <label className="block">
          <span className={labelCls}>Bilklasse</span>
          <div className="relative">
            <select className={cn(inputCls, "min-h-11 appearance-none")} value={f.carClass} onChange={set("carClass")}>
              {CAR_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          </div>
        </label>
        <label className="block">
          <span className={labelCls}>Førerens alder</span>
          <input required inputMode="numeric" className={cn(inputCls, "min-h-11")} value={f.driverAge} onChange={set("driverAge")} placeholder="30" />
        </label>
        <ContactFields f={f} set={set} />
        <SubmitRow pending={submit.isPending} error={submit.error ? humanMessage(submit.error) : undefined} label="Send forespørsel" />
      </form>
    </div>
  );
}

/* ── Cruiseskjema ─────────────────────────────────────────────────────────── */

function CruiseForm() {
  const submit = trpc.partners.submitRequest.useMutation();
  const [params] = useSearchParams();
  const [f, setF] = useState({
    region: params.get("region") ?? CRUISE_REGIONS[0],
    departureDate: params.get("fra") ?? "",
    guests: params.get("antall") ?? "2",
    cabinType: CABIN_WISHES[0],
    wishes: "",
    customerName: "", customerEmail: "", customerPhone: "", website: "",
  });
  const [line, setLine] = useState<string>("Beste pris");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  if (submit.isSuccess) return <SuccessMessage what="cruiseforespørselen" />;

  return (
    <div>
      <h2 className="font-display text-2xl sm:text-3xl">
        <Ship className="mr-2 inline h-7 w-7 text-primary" aria-hidden="true" /> Be om cruisetilbud
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Karibien, Middelhavet eller norske fjorder – vi finner seilingen som passer, med pris fra rederiet.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {[...CRUISE_LINES_LIST, "Beste pris"].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setLine(p)}
            aria-pressed={line === p}
            className={cn(
              "min-h-11 rounded-lg border px-4 py-2.5 text-[13px] font-semibold transition-colors",
              line === p
                ? "border-primary bg-primary text-white shadow-md shadow-primary/25"
                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            {p === "Beste pris" ? "✦ Beste pris" : p}
          </button>
        ))}
      </div>

      <form
        className="mt-6 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate({
            type: "cruise",
            partner: line === "Beste pris" ? undefined : line,
            customerName: f.customerName,
            customerEmail: f.customerEmail,
            customerPhone: f.customerPhone || undefined,
            website: f.website,
            details: {
              region: f.region,
              departureDate: f.departureDate,
              guests: f.guests,
              cabinType: f.cabinType,
              wishes: f.wishes,
            },
          });
        }}
      >
        <label className="block sm:col-span-2">
          <span className={labelCls}>Hvor vil du seile?</span>
          <div className="relative">
            <select className={cn(inputCls, "min-h-11 appearance-none")} value={f.region} onChange={set("region")}>
              {CRUISE_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          </div>
        </label>
        <label className="block">
          <span className={labelCls}>Tidligste avreise</span>
          <input required type="date" className={cn(inputCls, "min-h-11")} value={f.departureDate} onChange={set("departureDate")} />
        </label>
        <label className="block">
          <span className={labelCls}>Gjester</span>
          <div className="relative">
            <select className={cn(inputCls, "min-h-11 appearance-none")} value={f.guests} onChange={set("guests")}>
              {["1", "2", "3", "4", "5+"].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          </div>
        </label>
        <label className="block">
          <span className={labelCls}>Lugartype</span>
          <div className="relative">
            <select className={cn(inputCls, "min-h-11 appearance-none")} value={f.cabinType} onChange={set("cabinType")}>
              {CABIN_WISHES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          </div>
        </label>
        <label className="block">
          <span className={labelCls}>Ønsker (valgfritt)</span>
          <input className={cn(inputCls, "min-h-11")} value={f.wishes} onChange={set("wishes")} placeholder="Bryllupsreise, familie, landutflukter …" />
        </label>
        <ContactFields f={f} set={set} />
        <SubmitRow pending={submit.isPending} error={submit.error ? humanMessage(submit.error) : undefined} label="Send forespørsel" />
      </form>
    </div>
  );
}

/* ── Felles felt ──────────────────────────────────────────────────────────── */

type ContactFieldState = { customerName: string; customerEmail: string; customerPhone: string; website: string };

function ContactFields({
  f, set,
}: {
  f: ContactFieldState;
  set: (k: keyof ContactFieldState) => (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <label className="block">
        <span className={labelCls}>Navn</span>
        <input required className={cn(inputCls, "min-h-11")} value={f.customerName} onChange={set("customerName")} placeholder="Ditt navn" />
      </label>
      <label className="block">
        <span className={labelCls}>E-post</span>
        <input required type="email" className={cn(inputCls, "min-h-11")} value={f.customerEmail} onChange={set("customerEmail")} placeholder="deg@epost.no" />
      </label>
      <label className="block sm:col-span-2">
        <span className={labelCls}>Telefon (valgfritt – raskere svar)</span>
        <input className={cn(inputCls, "min-h-11")} value={f.customerPhone} onChange={set("customerPhone")} placeholder="+47 …" />
      </label>
      {/* Honeypot */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        value={f.website}
        onChange={set("website")}
      />
    </>
  );
}

function SubmitRow({ pending, error, label }: { pending: boolean; error?: string; label: string }) {
  return (
    <div className="sm:col-span-2">
      {error && (
        <p role="alert" className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="mb-3 rounded-xl border border-border bg-muted/50 px-4 py-3 text-[13px] leading-relaxed">
        {PARTNER_NOTE}.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-semibold text-white shadow-xs transition-colors hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "Sender …" : label}
      </button>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Helt uforpliktende – vi svarer med et konkret tilbud innen 24 timer.
      </p>
    </div>
  );
}

function SuccessMessage({ what }: { what: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-lg border border-success/30 bg-success/5 p-10 text-center"
    >
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2 className="h-7 w-7 text-success" />
      </span>
      <h2 className="mt-4 font-display text-2xl">Takk – vi har mottatt {what}!</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Noen på HelloSky-teamet ser på dette og kommer tilbake til deg med et tilbud
        innen 24 timer. Du betaler ingenting nå.
      </p>
    </motion.div>
  );
}
