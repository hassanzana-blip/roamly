import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, Check, CheckCircle2, Mail, MailWarning, Phone, Search, Send, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useCustomer } from "@/lib/useCustomer";
import { appCodeOf, humanMessage } from "@/lib/apiError";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import SiteFooter from "@/components/layout/SiteFooter";
import { WhatsAppIcon, WHATSAPP_LINK, WHATSAPP_DISPLAY, WHATSAPP_NUMBER } from "@/components/WhatsAppFab";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BaggageVisual } from "@/components/graphics";
import ArticleCard from "@/components/journal/ArticleCard";
import { formatDateShort, topicLabel } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { PAGE_META, faqJsonLd, usePageMeta } from "@/lib/seo";
import { INTENTS, searchSupport, TOPICS, type Topic } from "@/content/support";
import { articleBySlug, type Article } from "@/content/journal";
import { cn } from "@/lib/utils";

/**
 * Kundeservice – en veiviser, ikke en labyrint. Søk øverst, så «velg det som
 * ligner mest», så hjelpesekken: det du bør ha klart, som pakkes mens du
 * fyller ut. Menneskene og kanalene står tydelig, med ekte åpningstider.
 */

const SUPPORT_PHONE: string = import.meta.env.VITE_SUPPORT_PHONE ?? "+47 22 41 00 00";
const SUPPORT_PHONE_DISPLAY = SUPPORT_PHONE.replace(/^\+47\s?/, "").replace(/(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4");

const FAQ_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
type FaqQ = `sp.faq.${(typeof FAQ_IDS)[number]}.q`;
type FaqA = `sp.faq.${(typeof FAQ_IDS)[number]}.a`;

export default function Support() {
  const t = useT();
  const [params] = useSearchParams();
  const topicParam = params.get("topic");
  const validTopic = (v: string | null): v is Topic => Boolean(v && (TOPICS as readonly string[]).includes(v));
  const status = trpc.flights.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  // Betalingsspørsmålet vises bare når betaling faktisk er satt opp.
  const faqIds = FAQ_IDS.filter((i) => i !== 2 || status.data?.paymentsConfigured);
  const faq = faqIds.map((i) => ({ n: i, q: t(`sp.faq.${i}.q` as FaqQ), a: t(`sp.faq.${i}.a` as FaqA, { phone: SUPPORT_PHONE_DISPLAY }) }));
  usePageMeta({ ...PAGE_META.support, jsonLd: faqJsonLd(faq.map((f) => ({ question: f.q, answer: f.a }))) });

  const initialIntent = INTENTS.find((i) => i.topic === topicParam)?.id ?? null;
  const [intentId, setIntentId] = useState<string | null>(initialIntent);
  const intent = INTENTS.find((i) => i.id === intentId) ?? null;
  const [query, setQuery] = useState("");
  const hits = searchSupport(query, faq);
  const [openFaq, setOpenFaq] = useState<string>("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    bookingReference: params.get("ref") ?? "",
    topic: (validTopic(topicParam) ? topicParam : "booking") as Topic,
    message: "",
  });
  const [sent, setSent] = useState<{ ref: string } | null>(null);
  const send = trpc.flights.sendSupportMessage.useMutation({ onSuccess: (r) => setSent({ ref: r.caseReference }) });

  const { customer } = useCustomer();
  const cases = trpc.customerAuth.myCasesSecure.useQuery(undefined, { enabled: Boolean(customer), retry: 0 });
  const casesErrCode = cases.error ? appCodeOf(cases.error) : null;
  const resend = trpc.customerAuth.resendVerification.useMutation();

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email);
  const valid = Boolean(form.name.trim() && emailOk && form.message.trim().length >= 10);

  const chooseIntent = (id: string) => {
    const next = intentId === id ? null : id;
    setIntentId(next);
    const i = INTENTS.find((x) => x.id === next);
    if (i) setForm((f) => ({ ...f, topic: i.topic }));
  };

  // Hjelpesekken: det som faktisk ligger i skjemaet, pluss det intensjonen ber om.
  const bag: { label: string; packed: boolean }[] = [
    { label: t("sp.name"), packed: form.name.trim().length > 1 },
    { label: t("common.emailaddress"), packed: emailOk },
    ...(intent?.needs.includes("sp.need.ref") ? [{ label: t("sp.need.ref"), packed: form.bookingReference.trim().length >= 6 }] : []),
    { label: t("sp.message"), packed: form.message.trim().length >= 10 },
  ];
  const packedCount = bag.filter((b) => b.packed).length;
  const intentArticles = (intent?.articles ?? []).map(articleBySlug).filter((a): a is Article => Boolean(a));
  const intentFaq = faq.filter((f) => intent?.faq.includes(f.n));

  const focusFaq = (n: number) => {
    setOpenFaq(`faq-${n}`);
    setQuery("");
    requestAnimationFrame(() => document.getElementById(`faq-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <AppHeader title={t("nav.support")} as="h1" />

        {/* 1 · Spørsmålet + søk */}
        <div className="max-w-2xl">
          <h2 className="t-h1">{t("sp.ask")}</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground">{t("sp.ask.sub")}</p>
        </div>
        <div className="relative mt-6 max-w-2xl">
          <label htmlFor="support-search" className="sr-only">{t("sp.search.ph")}</label>
          <Icon icon={Search} size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input id="support-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("sp.search.ph")} autoComplete="off" className="h-14 rounded-xl pl-12 pr-12 text-[16px] shadow-sm" />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label={t("misc.close")} className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"><Icon icon={X} size={16} /></button>
          )}
          {query.trim().length >= 2 && (
            <div className="surface-lift mt-2 overflow-hidden" role="region" aria-live="polite">
              {hits.length === 0 ? (
                <p className="px-4 py-4 text-[14px] text-muted-foreground">{t("sp.search.none", { q: query })}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {hits.map((h, i) => {
                    const inner = (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">{h.title}</span>
                          <span className="block text-[12px] text-muted-foreground">{h.sub}</span>
                        </span>
                        <Icon icon={ArrowRight} size={16} className="shrink-0 text-muted-foreground" />
                      </>
                    );
                    const cls = "flex min-h-[56px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-muted/60";
                    return (
                      <li key={i}>
                        {h.kind === "faq" ? <button type="button" onClick={() => focusFaq(h.n)} className={cls}>{inner}</button>
                          : h.kind === "article" ? <Link to={`/journal/${h.slug}`} className={cls}>{inner}</Link>
                          : <Link to={h.to} className={cls}>{inner}</Link>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* 2 · Velg det som ligner mest */}
        <section className="mt-10">
          <h2 className="text-[13px] font-semibold text-muted-foreground">{t("sp.intents")}</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {INTENTS.map((i) => {
              const active = intentId === i.id;
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => chooseIntent(i.id)}
                    className={cn(
                      "press flex min-h-[88px] w-full flex-col justify-between rounded-xl border p-4 text-left transition-colors duration-fast",
                      active ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground/30",
                    )}
                  >
                    <span className="text-[15px] font-semibold leading-tight">{t(i.label)}</span>
                    <span className={cn("mt-2 block text-[12px] leading-snug", active ? "text-background/70" : "text-muted-foreground")}>{t(i.sub)}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {intent && (intentFaq.length > 0 || intentArticles.length > 0 || intent.links.length > 0) && (
            <div className="mt-6 rounded-2xl bg-muted/60 p-5 sm:p-6">
              <h3 className="font-display text-[22px]">{t("sp.selfserve")}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {intent.links.map((l) => (
                  <Link key={l.to} to={l.to} className="press inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-card px-3.5 text-[14px] font-semibold shadow-sm hover:bg-card/80">{t(l.label)} <Icon icon={ArrowRight} size={14} /></Link>
                ))}
                {intentFaq.map((f) => (
                  <button key={f.n} type="button" onClick={() => focusFaq(f.n)} className="press inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-card px-3.5 text-left text-[14px] font-semibold shadow-sm hover:bg-card/80">{f.q}</button>
                ))}
              </div>
              {intentArticles.length > 0 && (
                <div className="mt-5 grid gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                  {intentArticles.map((a) => <ArticleCard key={a.slug} a={a} />)}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 3 · Skriv til oss + hjelpesekken */}
        <section className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div>
            <h2 className="t-h2">{t("sp.write")}</h2>
            <p className="mt-1 text-[14px] text-muted-foreground">{t("sp.write.sub")}</p>

            {sent ? (
              <div className="fade-up mt-6 rounded-2xl bg-primary-soft p-8 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-accent-foreground" />
                <h3 className="mt-4 font-display text-2xl">{t("sp.thanks")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("sp.thanks.a")} <span className="font-semibold text-foreground">{sent.ref}</span>
                  {t("sp.thanks.b", { email: form.email })}
                </p>
              </div>
            ) : (
              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (valid) send.mutate({ ...form, bookingReference: form.bookingReference || undefined });
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sp-name">{t("sp.name")}</Label>
                    <Input id="sp-name" autoComplete="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sp-email">{t("common.emailaddress")}</Label>
                    <Input id="sp-email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sp-topic">{t("sp.topic")}</Label>
                    <Select value={form.topic} onValueChange={(v) => setForm((f) => ({ ...f, topic: v as Topic }))}>
                      <SelectTrigger id="sp-topic"><SelectValue /></SelectTrigger>
                      <SelectContent>{TOPICS.map((k) => <SelectItem key={k} value={k}>{topicLabel(k)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sp-ref">{t("sp.ref")}</Label>
                    <Input id="sp-ref" value={form.bookingReference} onChange={(e) => setForm((f) => ({ ...f, bookingReference: e.target.value.toUpperCase() }))} maxLength={8} className="font-mono tracking-[0.15em]" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sp-msg">{t("sp.message")}</Label>
                  <Textarea id="sp-msg" placeholder={t("sp.messageph")} rows={5} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} className="resize-none" />
                </div>
                {send.isError && (
                  <p role="alert" className="rounded-xl bg-destructive/5 p-3 text-sm text-destructive">
                    {humanMessage(send.error)} {t("sp.err.call", { phone: SUPPORT_PHONE_DISPLAY })}
                  </p>
                )}
                <Button type="submit" size="xl" disabled={!valid} loading={send.isPending} className="w-full sm:w-auto sm:min-w-64">
                  <Send /> {t("sp.send")}
                </Button>
              </form>
            )}
          </div>

          <aside className="rounded-2xl bg-night p-5 text-white sm:p-6 lg:sticky lg:top-24">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-[22px]">{t("sp.bag.title")}</h3>
                <p className="mt-1 text-[13px] text-white/70">{t("sp.bag.sub")}</p>
              </div>
              <BaggageVisual kind="cabin" count={1} size={28} label={t("sp.bag.title")} className="shrink-0 text-primary" />
            </div>
            <ul className="mt-5 space-y-2.5">
              {bag.map((b) => (
                <li key={b.label} className="flex items-center gap-3 text-[14px]">
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-base", b.packed ? "border-primary bg-primary text-primary-foreground" : "border-white/30 text-transparent")}>
                    <Icon icon={Check} size={14} />
                  </span>
                  <span className={cn("transition-colors duration-base", b.packed ? "text-white" : "text-white/70")}>{b.label}</span>
                </li>
              ))}
            </ul>
            {intent && intent.needs.length > 0 && (
              <div className="mt-5 border-t border-white/15 pt-4">
                <p className="text-[12px] font-semibold text-white/60">{t(intent.label)}</p>
                <ul className="mt-2 space-y-1.5 text-[13px] text-white/80">
                  {intent.needs.map((n) => <li key={n} className="flex gap-2"><span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />{t(n)}</li>)}
                </ul>
              </div>
            )}
            <p className="mt-5 text-[12px] text-white/60">{packedCount === bag.length ? t("sp.bag.packed") : t("sp.bag.progress", { n: packedCount, total: bag.length })}</p>
          </aside>
        </section>

        {/* 4 · Kanaler + menneskene */}
        <section className="mt-14">
          <h2 className="t-h2">{t("sp.channels")}</h2>
          <p className="mt-1 max-w-xl text-[14px] text-muted-foreground">{t("sp.channels.sub")}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`} className="press surface flex items-center gap-4 p-5 transition-colors hover:border-foreground/25">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted"><Icon icon={Phone} size={20} /></span>
              <span><span className="block text-[17px] font-semibold">{SUPPORT_PHONE_DISPLAY}</span><span className="block text-[13px] text-muted-foreground">{t("sp.hours")}</span></span>
            </a>
            <a href="mailto:hei@hellosky.no" className="press surface flex items-center gap-4 p-5 transition-colors hover:border-foreground/25">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted"><Icon icon={Mail} size={20} /></span>
              <span><span className="block text-[17px] font-semibold">hei@hellosky.no</span><span className="block text-[13px] text-muted-foreground">{t("sp.emailsub")}</span></span>
            </a>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="press flex items-center gap-4 rounded-2xl bg-[#25D366]/12 p-5 transition-colors hover:bg-[#25D366]/20">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-foreground"><WhatsAppIcon className="h-5 w-5" /></span>
              <span><span className="block text-[17px] font-semibold">WhatsApp</span><span className="block text-[13px] text-muted-foreground">{WHATSAPP_DISPLAY}</span></span>
            </a>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2" aria-label={t("sp.team.aria")}>
            {[
              { img: "/team/team-1.jpg", name: "Zyar", role: t("sp.team.role.owner"), quote: t("sp.team.quote.owner") },
              { img: "/team/team-2.jpg", name: "Zana", role: t("sp.team.role.support"), quote: t("sp.team.quote.support") },
            ].map((p) => (
              <article key={p.name} className="surface flex gap-4 overflow-hidden p-4 sm:p-5">
                <img src={p.img} alt={t("sp.team.alt", { name: p.name, role: p.role })} loading="lazy" decoding="async" width={112} height={140} className="h-[140px] w-[112px] shrink-0 rounded-xl object-cover object-top" />
                <div className="min-w-0">
                  <p className="font-display text-[22px]">{p.name}</p>
                  <p className="text-[13px] font-medium text-muted-foreground">{p.role}</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-foreground/85">«{p.quote}»</p>
                  <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t("sp.team.wamsg", { name: p.name }))}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#25D366]/15 px-3.5 text-[13px] font-semibold hover:bg-[#25D366]/25">
                    <WhatsAppIcon className="h-4 w-4" /> {t("sp.team.wa", { name: p.name })}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* 5 · Dine saker */}
        {customer && (
          <section className="mt-14">
            <h2 className="t-h2">{t("sp.cases")}</h2>
            {casesErrCode === "EMAIL_NOT_VERIFIED" && (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-warning/10 p-4 text-sm">
                <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-warning">{t("sp.cases.verify")}</p>
                  <button type="button" onClick={() => resend.mutate()} disabled={resend.isPending || resend.isSuccess} className="mt-2 min-h-11 rounded-lg bg-night px-5 text-sm font-semibold text-white disabled:opacity-60">
                    {resend.isSuccess ? t("common.sent") : t("sp.resendverify")}
                  </button>
                </div>
              </div>
            )}
            {cases.isError && casesErrCode !== "EMAIL_NOT_VERIFIED" && <p role="alert" className="mt-4 text-sm text-destructive">{humanMessage(cases.error)}</p>}
            {cases.data && (
              <div className="mt-4 space-y-3">
                {cases.data.length === 0 && <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">{t("sp.cases.none", { email: customer.email ?? "" })}</p>}
                {cases.data.map((c) => (
                  <article key={c.id} className="surface p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold">{c.reference}</span>
                      <span className="text-xs text-muted-foreground">{c.status === "open" ? t("sp.open") : c.status === "closed" ? t("sp.closed") : c.status} · {formatDateShort(c.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{c.subject}</p>
                    <ul className="mt-2 space-y-1.5">
                      {c.messages.map((m) => (
                        <li key={m.id} className={cn("rounded-xl px-3 py-2 text-sm", m.fromStaff ? "bg-primary-soft" : "bg-muted/60")}>
                          <span className="block text-[11px] font-semibold text-muted-foreground">{m.fromStaff ? "HelloSky" : t("sp.you")}</span>
                          <span className="line-clamp-3 text-foreground/85">{m.message}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 6 · FAQ */}
        <section className="mt-14 max-w-3xl">
          <h2 className="t-h2">{t("sp.faq")}</h2>
          <Accordion type="single" collapsible value={openFaq} onValueChange={setOpenFaq} className="mt-4">
            {faq.map((f) => (
              <AccordionItem key={f.n} id={`faq-${f.n}`} value={`faq-${f.n}`} className="border-b border-border">
                <AccordionTrigger className="py-4 text-left text-[15px] font-semibold hover:text-foreground hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </AppShell>
      <div className="mt-16"><SiteFooter /></div>
    </div>
  );
}
