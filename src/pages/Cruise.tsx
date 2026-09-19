import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, CircleCheck, Ship } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { GreetingBar } from "@/components/app/TopBar";
import ServiceTabs from "@/components/app/ServiceTabs";
import Icon from "@/components/app/Icon";
import SiteFooter from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { WHATSAPP_LINK, WhatsAppIcon } from "@/components/WhatsAppFab";
import { trpc } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";
import { useLocale, useT, type I18nKey } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

/**
 * Cruise has a tab because the product has four services, and it has this
 * page because HelloSky has no cruise provider yet. We say so, plainly, and
 * take a real enquiry instead – region, month, party and budget – which lands
 * in admin (partner_requests, type «cruise») and alerts the team. We never
 * simulate a search or show made-up departures.
 */

const REGIONS: { id: string; key: I18nKey }[] = [
  { id: "med", key: "cruise.region.med" },
  { id: "canaries", key: "cruise.region.canaries" },
  { id: "norway", key: "cruise.region.norway" },
  { id: "baltic", key: "cruise.region.baltic" },
  { id: "caribbean", key: "cruise.region.caribbean" },
  { id: "gulf", key: "cruise.region.gulf" },
  { id: "asia", key: "cruise.region.asia" },
  { id: "river", key: "cruise.region.river" },
  { id: "other", key: "cruise.region.other" },
];
const BUDGETS: { id: string; key: I18nKey }[] = [
  { id: "na", key: "cruise.budget.na" },
  { id: "u10", key: "cruise.budget.u10" },
  { id: "10_20", key: "cruise.budget.10_20" },
  { id: "20_40", key: "cruise.budget.20_40" },
  { id: "o40", key: "cruise.budget.o40" },
];

const inputCls = "block min-h-12 w-full rounded-xl border border-input bg-card px-4 text-base text-foreground outline-none transition-[border-color,box-shadow] duration-fast focus:border-primary focus:ring-2 focus:ring-ring/30";
const labelCls = "block text-sm font-medium text-foreground";

/** De neste 18 månedene som YYYY-MM + visningsnavn i kundens språk. */
function useMonths(locale: string) {
  return useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
    const now = new Date();
    return Array.from({ length: 18 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = fmt.format(d);
      return { id: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
  }, [locale]);
}

export default function Cruise() {
  usePageMeta(PAGE_META.cruise);
  const t = useT();
  const { locale } = useLocale();
  const months = useMonths(locale);
  const submit = trpc.partners.submitRequest.useMutation();
  const [f, setF] = useState({ region: "med", month: "", adults: 2, children: 0, budget: "na", notes: "", name: "", email: "", phone: "", website: "" });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <div className="lg:hidden"><GreetingBar /></div>
        <h1 className="t-h1 lg:mt-2">{t("cruise.title")}</h1>
        <ServiceTabs active="cruise" className="mt-6" />

        <div className="card-soft mt-8 px-5 py-8 sm:px-8 sm:py-10">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-mint text-petrol"><Icon icon={Ship} size={20} /></span>
            <div>
              <h2 className="t-h2">{t("cruise.na.title")}</h2>
              <p className="t-body mt-2 max-w-2xl text-muted-foreground">{t("cruise.na.body")}</p>
            </div>
          </div>
        </div>

        <section className="card-soft mt-4 px-5 py-8 sm:px-8 sm:py-10" aria-labelledby="cruise-form-title">
          {submit.isSuccess ? (
            <div className="text-center" role="status">
              <CircleCheck className="mx-auto size-12 text-success" strokeWidth={1.6} aria-hidden="true" />
              <h2 id="cruise-form-title" className="t-h2 mt-4">{t("cruise.form.done.title")}</h2>
              <p className="t-body mx-auto mt-2 max-w-md text-muted-foreground">{t("cruise.form.done.body", { email: f.email })}</p>
              <Button asChild size="lg" variant="subtle" className="mt-6 rounded-full px-7">
                <Link to="/">{t("cruise.na.alt")} <ArrowRight className="size-5" aria-hidden="true" /></Link>
              </Button>
            </div>
          ) : (
            <>
              <h2 id="cruise-form-title" className="t-h2">{t("cruise.form.title")}</h2>
              <p className="t-body mt-2 max-w-2xl text-muted-foreground">{t("cruise.form.body")}</p>
              <form
                className="mt-6 grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit.mutate({
                    type: "cruise",
                    customerName: f.name.trim(),
                    customerEmail: f.email.trim(),
                    customerPhone: f.phone.trim() || undefined,
                    website: f.website || undefined,
                    details: {
                      region: t(REGIONS.find((r) => r.id === f.region)?.key ?? "cruise.region.other"),
                      regionId: f.region,
                      month: f.month || t("cruise.form.month.flex"),
                      adults: f.adults,
                      children: f.children,
                      budget: t(BUDGETS.find((b) => b.id === f.budget)?.key ?? "cruise.budget.na"),
                      budgetId: f.budget,
                      notes: f.notes.trim().slice(0, 500),
                    },
                  });
                }}
              >
                <label className="block">
                  <span className={labelCls}>{t("cruise.form.region")}</span>
                  <select value={f.region} onChange={(e) => set("region", e.target.value)} className={cn(inputCls, "mt-1.5")}>
                    {REGIONS.map((r) => <option key={r.id} value={r.id}>{t(r.key)}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className={labelCls}>{t("cruise.form.month")}</span>
                  <select value={f.month} onChange={(e) => set("month", e.target.value)} className={cn(inputCls, "mt-1.5")}>
                    <option value="">{t("cruise.form.month.flex")}</option>
                    {months.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </label>
                <fieldset className="block">
                  <legend className={labelCls}>{t("cruise.form.party")}</legend>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="sr-only">{t("ht.adults", { count: f.adults })}</span>
                      <select value={f.adults} onChange={(e) => set("adults", Number(e.target.value))} className={inputCls}>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{t("ht.adults", { count: n })}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="sr-only">{t("home.search.children")}</span>
                      <select value={f.children} onChange={(e) => set("children", Number(e.target.value))} className={inputCls}>
                        {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n === 0 ? t("ht.children.none") : n === 1 ? t("ht.children.one") : t("ht.children", { count: n })}</option>)}
                      </select>
                    </label>
                  </div>
                </fieldset>
                <label className="block">
                  <span className={labelCls}>{t("cruise.form.budget")}</span>
                  <select value={f.budget} onChange={(e) => set("budget", e.target.value)} className={cn(inputCls, "mt-1.5")}>
                    {BUDGETS.map((b) => <option key={b.id} value={b.id}>{t(b.key)}</option>)}
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className={labelCls}>{t("cruise.form.notes")}</span>
                  <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} rows={3} placeholder={t("cruise.form.notes.ph")} className={cn(inputCls, "mt-1.5 min-h-24 py-3")} />
                </label>
                <label className="block">
                  <span className={labelCls}>{t("cruise.form.name")}</span>
                  <input required autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} className={cn(inputCls, "mt-1.5")} />
                </label>
                <label className="block">
                  <span className={labelCls}>{t("cruise.form.email")}</span>
                  <input required type="email" autoComplete="email" inputMode="email" value={f.email} onChange={(e) => set("email", e.target.value)} className={cn(inputCls, "mt-1.5")} />
                </label>
                <label className="block">
                  <span className={labelCls}>{t("cruise.form.phone")}</span>
                  <input type="tel" autoComplete="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} className={cn(inputCls, "mt-1.5")} />
                </label>
                {/* Honningkrukke: skjult for folk, fristende for roboter. Serveren svarer «ok» og kaster. */}
                <div className="hidden" aria-hidden="true">
                  <label>
                    Nettsted
                    <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} />
                  </label>
                </div>
                {submit.isError && (
                  <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive sm:col-span-2">
                    {humanMessage(submit.error)}
                  </p>
                )}
                <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="t-caption">{t("cruise.form.privacy")}</p>
                  <Button type="submit" size="lg" disabled={submit.isPending} className="w-full rounded-full sm:w-auto sm:min-w-52">
                    {submit.isPending ? t("cruise.form.sending") : t("cruise.form.send")}
                  </Button>
                </div>
              </form>
            </>
          )}
        </section>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="subtle" className="rounded-full px-7">
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="size-5" /> {t("cruise.na.cta")}</a>
          </Button>
          <Button asChild size="lg" variant="ghost" className="rounded-full px-7">
            <Link to="/">{t("cruise.na.alt")} <ArrowRight className="size-5" aria-hidden="true" /></Link>
          </Button>
        </div>
      </AppShell>
      <div className="mt-16"><SiteFooter /></div>
    </div>
  );
}
