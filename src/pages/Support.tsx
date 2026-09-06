import { useState } from "react";
import { useSearchParams } from "react-router";
import { CheckCircle2, Clock3, LifeBuoy, Mail, Phone, Send } from "lucide-react";
import { trpc } from "@/providers/trpc";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { WhatsAppIcon, WHATSAPP_LINK, WHATSAPP_DISPLAY } from "@/components/WhatsAppFab";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TOPIC_LABELS } from "@/lib/format";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Hvordan endrer jeg flybilletten min?",
    a: "Send oss bookingreferansen din via skjemaet på denne siden eller ring 22 41 00 00, så sjekker vi hva billetttypen din tillater. Billetter merket «kan endres» kan som regel flyttes mot et lite gebyr og eventuell prisdifferanse. Vi gjør hele jobben med flyselskapet for deg.",
  },
  {
    q: "Kan jeg få refundert billetten?",
    a: "Det avhenger av billetttypen. Refunderbare billetter kan kanselleres med full eller delvis tilbakebetaling. For ikke-refunderbare billetter får du i mange tilfeller igjen skatter og avgifter. Hvis flyselskapet kansellerer eller endrer flyvningen vesentlig, har du som hovedregel rett på full refusjon — da ordner vi alt for deg.",
  },
  {
    q: "Hvor mye bagasje er inkludert?",
    a: "Bagasjereglene vises tydelig på hvert tilbud før du bestiller, og står også i reisekvitteringen din. Håndbagasje er alltid inkludert. Trenger du ekstra innsjekket bagasje, kan vi legge det til i etterkant — ta kontakt med bookingreferansen din.",
  },
  {
    q: "Når må jeg sjekke inn?",
    a: "Innsjekking åpner vanligvis 24–48 timer før avgang og gjøres direkte hos flyselskapet med bookingreferansen din. Vi anbefaler å være på flyplassen minst 2 timer før avgang innenlands og 3 timer før utenlandsreiser.",
  },
  {
    q: "Flyet mitt er forsinket eller kansellert — hva gjør jeg?",
    a: "Følg flystatussiden vår for sanntidsoppdateringer, og ta kontakt med oss med én gang. Ved lange forsinkelser og kanselleringer kan du ha rett på mat, hotell og erstatning etter EU-forordning 261/2004. Vi hjelper deg med både ombestiling og erstatningskrav.",
  },
  {
    q: "Kan jeg velge sete?",
    a: "Setetildeling varierer mellom flyselskapene. På mange billetter kan du velge sete ved innsjekking uten ekstra kostnad. Har du spesielle ønsker — for eksempel sete ved nødutgang eller plass til familien samlet — si ifra, så formidler vi det til flyselskapet.",
  },
  {
    q: "Reiser barnet mitt alene?",
    a: "De fleste flyselskaper tilbyr tilsynstjeneste for barn mellom 5 og 11 år som reiser alene. Tjenesten må bestilles i forkant. Kontakt oss, så undersøker vi hva som er mulig på din rute og ordner papirene.",
  },
  {
    q: "Hvordan bruker dere personopplysningene mine?",
    a: "Vi bruker bare opplysningene til å gjennomføre bestillingen din hos flyselskapet og til å gi deg kundeservice. Vi selger aldri dataene dine, og du kan når som helst be oss slette dem. Kortinformasjon lagres aldri hos oss.",
  },
];

export default function Support() {
  const [params] = useSearchParams();
  const topicParam = params.get("topic");
  const validTopic = (t: string | null): t is "booking" | "change" | "refund" | "baggage" | "other" =>
    Boolean(t && t in TOPIC_LABELS);
  const [form, setForm] = useState({
    name: "",
    email: "",
    bookingReference: params.get("ref") ?? "",
    topic: (validTopic(topicParam) ? topicParam : "booking") as
      | "booking"
      | "change"
      | "refund"
      | "baggage"
      | "other",
    message: "",
  });
  const [sent, setSent] = useState<{ ref: string } | null>(null);

  const send = trpc.flights.sendSupportMessage.useMutation({
    onSuccess: (r) => setSent({ ref: r.caseReference }),
  });

  // "Dine saker" — look up previous cases by email
  const [caseEmail, setCaseEmail] = useState("");
  const [lookupEmail, setLookupEmail] = useState<string | null>(null);
  const cases = trpc.flights.myCases.useQuery(
    { email: lookupEmail! },
    { enabled: Boolean(lookupEmail), retry: 0 },
  );

  const inputCls =
    "w-full rounded-xl border hairline bg-card px-4 py-3 text-base outline-none transition-colors focus:border-accent placeholder:text-muted-foreground/60";

  const valid =
    form.name.trim() &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) &&
    form.message.trim().length >= 10;

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-28 sm:px-6">
        <div className="aurora-band -mx-4 -mt-28 mb-10 px-4 pb-12 pt-32 sm:-mx-6 sm:px-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-skyline">
            <LifeBuoy className="h-4 w-4 text-gold" /> Kundeservice
          </p>
          <h1 className="mt-2 font-display text-4xl sm:text-6xl">
            Ekte mennesker. <span className="text-gold">Ekte hjelp.</span>
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Ingen menylabyrinter eller chatboter som går i sirkel. Hos Roamly
            får du svar av folk som kan reiser — og som kjenner bestillingen din.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Phone, title: "22 41 00 00", sub: "Alle dager 06–24" },
              { icon: Mail, title: "hei@roamly.no", sub: "Svar innen 2 timer" },
              { icon: Clock3, title: "Ved avreise", sub: "Døgnåpen nødtelefon" },
            ].map((c) => (
              <div key={c.title} className="card-lift rounded-3xl border hairline glass p-5">
                <c.icon className="h-5 w-5 text-gold" />
                <p className="mt-3 font-display text-xl">{c.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.sub}</p>
              </div>
            ))}
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="card-lift block rounded-3xl border border-[#25D366]/40 bg-[#25D366]/10 p-5 transition-colors hover:bg-[#25D366]/20"
            >
              <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
              <p className="mt-3 font-display text-xl">WhatsApp</p>
              <p className="mt-1 text-sm text-muted-foreground">{WHATSAPP_DISPLAY} · svar med én gang</p>
            </a>
          </div>
        </div>

        {/* Møt menneskene bak Roamly */}
        <section className="mt-16" aria-label="Menneskene bak Roamly">
          <h2 className="font-display text-3xl">Menneskene bak Roamly</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Når du ringer eller skriver til oss, er det oss du får tak i.
            Vi kjenner rutene, sesongene — og hva som betyr noe når du reiser hjem.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {[
              {
                img: "/team/team-1.jpg",
                name: "Zyar",
                role: "Eier og daglig leder",
                quote: "Jeg startet Roamly fordi å reise hjem til familien aldri skulle vært så komplisert.",
              },
              {
                img: "/team/team-2.jpg",
                name: "Zana",
                role: "Kundeservice og drift",
                quote: "Ingen henvendelse er for liten. Vi svarer alltid — også på kveldstid.",
              },
            ].map((p) => (
              <article
                key={p.name}
                className="card-lift overflow-hidden rounded-3xl border hairline bg-card"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={p.img}
                    alt={`${p.name} — ${p.role} i Roamly`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <div className="p-5">
                  <p className="font-display text-xl">{p.name}</p>
                  <p className="text-sm font-medium text-primary">{p.role}</p>
                  <p className="mt-2 text-sm italic leading-relaxed text-muted-foreground">
                    «{p.quote}»
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
          {/* contact form */}
          <section>
            <h2 className="font-display text-3xl">Skriv til oss</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Fortell hva det gjelder, så svarer vi på e-post — som regel i løpet av et par timer.
            </p>

            {sent ? (
              <div className="fade-up mt-6 rounded-3xl border border-gold/40 bg-gold/10 p-8 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-gold" />
                <h3 className="mt-4 font-display text-2xl">Takk for henvendelsen!</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Saken din er registrert med referanse{" "}
                  <span className="font-bold text-gold">{sent.ref}</span>. Vi svarer til{" "}
                  {form.email} så raskt vi kan.
                </p>
              </div>
            ) : (
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (valid) send.mutate({ ...form, bookingReference: form.bookingReference || undefined });
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    placeholder="Navnet ditt"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className={inputCls}
                  />
                  <input
                    type="email"
                    placeholder="E-postadresse"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <select
                    value={form.topic}
                    onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value as typeof form.topic }))}
                    className={inputCls}
                  >
                    {Object.entries(TOPIC_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Bookingreferanse (valgfritt)"
                    value={form.bookingReference}
                    onChange={(e) => setForm((f) => ({ ...f, bookingReference: e.target.value.toUpperCase() }))}
                    maxLength={8}
                    className={inputCls + " font-mono tracking-[0.15em]"}
                  />
                </div>
                <textarea
                  placeholder="Hva kan vi hjelpe deg med?"
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  className={inputCls + " resize-none"}
                />
                {send.isError && (
                  <p className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
                    Noe gikk galt — prøv igjen, eller ring oss på 22 41 00 00.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!valid || send.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                  {send.isPending ? "Sender …" : "Send henvendelse"}
                </button>
              </form>
            )}
          </section>

          {/* FAQ + case history */}
          <section>
            <h2 className="font-display text-3xl">Dine saker</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Skriv inn e-postadressen du har kontaktet oss med, så viser vi henvendelsene dine.
            </p>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(caseEmail)) setLookupEmail(caseEmail.trim());
              }}
            >
              <input
                type="email"
                placeholder="din@epost.no"
                value={caseEmail}
                onChange={(e) => setCaseEmail(e.target.value)}
                className={inputCls}
                aria-label="E-post for sakssøk"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl border hairline px-5 text-sm font-medium transition-colors hover:border-gold hover:text-gold"
              >
                Vis saker
              </button>
            </form>
            {cases.data && (
              <div className="mt-4 space-y-3">
                {cases.data.length === 0 && (
                  <p className="rounded-2xl border hairline bg-card p-4 text-sm text-muted-foreground">
                    Vi fant ingen saker registrert på {lookupEmail}.
                  </p>
                )}
                {cases.data.map((c) => (
                  <article key={c.caseReference} className="rounded-2xl border hairline bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-gold">{c.caseReference}</span>
                      <span className="text-xs text-muted-foreground">
                        {TOPIC_LABELS[c.topic] ?? c.topic}
                        {c.bookingReference && ` · ref. ${c.bookingReference}`} ·{" "}
                        {new Date(c.createdAt).toLocaleDateString("nb-NO", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.message}</p>
                  </article>
                ))}
              </div>
            )}

            <h2 className="mt-12 font-display text-3xl">Ofte stilte spørsmål</h2>
            <Accordion type="single" collapsible className="mt-4">
              {FAQ.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-b hairline">
                  <AccordionTrigger className="py-4 text-left text-sm font-semibold hover:text-gold hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
