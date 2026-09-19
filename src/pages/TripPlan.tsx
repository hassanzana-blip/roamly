import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Archive, BedDouble, ChevronRight, FileText, ListChecks, NotebookPen, Plane, Plus, Share, Trash2, UserRound } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import Icon from "@/components/app/Icon";
import { ErrorState } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { DatesRow, InfoCard, PlanPhotoCard } from "@/components/minside/PlanCard";
import { DocumentUploadSheet } from "@/components/minside/DocumentUploadSheet";
import { ALL_DESTINATIONS } from "@/content/discover";
import { copyText } from "@/lib/clipboard";
import { formatDayMonth } from "@/lib/format";
import { humanMessage } from "@/lib/apiError";
import { useCustomer } from "@/lib/useCustomer";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { trpc, type RouterOutputs } from "@/providers/trpc";

type PlanView = RouterOutputs["tripPlans"]["get"];
import { cn } from "@/lib/utils";

/**
 * Reiseplan (godkjent design, ref 6): «Alt til turen. På ett sted.»
 *
 * Siden er en plan, ikke en bestilling: alt her er kundens egne valg og
 * notater. Fly og hotell bestilles i de vanlige søkene; planen husker
 * datoer, reisende og hva som mangler. Statusen «Bestilt» settes bare når en
 * ekte bestilling hos oss er koblet til planen.
 */

function PlanHeader({ title, onShare, shareLabel }: { title: string; onShare?: () => void; shareLabel: string }) {
  const navigate = useNavigate();
  const t = useT();
  return (
    <header className="flex items-center justify-between gap-2 pb-5" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
      <button type="button" onClick={() => navigate(-1)} aria-label={t("common.back")} className="grid size-11 place-items-center rounded-full hover:bg-muted">
        <Icon icon={ChevronRight} size={24} className="rotate-180" />
      </button>
      <p className="t-h3 truncate">{title}</p>
      {onShare ? (
        <button type="button" onClick={onShare} aria-label={shareLabel} className="grid size-11 place-items-center rounded-full hover:bg-muted">
          <Icon icon={Share} size={24} />
        </button>
      ) : (
        <span className="size-11" aria-hidden="true" />
      )}
    </header>
  );
}

function ReadyRow({ icon, title, sub, onClick, to, action, done }: { icon: typeof Plane; title: string; sub: string; onClick?: () => void; to?: string; action?: "plus" | "chevron"; done?: boolean }) {
  const inner = (
    <>
      <Icon icon={icon} size={28} strokeWidth={1.75} className="shrink-0 text-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-[19px] font-bold leading-tight">{title}</span>
        <span className={cn("mt-0.5 block text-[16px] leading-snug", done ? "text-success" : "text-muted-foreground")}>{sub}</span>
      </span>
      <Icon icon={action === "chevron" ? ChevronRight : Plus} size={24} className="shrink-0 text-foreground" />
    </>
  );
  const cls = "press flex w-full items-center gap-4 py-4 text-left focus-visible:outline-2 focus-visible:outline-ring";
  return <li className="border-b border-border last:border-0">{to ? <Link to={to} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>}</li>;
}

function LoginGate({ next }: { next: string }) {
  const t = useT();
  return (
    <Link to={`/logg-inn?next=${encodeURIComponent(next)}`} className="press flex items-center gap-4 rounded-2xl bg-night p-6 text-white">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Icon icon={UserRound} size={24} /></span>
      <span className="min-w-0 flex-1">
        <span className="t-h3 block">{t("plan.login")}</span>
        <span className="mt-0.5 block text-[14px] text-white/65">{t("plan.login.sub")}</span>
      </span>
      <Icon icon={ChevronRight} size={20} className="shrink-0 text-white/60" />
    </Link>
  );
}

/* ── Eksisterende plan ────────────────────────────────────────────────── */

function PlanDetail({ id }: { id: number }) {
  const t = useT();
  const plan = trpc.tripPlans.get.useQuery({ id }, { retry: false });
  if (plan.isLoading) {
    return <div className="space-y-4" aria-busy="true"><div className="shimmer h-24 rounded-2xl" /><div className="shimmer aspect-[13/12] rounded-2xl" /><div className="shimmer h-40 rounded-2xl" /></div>;
  }
  if (plan.isError || !plan.data) {
    return <ErrorState title={t("plan.notfound")} body={plan.error ? humanMessage(plan.error) : undefined} onRetry={() => plan.refetch()} />;
  }
  return <PlanBody key={plan.data.id} id={id} p={plan.data} />;
}

function PlanBody({ id, p }: { id: number; p: PlanView }) {
  const t = useT();
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const update = trpc.tripPlans.update.useMutation({ onSuccess: (p) => { utils.tripPlans.get.setData({ id }, p); utils.tripPlans.list.invalidate(); } });
  const setPacking = trpc.tripPlans.setPacking.useMutation({
    onSuccess: (res) => {
      utils.tripPlans.get.setData({ id }, (prev) => (prev ? { ...prev, packing: res.items } : prev));
    },
  });
  const link = trpc.tripPlans.linkBooking.useMutation({ onSuccess: (p) => { utils.tripPlans.get.setData({ id }, p); utils.tripPlans.list.invalidate(); } });
  const archive = trpc.tripPlans.archive.useMutation({ onSuccess: () => { utils.tripPlans.list.invalidate(); navigate("/reiser", { replace: true }); } });
  const { customer } = useCustomer();
  const trips = trpc.customerAuth.myTrips.useQuery(undefined, { enabled: Boolean(customer?.emailVerified), retry: false });

  const [datesOpen, setDatesOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadKind, setUploadKind] = useState<"hotel_confirmation" | "flight_ticket">("hotel_confirmation");
  const [from, setFrom] = useState(p.dateFrom ?? "");
  const [to, setTo] = useState(p.dateTo ?? "");
  const [notes, setNotes] = useState(p.notes ?? "");
  const [newItem, setNewItem] = useState("");
  const [shared, setShared] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const dest = p.destination;
  const image = dest?.image ?? null;
  const flightSearch = p.destinationIata
    ? `/sok?${new URLSearchParams({ from: p.originIata ?? "OSL", to: p.destinationIata, ...(p.dateFrom ? { depart: p.dateFrom } : {}), ...(p.dateTo ? { ret: p.dateTo } : {}), adults: String(p.adults), children: String(p.children), infants: "0", cabin: "economy" })}`
    : "/";
  const hotelSearch = dest ? `/hotell?${new URLSearchParams({ place: dest.city, ...(p.dateFrom ? { checkin: p.dateFrom } : {}), ...(p.dateTo ? { checkout: p.dateTo } : {}), adults: String(p.adults), rooms: "1" })}` : "/hotell";
  const packDone = p.packing.filter((i) => i.done).length;
  const linkedTrip = p.bookingId ? trips.data?.find((x) => x.bookingId === p.bookingId) : undefined;

  const share = async () => {
    const text = `${p.title}${p.dateFrom ? ` · ${formatDayMonth(p.dateFrom)}${p.dateTo ? ` – ${formatDayMonth(p.dateTo)}` : ""}` : ""}`;
    const url = dest ? `${window.location.origin}/reisemal/${dest.id}` : window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ title: p.title, text, url });
        return;
      }
    } catch {
      /* avbrutt av bruker */
    }
    if (await copyText(`${text}\n${url}`)) {
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    }
  };

  const saveDates = () => {
    update.mutate({ id, dateFrom: from || null, dateTo: to || null }, { onSuccess: () => setDatesOpen(false) });
  };
  const savePacking = (items: { text: string; done: boolean }[]) => setPacking.mutate({ id, items });

  return (
    <>
      <PlanHeader title={t("plan.title")} onShare={share} shareLabel={t("plan.share")} />
      {shared && <p role="status" className="mb-3 rounded-lg bg-mint px-3 py-2 text-[13px] font-semibold text-petrol">{t("plan.share.copied")}</p>}

      <h1 className="t-h1">
        {t("plan.h1a")}
        <br />
        {t("plan.h1b")}
      </h1>
      <p className="t-lead mt-2 text-muted-foreground">{t("plan.sub")}</p>

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
        <div className="min-w-0">
          <PlanPhotoCard image={image} imageAlt={dest?.imageAlt ?? p.title} badge={p.booked ? t("plan.badge.booked") : t("plan.badge.idea")} badgeTone={p.booked ? "mint" : "sunny"} title={p.title} />

          <div className="mt-4 border-b border-border pb-3">
            <DatesRow dateFrom={p.dateFrom} dateTo={p.dateTo} emptyLabel={t("ms.nodates")} actionLabel={t("ms.pickdates")} onAction={() => setDatesOpen((o) => !o)} />
            {datesOpen && (
              <form
                id="datoer"
                className="mt-3 rounded-2xl bg-muted/60 p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveDates();
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <FormField id="plan-from" label={t("plan.dates.from")}>
                    <Input id="plan-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </FormField>
                  <FormField id="plan-to" label={t("plan.dates.to")}>
                    <Input id="plan-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
                  </FormField>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button type="submit" loading={update.isPending} disabled={Boolean(from && to && to < from)}>{t("plan.dates.save")}</Button>
                  {(p.dateFrom || p.dateTo) && (
                    <button type="button" className="text-sm font-semibold text-muted-foreground underline-offset-2 hover:underline" onClick={() => { setFrom(""); setTo(""); update.mutate({ id, dateFrom: null, dateTo: null }, { onSuccess: () => setDatesOpen(false) }); }}>
                      {t("plan.dates.clear")}
                    </button>
                  )}
                </div>
                {update.isError && <p role="alert" className="mt-2 text-[13px] text-destructive">{humanMessage(update.error)}</p>}
              </form>
            )}
          </div>
        </div>

        <div className="mt-8 min-w-0 lg:mt-0">
          <h2 className="t-h2">{t("plan.ready")}</h2>
          <ul className="mt-2">
            {p.booked && linkedTrip ? (
              <ReadyRow icon={Plane} title={t("plan.flight")} sub={`${t("plan.flight.booked")} · ${linkedTrip.originIata} → ${linkedTrip.destinationIata}`} to={`/bekreftelse/${encodeURIComponent(linkedTrip.orderId)}`} action="chevron" done />
            ) : (
              <ReadyRow icon={Plane} title={t("plan.flight")} sub={t("plan.flight.sub")} onClick={() => setLinkOpen((o) => !o)} />
            )}
            {linkOpen && !p.booked && (
              <li className="rounded-2xl bg-muted/60 p-4">
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="dark"><Link to={flightSearch}>{t("plan.flight.search")}</Link></Button>
                  <Button variant="outline" onClick={() => { setUploadKind("flight_ticket"); setUploadOpen(true); }}>{t("doc.noticket.add")}</Button>
                </div>
                {trips.data && trips.data.filter((x) => !x.cancelledAt).length > 0 && (
                  <div className="mt-4">
                    <p className="text-[13px] font-semibold text-muted-foreground">{t("plan.flight.pick")}</p>
                    <ul className="mt-2 space-y-1.5">
                      {trips.data.filter((x) => !x.cancelledAt).slice(0, 8).map((x) => (
                        <li key={x.orderId}>
                          <button type="button" onClick={() => link.mutate({ id, bookingId: x.bookingId })} className="press flex min-h-11 w-full items-center justify-between gap-3 rounded-lg bg-card px-3 text-left text-sm hover:bg-muted">
                            <span className="font-semibold">{x.originIata} → {x.destinationIata}</span>
                            <span className="text-muted-foreground">{x.departingAt ? formatDayMonth(x.departingAt) : ""}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {link.isError && <p role="alert" className="mt-2 text-[13px] text-destructive">{humanMessage(link.error)}</p>}
              </li>
            )}
            {p.booked && (
              <li className="pb-2 pl-11">
                <button type="button" onClick={() => link.mutate({ id, bookingId: null })} className="text-[13px] font-semibold text-muted-foreground underline-offset-2 hover:underline">{t("plan.flight.unlink")}</button>
              </li>
            )}
            <ReadyRow icon={BedDouble} title={t("plan.stay")} sub={t("plan.stay.sub")} onClick={() => setUploadKind("hotel_confirmation")} to={hotelSearch} />
            <li className="-mt-2 flex flex-wrap gap-x-4 gap-y-1 pb-3 pl-11 text-[14px] font-semibold text-accent-foreground">
              <button type="button" onClick={() => { setUploadKind("hotel_confirmation"); setUploadOpen(true); }} className="hover:underline">{t("plan.stay.add")}</button>
            </li>
            <ReadyRow icon={NotebookPen} title={t("plan.notes")} sub={p.notes ? p.notes.split("\n")[0]!.slice(0, 80) : t("plan.notes.sub")} onClick={() => setNotesOpen((o) => !o)} action={p.notes ? "chevron" : "plus"} />
            {notesOpen && (
              <li className="rounded-2xl bg-muted/60 p-4">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} maxLength={4000} placeholder={t("plan.notes.ph")} aria-label={t("plan.notes")} />
                <div className="mt-3 flex items-center gap-3">
                  <Button onClick={() => update.mutate({ id, notes }, { onSuccess: () => setNotesOpen(false) })} loading={update.isPending}>{t("plan.notes.save")}</Button>
                  <span className="text-[12px] text-muted-foreground">{notes.length}/4000</span>
                </div>
              </li>
            )}
            <ReadyRow icon={FileText} title={t("plan.docs")} sub={p.documentCount ? t("plan.docs.count", { count: p.documentCount }) : t("doc.gather")} to={`/reiser/dokumenter?plan=${p.id}`} action="chevron" />
          </ul>

          <Button
            size="xl"
            className="mt-6 w-full rounded-full"
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { id, dateFrom: from || null, dateTo: to || null, notes },
                {
                  onSuccess: () => {
                    setJustSaved(true);
                    window.setTimeout(() => setJustSaved(false), 2000);
                  },
                },
              )
            }
          >
            {justSaved ? t("plan.saved") : t("plan.save")}
          </Button>
          <p className="mt-2 text-center text-[14px] text-muted-foreground">{t("plan.nobook")}</p>

          <InfoCard
            className="mt-6"
            icon={<Icon icon={ListChecks} size={28} strokeWidth={1.75} />}
            title={t("plan.packing.title")}
            body={p.packing.length ? t("plan.packing.done", { done: packDone, total: p.packing.length }) : t("plan.packing.body")}
            cta={packOpen ? t("plan.packing.close") : t("plan.packing.open")}
            onClick={() => setPackOpen((o) => !o)}
          >
            {packOpen && (
              <div className="mt-4">
                <ul className="space-y-1">
                  {p.packing.map((item, i) => (
                    <li key={`${item.text}-${i}`} className="flex min-h-11 items-center gap-3">
                      <input
                        id={`pack-${i}`}
                        type="checkbox"
                        checked={item.done}
                        onChange={(e) => savePacking(p.packing.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))}
                        className="size-5 accent-[hsl(var(--primary))]"
                      />
                      <label htmlFor={`pack-${i}`} className={cn("flex-1 text-[16px]", item.done && "text-muted-foreground line-through")}>{item.text}</label>
                      <button type="button" aria-label={t("plan.packing.remove", { item: item.text })} onClick={() => savePacking(p.packing.filter((_, j) => j !== i))} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground">
                        <Icon icon={Trash2} size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = newItem.trim();
                    if (!text || p.packing.length >= 60) return;
                    savePacking([...p.packing, { text, done: false }]);
                    setNewItem("");
                  }}
                >
                  <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} maxLength={80} placeholder={t("plan.packing.ph")} aria-label={t("plan.packing.add")} className="bg-card" />
                  <Button type="submit" variant="dark" disabled={!newItem.trim()}>{t("plan.packing.add")}</Button>
                </form>
                {setPacking.isError && <p role="alert" className="mt-2 text-[13px] text-destructive">{humanMessage(setPacking.error)}</p>}
              </div>
            )}
          </InfoCard>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t("plan.archive.confirm"))) archive.mutate({ id });
              }}
              className="inline-flex min-h-11 items-center gap-2 text-[14px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <Icon icon={Archive} size={16} /> {t("plan.archive")}
            </button>
          </div>
        </div>
      </div>

      <DocumentUploadSheet open={uploadOpen} onOpenChange={setUploadOpen} plans={[{ id: p.id, title: p.title }]} defaultPlanId={p.id} defaultKind={uploadKind} />
    </>
  );
}

/* ── Ny plan ──────────────────────────────────────────────────────────── */

function NewPlan() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const utils = trpc.useUtils();
  const create = trpc.tripPlans.create.useMutation({ onSuccess: (p) => { utils.tripPlans.list.invalidate(); navigate(`/reiser/plan/${p.id}`, { replace: true }); } });
  const initialDest = ALL_DESTINATIONS.some((d) => d.id === params.get("dest")) ? params.get("dest")! : "";
  const [destinationId, setDestinationId] = useState(initialDest);
  const [title, setTitle] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const dest = useMemo(() => ALL_DESTINATIONS.find((d) => d.id === destinationId) ?? null, [destinationId]);
  const sorted = useMemo(() => [...ALL_DESTINATIONS].sort((a, b) => a.city.localeCompare(b.city, "nb")), []);

  return (
    <>
      <PlanHeader title={t("plan.new.title")} shareLabel={t("plan.share")} />
      <h1 className="t-h1">
        {t("plan.h1a")}
        <br />
        {t("plan.h1b")}
      </h1>
      <p className="t-lead mt-2 text-muted-foreground">{t("plan.sub")}</p>

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
        <PlanPhotoCard image={dest?.image ?? null} imageAlt={dest?.imageAlt ?? t("plan.new.title")} badge={t("plan.badge.idea")} title={title.trim() || dest?.city || t("plan.new.title")} />
        <form
          className="mt-6 space-y-5 lg:mt-0"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ destinationId: destinationId || undefined, title: title.trim() || undefined, dateFrom: from || undefined, dateTo: to || undefined, adults, children });
          }}
        >
          <FormField id="np-dest" label={t("plan.new.dest")} required>
            <select id="np-dest" required value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm">
              <option value="">{t("common.choose")}</option>
              {sorted.map((d) => (
                <option key={d.id} value={d.id}>{d.city}, {d.country}</option>
              ))}
            </select>
          </FormField>
          <FormField id="np-title" label={t("plan.new.name")}>
            <Input id="np-title" value={title} maxLength={80} placeholder={t("plan.new.nameph")} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="np-from" label={t("plan.dates.from")}>
              <Input id="np-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </FormField>
            <FormField id="np-to" label={t("plan.dates.to")}>
              <Input id="np-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="np-adults" label={t("plan.new.adults")}>
              <Input id="np-adults" type="number" min={1} max={9} value={adults} onChange={(e) => setAdults(Math.max(1, Math.min(9, Number(e.target.value) || 1)))} />
            </FormField>
            <FormField id="np-children" label={t("plan.new.children")}>
              <Input id="np-children" type="number" min={0} max={8} value={children} onChange={(e) => setChildren(Math.max(0, Math.min(8, Number(e.target.value) || 0)))} />
            </FormField>
          </div>
          <Button type="submit" size="xl" className="w-full rounded-full" disabled={!destinationId || Boolean(from && to && to < from)} loading={create.isPending}>{t("plan.save")}</Button>
          <p className="text-center text-[14px] text-muted-foreground">{t("plan.nobook")}</p>
          {create.isError && <p role="alert" className="text-[13px] text-destructive">{humanMessage(create.error)}</p>}
        </form>
      </div>
    </>
  );
}

export default function TripPlanPage() {
  usePageMeta(PAGE_META.tripPlan);
  const { id } = useParams();
  const { customer, isLoading } = useCustomer();
  const numeric = id && id !== "ny" ? Number(id) : null;
  const t = useT();

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className="max-w-4xl">
        {isLoading ? (
          <div className="space-y-4 pt-6" aria-busy="true"><div className="shimmer h-24 rounded-2xl" /><div className="shimmer aspect-[13/12] rounded-2xl" /></div>
        ) : !customer ? (
          <>
            <PlanHeader title={t("plan.title")} shareLabel={t("plan.share")} />
            <LoginGate next={`/reiser/plan/${id ?? "ny"}`} />
          </>
        ) : numeric && Number.isFinite(numeric) ? (
          <PlanDetail id={numeric} />
        ) : (
          <NewPlan />
        )}
      </AppShell>
    </div>
  );
}
