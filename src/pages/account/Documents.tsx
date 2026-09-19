import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { BedDouble, ChevronLeft, ChevronRight, Download, FileText, Lock, Luggage, Plus, Ticket, Trash2, UserRound, type LucideIcon } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import Icon from "@/components/app/Icon";
import { EmptyState, ErrorState } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Chip } from "@/components/account/AccountRow";
import { InfoCard } from "@/components/minside/PlanCard";
import { DocumentUploadSheet } from "@/components/minside/DocumentUploadSheet";
import { pickNextPlan } from "@/lib/tripPlans";
import { airportByIata } from "@contracts/airports";
import { kindLabelKey, type DocumentKind } from "@/lib/documents";
import { formatDayMonth } from "@/lib/format";
import { humanMessage } from "@/lib/apiError";
import { useCustomer } from "@/lib/useCustomer";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { trpc, type RouterOutputs } from "@/providers/trpc";
import { cn } from "@/lib/utils";

type Doc = RouterOutputs["documents"]["list"][number];
type Plan = RouterOutputs["tripPlans"]["list"][number];

/**
 * Billetter og dokumenter (godkjent design, ref 2).
 *
 * Alt her er kundens egne filer, kryptert på serveren og bare tilgjengelig
 * med kundens egen sesjon. Siden viser aldri eksempeldata: uten dokumenter
 * står det at det ikke finnes noen, og hvordan man legger til.
 */

function dateRange(from: string | null, to: string | null): string {
  if (!from) return "";
  if (!to || to === from) return formatDayMonth(from);
  return `${formatDayMonth(from)} – ${formatDayMonth(to)}`;
}

function DocIcon({ mime, className }: { mime: string; className?: string }) {
  const pdf = mime === "application/pdf";
  return (
    <span className={cn("relative grid size-14 shrink-0 place-items-center", className)} aria-hidden="true">
      <Icon icon={FileText} size={28} strokeWidth={1.5} className="size-12" />
      {pdf && <span className="absolute bottom-2 rounded-sm bg-current px-1 text-[9px] font-bold leading-[13px] text-petrol-deep [color:hsl(var(--petrol-deep))]"><span className="text-white">PDF</span></span>}
    </span>
  );
}

function RestRow({ icon, title, sub, to, onAdd, action }: { icon: LucideIcon; title: string; sub: string; to?: string; onAdd?: () => void; action: "open" | "add" }) {
  const inner = (
    <>
      <Icon icon={icon} size={28} strokeWidth={1.75} className="shrink-0 text-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-[18px] font-bold leading-tight">{title}</span>
        <span className="mt-0.5 block truncate text-[16px] text-muted-foreground">{sub}</span>
      </span>
      <Icon icon={action === "add" ? Plus : ChevronRight} size={24} className="shrink-0 text-foreground" />
    </>
  );
  const cls = "press flex min-h-[76px] w-full items-center gap-4 px-4 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring";
  return (
    <li className="border-b border-border last:border-0">
      {to ? (
        to.startsWith("/api/") ? (
          <a href={to} target="_blank" rel="noopener" className={cls}>{inner}</a>
        ) : (
          <Link to={to} className={cls}>{inner}</Link>
        )
      ) : (
        <button type="button" onClick={onAdd} className={cls}>{inner}</button>
      )}
    </li>
  );
}

function DocList({ docs, plans, showPlan, onRemove, removing }: { docs: Doc[]; plans: Plan[]; showPlan: boolean; onRemove: (d: Doc) => void; removing: number | null }) {
  const t = useT();
  const planTitle = (id: number | null) => (id ? plans.find((p) => p.id === id)?.title ?? "" : t("doc.noplan"));
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center gap-3 px-4 py-3">
          <DocIcon mime={d.mime} className="size-10 [&_svg]:size-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold">{d.title}</p>
            <p className="truncate text-[13px] text-muted-foreground">
              {t(kindLabelKey(d.kind as DocumentKind))} · {d.fileName}
              {showPlan ? ` · ${planTitle(d.tripPlanId)}` : ""}
              {d.travelDate ? ` · ${formatDayMonth(d.travelDate)}` : ""}
            </p>
          </div>
          <a href={d.href} target="_blank" rel="noopener" aria-label={`${t("doc.open")}: ${d.title}`} className="grid size-11 place-items-center rounded-full hover:bg-muted"><Icon icon={ChevronRight} size={20} /></a>
          <a href={`${d.href}?download=1`} aria-label={`${t("doc.download")}: ${d.title}`} className="grid size-11 place-items-center rounded-full hover:bg-muted"><Icon icon={Download} size={20} /></a>
          <button type="button" onClick={() => onRemove(d)} disabled={removing === d.id} aria-label={`${t("doc.remove")}: ${d.title}`} className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"><Icon icon={Trash2} size={20} /></button>
        </li>
      ))}
    </ul>
  );
}

export default function Documents() {
  usePageMeta(PAGE_META.documents);
  const t = useT();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { customer, isLoading } = useCustomer();
  const utils = trpc.useUtils();
  const plans = trpc.tripPlans.list.useQuery(undefined, { enabled: Boolean(customer), retry: false });
  const docs = trpc.documents.list.useQuery(undefined, { enabled: Boolean(customer), retry: false });
  const remove = trpc.documents.remove.useMutation({ onSuccess: () => { utils.documents.list.invalidate(); utils.tripPlans.list.invalidate(); } });

  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const requested = Number(params.get("plan"));
  const plan = useMemo<Plan | null>(() => {
    const list = plans.data ?? [];
    if (requested && list.some((p) => p.id === requested)) return list.find((p) => p.id === requested)!;
    return pickNextPlan(list, today);
  }, [plans.data, requested, today]);
  const [scope, setScope] = useState<"trip" | "all">(params.get("alle") ? "all" : "trip");
  const [offline, setOffline] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadKind, setUploadKind] = useState<DocumentKind>("flight_ticket");

  const all = docs.data ?? [];
  const forTrip = plan ? all.filter((d) => d.tripPlanId === plan.id) : [];
  const ticket = forTrip.find((d) => d.kind === "flight_ticket") ?? forTrip.find((d) => d.kind === "booking_confirmation") ?? null;
  const hotel = forTrip.find((d) => d.kind === "hotel_confirmation") ?? null;
  const boarding = forTrip.find((d) => d.kind === "boarding_pass") ?? null;
  const rest = forTrip.filter((d) => d !== ticket && d !== hotel && d !== boarding);
  const showTrip = scope === "trip" && plan;

  const openUpload = (kind: DocumentKind) => {
    setUploadKind(kind);
    setUploadOpen(true);
  };
  const confirmRemove = (d: Doc) => {
    if (window.confirm(t("doc.remove.confirm", { title: d.title }))) remove.mutate({ id: d.id });
  };

  const fromA = plan?.originIata ? airportByIata(plan.originIata) : null;
  const toA = plan?.destinationIata ? airportByIata(plan.destinationIata) : null;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className="max-w-3xl">
        <header className="flex items-center justify-between gap-2 pb-5" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
          <button type="button" onClick={() => navigate(-1)} aria-label={t("common.back")} className="grid size-11 place-items-center rounded-full hover:bg-muted"><Icon icon={ChevronLeft} size={24} /></button>
          <h1 className="t-h3 truncate">{t("doc.title")}</h1>
          {customer ? (
            <button type="button" onClick={() => openUpload("other")} aria-label={t("doc.add")} className="grid size-11 place-items-center rounded-full hover:bg-muted"><Icon icon={Plus} size={28} /></button>
          ) : (
            <span className="size-11" aria-hidden="true" />
          )}
        </header>

        {isLoading || (customer && (plans.isLoading || docs.isLoading)) ? (
          <div className="space-y-4" aria-busy="true"><div className="shimmer h-20 rounded-2xl" /><div className="shimmer h-12 rounded-full" /><div className="shimmer h-72 rounded-2xl" /></div>
        ) : !customer ? (
          <Link to="/logg-inn?next=/reiser/dokumenter" className="press flex items-center gap-4 rounded-2xl bg-night p-6 text-white">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Icon icon={UserRound} size={24} /></span>
            <span className="min-w-0 flex-1">
              <span className="t-h3 block">{t("doc.login")}</span>
              <span className="mt-0.5 block text-[14px] text-white/65">{t("doc.onlyyou")}</span>
            </span>
            <Icon icon={ChevronRight} size={20} className="shrink-0 text-white/60" />
          </Link>
        ) : docs.isError ? (
          <ErrorState body={humanMessage(docs.error)} onRetry={() => docs.refetch()} />
        ) : (
          <>
            {showTrip ? (
              <>
                <h2 className="t-h1">{ticket ? t("doc.ready") : t("doc.gather")}</h2>
                <p className="t-lead mt-1 text-muted-foreground">
                  {plan.destination?.city ?? plan.title}
                  {plan.dateFrom ? ` · ${dateRange(plan.dateFrom, plan.dateTo)}` : ""}
                </p>
              </>
            ) : (
              <>
                <h2 className="t-h1">{t("doc.all.title")}</h2>
                <p className="t-lead mt-1 text-muted-foreground">{t("doc.all.sub")}</p>
              </>
            )}

            {plan && (
              <Segmented
                aria-label={t("doc.title")}
                value={scope}
                onValueChange={setScope}
                className="mt-5 rounded-full bg-sky-soft p-1 [&_[data-state=on]]:bg-petrol [&_[data-state=on]]:text-white [&_[data-state=on]]:shadow-none [&_button]:h-12 [&_button]:rounded-full [&_button]:text-[17px]"
                options={[
                  { value: "trip", label: t("doc.tab.trip") },
                  { value: "all", label: t("doc.tab.all") },
                ]}
              />
            )}

            {showTrip && (plans.data?.length ?? 0) > 1 && (
              <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 sm:-mx-8 sm:px-8" role="group" aria-label={t("doc.plan.pick")}>
                {plans.data!.map((p) => (
                  <Chip key={p.id} active={p.id === plan.id} onClick={() => setParams({ plan: String(p.id) }, { replace: true })} className="min-h-9 text-[13px]">{p.title}</Chip>
                ))}
              </div>
            )}

            {showTrip ? (
              <>
                {/* Hovedkortet: flybilletten */}
                <section className="mt-5 rounded-2xl bg-petrol-deep p-6 text-white">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70">{t("doc.kind.flight_ticket")}</p>
                  {fromA && toA ? (
                    <>
                      <p className="mt-2 font-display text-[40px] font-bold leading-none tracking-tight">{fromA.iata} → {toA.iata}</p>
                      <p className="mt-1 text-[20px] text-white/85">{fromA.city} → {toA.city}</p>
                    </>
                  ) : (
                    <p className="mt-2 font-display text-[30px] font-bold leading-tight">{plan.title}</p>
                  )}
                  {ticket ? (
                    <>
                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/15 pt-4">
                        <span className="text-[20px]">{ticket.travelDate ? formatDayMonth(ticket.travelDate) : plan.dateFrom ? formatDayMonth(plan.dateFrom) : ""}</span>
                        <span className="inline-flex min-h-9 items-center rounded-full bg-mint px-3 text-[14px] font-semibold text-petrol">{ticket.source === "manual" ? t("doc.manual") : t("doc.frombooking")}</span>
                      </div>
                      <a href={ticket.href} target="_blank" rel="noopener" className="press mt-3 flex items-center gap-3 rounded-xl py-2 hover:bg-white/5">
                        <DocIcon mime={ticket.mime} />
                        <span className="min-w-0 flex-1 truncate text-[19px]">{ticket.fileName}</span>
                        <Icon icon={ChevronRight} size={24} className="shrink-0" />
                      </a>
                      <Button asChild size="xl" className="mt-4 w-full rounded-full">
                        <a href={ticket.href} target="_blank" rel="noopener">{t("doc.open.ticket")}</a>
                      </Button>
                    </>
                  ) : (
                    <div className="mt-5 border-t border-white/15 pt-4">
                      <p className="text-[18px] font-semibold">{t("doc.noticket.title")}</p>
                      <p className="mt-1 text-[15px] text-white/75">{t("doc.noticket.body")}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="lg" className="rounded-full" onClick={() => openUpload("flight_ticket")}>{t("doc.noticket.add")}</Button>
                        {plan.destinationIata && (
                          <Button asChild size="lg" variant="outline" className="rounded-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                            <Link to={`/sok?${new URLSearchParams({ from: plan.originIata ?? "OSL", to: plan.destinationIata, ...(plan.dateFrom ? { depart: plan.dateFrom } : {}), ...(plan.dateTo ? { ret: plan.dateTo } : {}), adults: String(plan.adults), children: String(plan.children), infants: "0", cabin: "economy" })}`}>{t("doc.noticket.search")}</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </section>
                <p className="mt-3 flex items-center justify-center gap-2 text-[15px] text-muted-foreground"><Icon icon={Lock} size={16} /> {t("doc.onlyyou")}</p>

                {/* Resten av reisen */}
                <section className="mt-8" aria-labelledby="rest">
                  <h2 id="rest" className="t-h1">{t("doc.rest")}</h2>
                  <ul className="mt-4 rounded-2xl border border-border bg-card">
                    {hotel ? (
                      <RestRow icon={BedDouble} title={t("doc.kind.hotel_confirmation")} sub={`${hotel.fileName} · ${hotel.source === "manual" ? t("doc.manual") : t("doc.frombooking")}`} to={hotel.href} action="open" />
                    ) : (
                      <RestRow icon={BedDouble} title={t("doc.kind.hotel_confirmation")} sub={t("doc.hotel.sub")} onAdd={() => openUpload("hotel_confirmation")} action="add" />
                    )}
                    {boarding ? (
                      <RestRow icon={Ticket} title={t("doc.kind.boarding_pass")} sub={`${boarding.fileName} · ${boarding.source === "manual" ? t("doc.manual") : t("doc.frombooking")}`} to={boarding.href} action="open" />
                    ) : (
                      <RestRow icon={Ticket} title={t("doc.kind.boarding_pass")} sub={t("doc.boarding.sub")} onAdd={() => openUpload("boarding_pass")} action="add" />
                    )}
                    <RestRow icon={Luggage} title={t("doc.baggage")} sub={t("doc.baggage.sub")} to="/bagasje" action="open" />
                  </ul>
                  {rest.length > 0 && (
                    <div className="mt-4">
                      <DocList docs={rest} plans={plans.data ?? []} showPlan={false} onRemove={confirmRemove} removing={remove.isPending ? remove.variables?.id ?? null : null} />
                    </div>
                  )}
                </section>

                <InfoCard
                  className="mt-8"
                  icon={<Icon icon={Download} size={28} strokeWidth={1.75} />}
                  title={t("doc.offline.title")}
                  body={t("doc.offline.body")}
                  cta={offline ? t("doc.offline.hide") : t("doc.offline.cta")}
                  onClick={() => setOffline((o) => !o)}
                >
                  {offline && (
                    <div className="mt-4">
                      {forTrip.length ? (
                        <DocList docs={forTrip} plans={plans.data ?? []} showPlan={false} onRemove={confirmRemove} removing={remove.isPending ? remove.variables?.id ?? null : null} />
                      ) : (
                        <p className="text-[14px] text-muted-foreground">{t("doc.empty.title")}</p>
                      )}
                    </div>
                  )}
                </InfoCard>
              </>
            ) : (
              <section className="mt-6">
                {all.length === 0 ? (
                  <EmptyState icon={FileText} title={t("doc.empty.title")} body={t("doc.empty.body")} action={<Button variant="dark" className="mt-2" onClick={() => openUpload("flight_ticket")}>{t("doc.add")}</Button>} />
                ) : (
                  <DocList docs={all} plans={plans.data ?? []} showPlan onRemove={confirmRemove} removing={remove.isPending ? remove.variables?.id ?? null : null} />
                )}
                <p className="mt-3 flex items-center justify-center gap-2 text-[15px] text-muted-foreground"><Icon icon={Lock} size={16} /> {t("doc.onlyyou")}</p>
                {remove.isError && <p role="alert" className="mt-2 text-center text-[13px] text-destructive">{humanMessage(remove.error)}</p>}
              </section>
            )}
          </>
        )}
      </AppShell>
      <DocumentUploadSheet open={uploadOpen} onOpenChange={setUploadOpen} plans={(plans.data ?? []).map((p) => ({ id: p.id, title: p.title }))} defaultPlanId={scope === "trip" ? plan?.id ?? null : null} defaultKind={uploadKind} />
    </div>
  );
}
