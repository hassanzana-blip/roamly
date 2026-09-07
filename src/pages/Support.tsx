import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, LifeBuoy, Mail, MailWarning, Phone, Send } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useCustomer } from "@/lib/useCustomer";
import { appCodeOf, humanMessage } from "@/lib/apiError";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { WhatsAppIcon, WHATSAPP_LINK, WHATSAPP_DISPLAY, WHATSAPP_NUMBER } from "@/components/WhatsAppFab";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatDateShort, topicLabel } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { PAGE_META, faqJsonLd, usePageMeta } from "@/lib/seo";

const SUPPORT_PHONE: string = import.meta.env.VITE_SUPPORT_PHONE ?? "+47 22 41 00 00";
const SUPPORT_PHONE_DISPLAY = SUPPORT_PHONE.replace(/^\+47\s?/, "").replace(/(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4");

const FAQ_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
type FaqQ = `sp.faq.${(typeof FAQ_IDS)[number]}.q`;
type FaqA = `sp.faq.${(typeof FAQ_IDS)[number]}.a`;

const TOPICS = ["booking", "change", "refund", "baggage", "other"] as const;
type Topic = (typeof TOPICS)[number];

export default function Support() {
  const t = useT();
  const [params] = useSearchParams();
  const topicParam = params.get("topic");
  const validTopic = (v: string | null): v is Topic => Boolean(v && (TOPICS as readonly string[]).includes(v));
  const faq = FAQ_IDS.map((i) => ({ q: t(`sp.faq.${i}.q` as FaqQ), a: t(`sp.faq.${i}.a` as FaqA, { phone: SUPPORT_PHONE_DISPLAY }) }));
  usePageMeta({ ...PAGE_META.support, jsonLd: faqJsonLd(faq.map((f) => ({ question: f.q, answer: f.a }))) });
  const [form, setForm] = useState({
    name: "",
    email: "",
    bookingReference: params.get("ref") ?? "",
    topic: (validTopic(topicParam) ? topicParam : "booking") as Topic,
    message: "",
  });
  const [sent, setSent] = useState<{ ref: string } | null>(null);

  const send = trpc.flights.sendSupportMessage.useMutation({
    onSuccess: (r) => setSent({ ref: r.caseReference }),
  });

  // «Dine saker» — kun for innloggede kunder med bekreftet e-post
  const { customer } = useCustomer();
  const cases = trpc.customerAuth.myCasesSecure.useQuery(undefined, { enabled: Boolean(customer), retry: 0 });
  const casesErrCode = cases.error ? appCodeOf(cases.error) : null;
  const resend = trpc.customerAuth.resendVerification.useMutation();

  const inputCls =
    "w-full rounded-xl border hairline bg-card px-4 py-3 text-base outline-none transition-colors focus:border-accent placeholder:text-muted-foreground/60";

  const valid =
    form.name.trim() &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) &&
    form.message.trim().length >= 10;

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pb-20 pt-28 outline-none sm:px-6">
        <div className="bg-muted/40 border-b border-border -mx-4 -mt-28 mb-10 px-4 pb-12 pt-32 sm:-mx-6 sm:px-6">
          <p className="flex items-center gap-2 font-mono-label text-[11px] text-primary">
            <LifeBuoy className="h-4 w-4 text-foreground" /> {t("sp.kicker")}
          </p>
          <h1 className="mt-2 font-display text-4xl sm:text-6xl">
            {t("sp.title1")} <span className="text-primary">{t("sp.title2")}</span>
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">{t("sp.sub")}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Phone, title: SUPPORT_PHONE_DISPLAY, sub: t("sp.hours"), href: `tel:${SUPPORT_PHONE.replace(/\s/g, "")}` },
              { icon: Mail, title: "hei@hellosky.no", sub: t("sp.emailsub"), href: "mailto:hei@hellosky.no" },
            ].map((c) => (
              <a key={c.title} href={c.href} className="card-lift block rounded-xl border border-border bg-card p-5 shadow-soft">
                <c.icon className="h-5 w-5 text-foreground" aria-hidden="true" />
                <p className="mt-3 font-display text-xl">{c.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.sub}</p>
              </a>
            ))}
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="card-lift block rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 p-5 transition-colors hover:bg-[#25D366]/20"
            >
              <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
              <p className="mt-3 font-display text-xl">WhatsApp</p>
              <p className="mt-1 text-sm text-muted-foreground">{WHATSAPP_DISPLAY}</p>
            </a>
          </div>
        </div>

        {/* Møt menneskene bak HelloSky — direkte WhatsApp-linje til begge */}
        <section className="mt-16" aria-label={t("sp.team.aria")}>
          <p className="font-mono-label text-[11px] text-primary">{t("sp.team.kicker")}</p>
          <h2 className="font-display mt-3 text-4xl sm:text-5xl">{t("sp.team.title")}</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{t("sp.team.sub")}</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {[
              { img: "/team/team-1.jpg", name: "Zyar", role: t("sp.team.role.owner"), quote: t("sp.team.quote.owner") },
              { img: "/team/team-2.jpg", name: "Zana", role: t("sp.team.role.support"), quote: t("sp.team.quote.support") },
            ].map((p) => (
              <article
                key={p.name}
                className="card-lift overflow-hidden rounded-xl border border-border bg-card"
              >
                <div className="aspect-[4/5] overflow-hidden">
                  <img
                    src={p.img}
                    alt={t("sp.team.alt", { name: p.name, role: p.role })}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover object-top transition-transform duration-500 ease-out hover:scale-[1.03]"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-display text-2xl">{p.name}</p>
                      <p className="text-sm font-medium text-primary">{p.role}</p>
                    </div>
                  </div>
                  <p className="mt-3 font-display text-sm italic leading-relaxed text-muted-foreground" style={{ fontWeight: 400 }}>
                    «{p.quote}»
                  </p>
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t("sp.team.wamsg", { name: p.name }))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#25D366] px-6 py-3.5 text-sm font-semibold text-foreground transition-all hover:opacity-90 active:scale-[0.99]"
                    aria-label={t("sp.team.chat", { name: p.name })}
                  >
                    <WhatsAppIcon className="h-5 w-5" />
                    {t("sp.team.wa", { name: p.name })}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
          {/* contact form */}
          <section>
            <h2 className="font-display text-3xl">{t("sp.write")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("sp.write.sub")}</p>

            {sent ? (
              <div className="fade-up mt-6 rounded-xl border border-border bg-muted p-8 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 font-display text-2xl">{t("sp.thanks")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("sp.thanks.a")} <span className="font-semibold text-primary">{sent.ref}</span>
                  {t("sp.thanks.b", { email: form.email })}
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
                    aria-label={t("sp.name")}
                    autoComplete="name"
                    placeholder={t("sp.name")}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className={inputCls}
                  />
                  <input
                    type="email"
                    aria-label={t("common.emailaddress")}
                    autoComplete="email"
                    placeholder={t("common.emailaddress")}
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <select
                    aria-label={t("sp.topic")}
                    value={form.topic}
                    onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value as Topic }))}
                    className={inputCls}
                  >
                    {TOPICS.map((k) => (
                      <option key={k} value={k}>
                        {topicLabel(k)}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={t("sp.ref")}
                    placeholder={t("sp.ref")}
                    value={form.bookingReference}
                    onChange={(e) => setForm((f) => ({ ...f, bookingReference: e.target.value.toUpperCase() }))}
                    maxLength={8}
                    className={inputCls + " font-mono tracking-[0.15em]"}
                  />
                </div>
                <textarea
                  aria-label={t("sp.message")}
                  placeholder={t("sp.messageph")}
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  className={inputCls + " resize-none"}
                />
                {send.isError && (
                  <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {humanMessage(send.error)} {t("sp.err.call", { phone: SUPPORT_PHONE_DISPLAY })}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!valid || send.isPending}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-4 text-base font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {send.isPending ? t("common.sending") : t("sp.send")}
                </button>
              </form>
            )}
          </section>

          {/* FAQ + case history */}
          <section>
            <h2 className="font-display text-3xl">{t("sp.cases")}</h2>
            {!customer && (
              <div className="mt-4 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
                <p>{t("sp.cases.login")}</p>
                <Link to="/logg-inn?next=/hjelp" className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-night px-5 text-sm font-semibold text-white">
                  {t("common.login")}
                </Link>
              </div>
            )}
            {customer && casesErrCode === "EMAIL_NOT_VERIFIED" && (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300/60 bg-warning/10 p-4 text-sm">
                <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-warning">{t("sp.cases.verify")}</p>
                  <button
                    type="button"
                    onClick={() => resend.mutate()}
                    disabled={resend.isPending || resend.isSuccess}
                    className="mt-2 min-h-11 rounded-lg bg-night px-5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {resend.isSuccess ? t("common.sent") : t("sp.resendverify")}
                  </button>
                </div>
              </div>
            )}
            {customer && cases.isError && casesErrCode !== "EMAIL_NOT_VERIFIED" && (
              <p role="alert" className="mt-4 text-sm text-primary">
                {humanMessage(cases.error)}
              </p>
            )}
            {cases.data && (
              <div className="mt-4 space-y-3">
                {cases.data.length === 0 && (
                  <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">{t("sp.cases.none", { email: customer?.email ?? "" })}</p>
                )}
                {cases.data.map((c) => (
                  <article key={c.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-primary">{c.reference}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.status === "open" ? t("sp.open") : c.status === "closed" ? t("sp.closed") : c.status} · {formatDateShort(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{c.subject}</p>
                    <ul className="mt-2 space-y-1.5">
                      {c.messages.map((m) => (
                        <li key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.fromStaff ? "bg-secondary/60" : "bg-muted/60"}`}>
                          <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{m.fromStaff ? "HelloSky" : t("sp.you")}</span>
                          <span className="line-clamp-3 text-muted-foreground">{m.message}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}

            <h2 className="mt-12 font-display text-3xl">{t("sp.faq")}</h2>
            <Accordion type="single" collapsible className="mt-4">
              {faq.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-b border-border">
                  <AccordionTrigger className="py-4 text-left text-sm font-semibold hover:text-foreground hover:no-underline">
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
