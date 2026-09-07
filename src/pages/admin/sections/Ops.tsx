import { useState } from "react";
import { Link } from "react-router";
import { RefreshCw, ScanSearch, ShieldAlert, ShieldCheck, EyeOff, Eye } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { AttemptStatePill, BookingStatePill, Btn, Card, ClickableRow, EmptyState, ErrorState, Field, KV, LoadingRows, PageHeader, Pill, TableCard, Timeline } from "../ui";
import { ATTEMPT_STATE_LABELS, BOOKING_STATE_LABELS, STAFF_TRANSITION_TARGETS, formatDateTime, formatMinor, formatMoney, inputCls, selectCls, tdCls, thCls } from "../helpers";
import { useActionFeedback } from "../useActionFeedback";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ── Gjennomgangskø ─────────────────────────────────────────────────────── */

function AttemptEventsSheet({ attemptId, onClose }: { attemptId: number | null; onClose: () => void }) {
  const events = trpc.admin.attemptEvents.useQuery({ attemptId: attemptId ?? 0 }, { enabled: attemptId != null, retry: false });
  return (
    <Sheet open={attemptId != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Forsøk #{attemptId}</SheetTitle>
          <SheetDescription>Tidslinje for booking-forsøket (betaling ↔ leverandør).</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {events.isLoading ? (
            <LoadingRows rows={3} />
          ) : events.error || !events.data ? (
            <ErrorState error={events.error} />
          ) : (
            <Timeline
              items={events.data.map((e) => ({
                id: e.id,
                title: <>{e.fromState ? <>{ATTEMPT_STATE_LABELS[e.fromState] ?? e.fromState} → </> : null}<span className="font-semibold">{ATTEMPT_STATE_LABELS[e.toState] ?? e.toState}</span></>,
                sub: e.detail,
                at: e.createdAt,
              }))}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TransitionDialog({ booking, onClose, onDone }: { booking: { id: number; state: string; ref: string } | null; onClose: () => void; onDone: () => void }) {
  const fb = useActionFeedback();
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const transition = trpc.admin.bookingTransition.useMutation({
    onSuccess: () => { setTo(""); setReason(""); onDone(); onClose(); },
    onError: fb.fail,
  });
  const targets = booking ? STAFF_TRANSITION_TARGETS[booking.state] ?? [] : [];
  return (
    <Dialog open={booking != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Endre status for {booking?.ref}</DialogTitle>
          <DialogDescription>Nåværende: {booking ? BOOKING_STATE_LABELS[booking.state] ?? booking.state : ""}. Begrunnelsen logges.</DialogDescription>
        </DialogHeader>
        {fb.banner}
        <Field label="Ny status" htmlFor="tr-to">
          <select id="tr-to" value={to} onChange={(e) => setTo(e.target.value)} className={`${selectCls} w-full`}>
            <option value="">Velg …</option>
            {targets.map((s) => <option key={s} value={s}>{BOOKING_STATE_LABELS[s] ?? s}</option>)}
          </select>
        </Field>
        <Field label="Begrunnelse" htmlFor="tr-reason">
          <textarea id="tr-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} minLength={3} />
        </Field>
        <DialogFooter>
          <Btn tone="ghost" onClick={onClose}>Avbryt</Btn>
          <Btn tone="night" disabled={!to || reason.trim().length < 3 || transition.isPending || !booking} onClick={() => booking && transition.mutate({ bookingId: booking.id, toState: to as never, reason: reason.trim() })}>
            {transition.isPending ? "Endrer …" : "Bekreft"}
          </Btn>
        </DialogFooter>
        {fb.reauthDialog}
      </DialogContent>
    </Dialog>
  );
}

export function AdminReviewQueue() {
  const utils = trpc.useUtils();
  const fb = useActionFeedback();
  const queue = trpc.admin.reviewQueue.useQuery(undefined, { retry: false, refetchInterval: 30_000 });
  const perms = trpc.staffAuth.myPermissions.useQuery(undefined, { staleTime: 60_000, retry: false });
  const can = (p: string) => perms.data?.permissions.includes(p as never) ?? false;
  const [eventsFor, setEventsFor] = useState<number | null>(null);
  const [transitionFor, setTransitionFor] = useState<{ id: number; state: string; ref: string } | null>(null);

  const invalidate = () => { utils.admin.reviewQueue.invalidate(); utils.admin.dashboard.invalidate(); };
  const retryAttempt = trpc.admin.retryAttempt.useMutation({ onSuccess: () => { fb.flash("Forsøket er lagt i kø på nytt."); invalidate(); }, onError: fb.fail });
  const reconcile = trpc.admin.reconcileBooking.useMutation({ onSuccess: () => { fb.flash("Avstemming mot leverandør er lagt i kø."); invalidate(); }, onError: fb.fail });

  return (
    <div>
      <PageHeader title="Gjennomgangskø" description="Alt som trenger et menneske: bookinger i manuell gjennomgang, feilede bookinger, avstemming og fastlåste forsøk." actions={<Btn tone="ghost" onClick={() => queue.refetch()}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Oppdater</Btn>} />
      {fb.banner}
      {queue.isLoading ? (
        <LoadingRows rows={5} />
      ) : queue.error || !queue.data ? (
        <ErrorState error={queue.error} onRetry={() => queue.refetch()} />
      ) : (
        <Tabs defaultValue="bookings">
          <TabsList className="mb-4">
            <TabsTrigger value="bookings">Bookinger ({queue.data.bookings.length})</TabsTrigger>
            <TabsTrigger value="attempts">Forsøk ({queue.data.attempts.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="bookings">
            {queue.data.bookings.length === 0 ? (
              <EmptyState title="Ingen bookinger til gjennomgang" hint="Bookinger i REVIEW, BOOKING_FAILED eller AWAITING_RECONCILIATION dukker opp her." />
            ) : (
              <TableCard minWidth={860} caption="Bookinger til gjennomgang">
                <thead>
                  <tr className="border-b border-border">
                    <th className={thCls}>Referanse</th>
                    <th className={thCls}>Kunde</th>
                    <th className={thCls}>Beløp</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>Oppdatert</th>
                    <th className={thCls}>Handlinger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {queue.data.bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-primary/[0.03]">
                      <td className={`${tdCls} font-semibold`}>
                        <Link to={`/admin/bestillinger/${b.id}`} className="text-primary hover:underline">{b.bookingReference ?? b.orderId}</Link>
                        {!b.liveMode && <Pill className="ml-2">Test</Pill>}
                      </td>
                      <td className={`${tdCls} text-muted-foreground`}>{b.contactEmail}</td>
                      <td className={`${tdCls} whitespace-nowrap text-night`}>{formatMoney(b.totalAmount, b.totalCurrency ?? "NOK")}</td>
                      <td className={tdCls}><BookingStatePill state={b.state} /></td>
                      <td className={`${tdCls} whitespace-nowrap text-muted-foreground`}>{formatDateTime(b.updatedAt)}</td>
                      <td className={tdCls}>
                        <div className="flex flex-wrap gap-1.5">
                          {can("bookings:reconcile") && (
                            <Btn tone="ghost" className="min-h-9 px-3 text-xs" onClick={() => reconcile.mutate({ bookingId: b.id })} disabled={reconcile.isPending}>
                              <ScanSearch className="h-3.5 w-3.5" aria-hidden="true" /> Avstem
                            </Btn>
                          )}
                          {can("bookings:write") && (STAFF_TRANSITION_TARGETS[b.state] ?? []).length > 0 && (
                            <Btn tone="ghost" className="min-h-9 px-3 text-xs" onClick={() => setTransitionFor({ id: b.id, state: b.state, ref: b.bookingReference ?? b.orderId })}>Endre status</Btn>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            )}
          </TabsContent>
          <TabsContent value="attempts">
            {queue.data.attempts.length === 0 ? (
              <EmptyState title="Ingen fastlåste forsøk" hint="Forsøk med ukjent leverandørstatus eller feilet betalingsfangst vises her." />
            ) : (
              <TableCard minWidth={920} caption="Fastlåste booking-forsøk">
                <thead>
                  <tr className="border-b border-border">
                    <th className={thCls}>Forsøk</th>
                    <th className={thCls}>Sesjon</th>
                    <th className={thCls}>Beløp</th>
                    <th className={thCls}>Tilstand</th>
                    <th className={thCls}>Feil</th>
                    <th className={thCls}>Oppdatert</th>
                    <th className={thCls}>Handlinger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {queue.data.attempts.map((a) => (
                    <tr key={a.id} className="hover:bg-primary/[0.03]">
                      <td className={tdCls}>
                        <span className="font-semibold text-night">#{a.id}</span>
                        <span className="block text-xs text-muted-foreground">{a.attempts} forsøk{a.bookingId ? <> · <Link to={`/admin/bestillinger/${a.bookingId}`} className="text-primary hover:underline">booking #{a.bookingId}</Link></> : null}</span>
                      </td>
                      <td className={tdCls}>
                        <span className="block font-mono text-xs text-night">{a.sessionPublicId}</span>
                        <span className="block text-xs text-muted-foreground">{a.contactEmail}</span>
                      </td>
                      <td className={`${tdCls} whitespace-nowrap text-night`}>{formatMinor(a.totalAmountMinor, a.currency)}</td>
                      <td className={tdCls}><AttemptStatePill state={a.state} /></td>
                      <td className={`${tdCls} max-w-[220px]`}>
                        {a.lastErrorCode && <span className="block font-mono text-[11px] text-rose-700">{a.lastErrorCode}</span>}
                        {a.lastError && <span className="block truncate text-xs text-muted-foreground" title={a.lastError}>{a.lastError}</span>}
                        {a.supplierOrderId && <span className="block font-mono text-[11px] text-muted-foreground">{a.supplierOrderId}</span>}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap text-muted-foreground`}>{formatDateTime(a.updatedAt)}</td>
                      <td className={tdCls}>
                        <div className="flex flex-wrap gap-1.5">
                          <Btn tone="ghost" className="min-h-9 px-3 text-xs" onClick={() => setEventsFor(a.id)}>Tidslinje</Btn>
                          {can("bookings:write") && !["CONFIRMED", "FAILED_VOIDED", "FAILED"].includes(a.state) && (
                            <Btn tone="night" className="min-h-9 px-3 text-xs" onClick={() => retryAttempt.mutate({ attemptId: a.id })} disabled={retryAttempt.isPending}>
                              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {a.state === "SUPPLIER_UNKNOWN" ? "Gjenopprett" : "Prøv igjen"}
                            </Btn>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            )}
          </TabsContent>
        </Tabs>
      )}
      <AttemptEventsSheet attemptId={eventsFor} onClose={() => setEventsFor(null)} />
      <TransitionDialog booking={transitionFor} onClose={() => setTransitionFor(null)} onDone={() => { fb.flash("Status endret."); invalidate(); }} />
      {fb.reauthDialog}
    </div>
  );
}

/* ── Ruteendringer ──────────────────────────────────────────────────────── */

type SegmentLike = { originIata?: string; destinationIata?: string; departingAt?: string; arrivingAt?: string; carrierIata?: string; flightNumber?: string; origin?: { iata?: string }; destination?: { iata?: string }; departing_at?: string; arriving_at?: string };

function segLabel(s: SegmentLike) {
  const o = s.originIata ?? s.origin?.iata ?? "?";
  const d = s.destinationIata ?? s.destination?.iata ?? "?";
  const dep = s.departingAt ?? s.departing_at;
  return `${s.carrierIata ?? ""}${s.flightNumber ?? ""} ${o} → ${d} · ${formatDateTime(dep)}`;
}

export function AdminScheduleChanges() {
  const utils = trpc.useUtils();
  const fb = useActionFeedback();
  const [status, setStatus] = useState<"detected" | "resolved" | "all">("detected");
  const list = trpc.admin.scheduleChangesList.useQuery({ status }, { retry: false });
  const perms = trpc.staffAuth.myPermissions.useQuery(undefined, { staleTime: 60_000, retry: false });
  const canWrite = perms.data?.permissions.includes("bookings:write") ?? false;
  const [resolving, setResolving] = useState<number | null>(null);
  const [resolution, setResolution] = useState<"accepted" | "rebooked" | "refund">("accepted");
  const [note, setNote] = useState("");
  const resolve = trpc.admin.resolveScheduleChange.useMutation({
    onSuccess: () => { setResolving(null); setNote(""); fb.flash("Ruteendringen er løst."); utils.admin.scheduleChangesList.invalidate(); utils.admin.dashboard.invalidate(); },
    onError: (e) => { setResolving(null); fb.fail(e); },
  });
  const current = list.data?.find((s) => s.id === resolving);

  return (
    <div>
      <PageHeader title="Ruteendringer" description="Endringer fra flyselskapet (via webhook). Løs saken når kunden har akseptert, blitt ombooket eller ønsker refusjon." />
      <Card className="mb-4">
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filtrer" className={selectCls}>
          <option value="detected">Uløste</option>
          <option value="resolved">Løste</option>
          <option value="all">Alle</option>
        </select>
      </Card>
      {fb.banner}
      {list.isLoading ? (
        <LoadingRows rows={4} />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState title="Ingen ruteendringer" hint="Endringer registreres automatisk fra leverandørens webhooks." />
      ) : (
        <div className="space-y-3">
          {list.data.map((sc) => {
            const oldSegs = (Array.isArray(sc.oldSegments) ? sc.oldSegments : []) as SegmentLike[];
            const newSegs = (Array.isArray(sc.newSegments) ? sc.newSegments : []) as SegmentLike[];
            return (
              <Card key={sc.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-night">
                      <Link to={`/admin/bestillinger/${sc.bookingId}`} className="text-primary hover:underline">{sc.bookingReference ?? `#${sc.bookingId}`}</Link>
                      <span className="ml-2 text-muted-foreground">{sc.customerEmail}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Oppdaget {formatDateTime(sc.createdAt)}{sc.customerNotifiedAt ? ` · kunde varslet ${formatDateTime(sc.customerNotifiedAt)}` : " · kunde ikke varslet"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookingStatePill state={sc.bookingState} />
                    <Pill tone={sc.status === "resolved" ? "success" : "warning"}>{sc.status === "resolved" ? "Løst" : "Uløst"}</Pill>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Før</p>
                    <ul className="mt-1 space-y-1 text-sm text-night">{oldSegs.length ? oldSegs.map((s, i) => <li key={i} className="line-through decoration-rose-400">{segLabel(s)}</li>) : <li className="text-muted-foreground">–</li>}</ul>
                  </div>
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Etter</p>
                    <ul className="mt-1 space-y-1 text-sm text-night">{newSegs.length ? newSegs.map((s, i) => <li key={i}>{segLabel(s)}</li>) : <li className="text-muted-foreground">–</li>}</ul>
                  </div>
                </div>
                {sc.status !== "resolved" && canWrite && (
                  <Btn tone="night" className="mt-4" onClick={() => setResolving(sc.id)}>Løs ruteendring</Btn>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <Dialog open={resolving != null} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Løs ruteendring {current?.bookingReference ?? ""}</DialogTitle>
            <DialogDescription>Velger du «Refusjon», settes bestillingen til kansellering forespurt og en refusjonssak opprettes.</DialogDescription>
          </DialogHeader>
          <Field label="Utfall" htmlFor="sc-res">
            <select id="sc-res" value={resolution} onChange={(e) => setResolution(e.target.value as typeof resolution)} className={`${selectCls} w-full`}>
              <option value="accepted">Kunden har akseptert endringen</option>
              <option value="rebooked">Kunden er ombooket</option>
              <option value="refund">Kunden ønsker refusjon</option>
            </select>
          </Field>
          <Field label="Notat (valgfritt)" htmlFor="sc-note">
            <textarea id="sc-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
          </Field>
          <DialogFooter>
            <Btn tone="ghost" onClick={() => setResolving(null)}>Avbryt</Btn>
            <Btn tone="night" disabled={resolve.isPending || resolving == null} onClick={() => resolving != null && resolve.mutate({ id: resolving, resolution, note: note.trim() || undefined })}>
              {resolve.isPending ? "Lagrer …" : "Bekreft"}
            </Btn>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {fb.reauthDialog}
    </div>
  );
}

/* ── Svindelflagg ───────────────────────────────────────────────────────── */

export function AdminFraudFlags() {
  const utils = trpc.useUtils();
  const fb = useActionFeedback();
  const [status, setStatus] = useState<"open" | "reviewed" | "all">("open");
  const list = trpc.admin.fraudFlagsList.useQuery({ status }, { retry: false });
  const perms = trpc.staffAuth.myPermissions.useQuery(undefined, { staleTime: 60_000, retry: false });
  const canWrite = perms.data?.permissions.includes("bookings:write") ?? false;
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [decision, setDecision] = useState<"cleared" | "confirmed">("cleared");
  const [note, setNote] = useState("");
  const review = trpc.admin.reviewFraudFlag.useMutation({
    onSuccess: () => { setReviewing(null); setNote(""); fb.flash("Flagget er vurdert."); utils.admin.fraudFlagsList.invalidate(); utils.admin.dashboard.invalidate(); },
    onError: (e) => { setReviewing(null); fb.fail(e); },
  });

  return (
    <div>
      <PageHeader title="Svindelflagg" description="Automatiske flagg fra betalings- og bookingflyten. «Avklart» frigir bookinger i manuell gjennomgang." />
      <Card className="mb-4">
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filtrer" className={selectCls}>
          <option value="open">Åpne</option>
          <option value="reviewed">Vurderte</option>
          <option value="all">Alle</option>
        </select>
      </Card>
      {fb.banner}
      {list.isLoading ? (
        <LoadingRows rows={4} />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState title="Ingen svindelflagg" hint="Flagg opprettes automatisk ved mistenkelige mønstre." />
      ) : (
        <TableCard minWidth={820} caption="Svindelflagg">
          <thead>
            <tr className="border-b border-border">
              <th className={thCls}>Type</th>
              <th className={thCls}>Score</th>
              <th className={thCls}>Tilknytning</th>
              <th className={thCls}>Notat</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Opprettet</th>
              <th className={thCls}><span className="sr-only">Handling</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.data.map((f) => (
              <tr key={f.id} className="hover:bg-primary/[0.03]">
                <td className={`${tdCls} font-mono text-xs font-semibold text-night`}>{f.type}</td>
                <td className={tdCls}><Pill tone={f.score >= 70 ? "danger" : f.score >= 40 ? "warning" : "neutral"}>{f.score}</Pill></td>
                <td className={`${tdCls} text-sm`}>
                  {f.bookingId && <Link to={`/admin/bestillinger/${f.bookingId}`} className="block font-semibold text-primary hover:underline">Booking #{f.bookingId}</Link>}
                  {f.checkoutSessionId && <span className="block text-xs text-muted-foreground">Sesjon #{f.checkoutSessionId}</span>}
                  {f.customerAccountId && <span className="block text-xs text-muted-foreground">Konto #{f.customerAccountId}</span>}
                </td>
                <td className={`${tdCls} max-w-[240px] truncate text-muted-foreground`} title={f.note ?? ""}>{f.note ?? "–"}</td>
                <td className={tdCls}><Pill tone={f.status === "open" ? "warning" : "success"}>{f.status === "open" ? "Åpent" : "Vurdert"}</Pill></td>
                <td className={`${tdCls} whitespace-nowrap text-muted-foreground`}>{formatDateTime(f.createdAt)}</td>
                <td className={tdCls}>
                  {f.status === "open" && canWrite && (
                    <Btn tone="ghost" className="min-h-9 px-3 text-xs" onClick={() => { setReviewing(f.id); setNote(f.note ?? ""); }}>Vurder</Btn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
      <Dialog open={reviewing != null} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vurder svindelflagg</DialogTitle>
            <DialogDescription>«Avklart» setter en tilknyttet booking i REVIEW tilbake til bekreftet. «Bekreftet svindel» beholder bookingen i gjennomgang.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2" role="radiogroup" aria-label="Avgjørelse">
            <Btn tone={decision === "cleared" ? "success" : "ghost"} role="radio" aria-checked={decision === "cleared"} onClick={() => setDecision("cleared")}><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Avklart</Btn>
            <Btn tone={decision === "confirmed" ? "danger" : "ghost"} role="radio" aria-checked={decision === "confirmed"} onClick={() => setDecision("confirmed")}><ShieldAlert className="h-4 w-4" aria-hidden="true" /> Bekreftet svindel</Btn>
          </div>
          <Field label="Notat (valgfritt, maks 255 tegn)" htmlFor="ff-note">
            <input id="ff-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} className={inputCls} />
          </Field>
          <DialogFooter>
            <Btn tone="ghost" onClick={() => setReviewing(null)}>Avbryt</Btn>
            <Btn tone="night" disabled={review.isPending || reviewing == null} onClick={() => reviewing != null && review.mutate({ id: reviewing, decision, note: note.trim() || undefined })}>
              {review.isPending ? "Lagrer …" : "Bekreft"}
            </Btn>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {fb.reauthDialog}
    </div>
  );
}

/* ── Checkout-sesjoner ──────────────────────────────────────────────────── */

const SESSION_STATUS_LABELS: Record<string, string> = {
  created: "Opprettet",
  payment_pending: "Venter på betaling",
  authorized: "Betaling autorisert",
  booking: "Booker",
  confirmed: "Bekreftet",
  failed: "Feilet",
  expired: "Utløpt",
  cancelled: "Avbrutt",
  price_changed: "Pris endret",
};

export function AdminCheckoutSessions() {
  const [status, setStatus] = useState("");
  const list = trpc.admin.checkoutSessionsList.useQuery({ status: status || undefined }, { retry: false, refetchInterval: 30_000 });
  const [selected, setSelected] = useState<number | null>(null);
  const current = list.data?.find((s) => s.id === selected);

  return (
    <div>
      <PageHeader title="Checkout-sesjoner" description="Driftsoversikt over kjøpsløp fra nettsiden – nyttig når en kunde melder at betalingen «hang»." />
      <Card className="mb-4">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrer på status" className={selectCls}>
          <option value="">Alle statuser</option>
          {Object.entries(SESSION_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Card>
      {list.isLoading ? (
        <LoadingRows rows={5} />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState title="Ingen sesjoner" hint="Sesjoner opprettes når en kunde starter betaling." />
      ) : (
        <TableCard minWidth={900} caption="Checkout-sesjoner">
          <thead>
            <tr className="border-b border-border">
              <th className={thCls}>Sesjon</th>
              <th className={thCls}>Kunde</th>
              <th className={thCls}>Totalt</th>
              <th className={thCls}>Betaling</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Booking</th>
              <th className={thCls}>Opprettet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.data.map((s) => (
              <ClickableRow key={s.id} onClick={() => setSelected(s.id)} selected={selected === s.id}>
                <td className={`${tdCls} font-mono text-xs text-night`}>{s.publicId}</td>
                <td className={`${tdCls} text-muted-foreground`}>{s.contactEmail}</td>
                <td className={`${tdCls} whitespace-nowrap font-semibold text-night`}>{formatMinor(s.totalAmountMinor, s.currency)}</td>
                <td className={`${tdCls} text-xs text-muted-foreground`}>{s.pspProvider ?? "–"}{s.paymentMethod ? ` · ${s.paymentMethod}` : ""}</td>
                <td className={tdCls}>
                  <Pill tone={s.status === "confirmed" ? "success" : s.status === "failed" ? "danger" : ["expired", "cancelled"].includes(s.status) ? "neutral" : "warning"}>{SESSION_STATUS_LABELS[s.status] ?? s.status}</Pill>
                </td>
                <td className={tdCls}>{s.bookingId ? <Link to={`/admin/bestillinger/${s.bookingId}`} className="font-semibold text-primary hover:underline" onClick={(e) => e.stopPropagation()}>#{s.bookingId}</Link> : <span className="text-muted-foreground">–</span>}</td>
                <td className={`${tdCls} whitespace-nowrap text-muted-foreground`}>{formatDateTime(s.createdAt)}</td>
              </ClickableRow>
            ))}
          </tbody>
        </TableCard>
      )}
      <Sheet open={current != null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Sesjon {current?.publicId}</SheetTitle>
            <SheetDescription>{current ? `${SESSION_STATUS_LABELS[current.status] ?? current.status} · opprettet ${formatDateTime(current.createdAt)}` : ""}</SheetDescription>
          </SheetHeader>
          {current && (
            <div className="px-4 pb-6">
              <KV
                items={[
                  { k: "Kunde", v: current.contactEmail },
                  { k: "Totalt", v: formatMinor(current.totalAmountMinor, current.currency) },
                  { k: "Leverandørpris", v: formatMinor(current.supplierAmountMinor, current.currency) },
                  { k: "Servicegebyr", v: formatMinor(current.serviceFeeAmountMinor, current.currency) },
                  { k: "Bonus brukt", v: formatMinor(current.bonusUsedMinor, current.currency) },
                  { k: "PSP", v: current.pspProvider ?? "–" },
                  { k: "PSP intent", v: <span className="font-mono text-xs">{current.pspIntentId ?? "–"}</span> },
                  { k: "Betalingsmåte", v: current.paymentMethod ?? "–" },
                  { k: "Utløper", v: formatDateTime(current.expiresAt) },
                  { k: "Oppdatert", v: formatDateTime(current.updatedAt) },
                ]}
              />
              {current.lastError && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">Siste feil: {current.lastError}</p>}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ── Samfunn (moderering) ───────────────────────────────────────────────── */

export function AdminCommunity() {
  const utils = trpc.useUtils();
  const fb = useActionFeedback();
  const [hidden, setHidden] = useState<"all" | "hidden" | "visible">("all");
  const list = trpc.community.adminList.useQuery({ hidden, limit: 50 }, { retry: false });
  const [hideId, setHideId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const hide = trpc.community.adminHide.useMutation({
    onSuccess: () => { setHideId(null); setReason(""); fb.flash("Innlegget er skjult."); utils.community.adminList.invalidate(); },
    onError: (e) => { setHideId(null); fb.fail(e); },
  });
  const unhide = trpc.community.adminUnhide.useMutation({
    onSuccess: () => { fb.flash("Innlegget er synlig igjen."); utils.community.adminList.invalidate(); },
    onError: fb.fail,
  });
  const items = list.data?.posts ?? [];

  return (
    <div>
      <PageHeader title="Reisesamfunn" description="Moderering av innlegg fra kunder. Skjulte innlegg vises ikke offentlig, men slettes ikke." />
      <Card className="mb-4">
        <select value={hidden} onChange={(e) => setHidden(e.target.value as typeof hidden)} aria-label="Filtrer" className={selectCls}>
          <option value="all">Alle innlegg</option>
          <option value="visible">Synlige</option>
          <option value="hidden">Skjulte</option>
        </select>
      </Card>
      {fb.banner}
      {list.isLoading ? (
        <LoadingRows rows={4} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="Ingen innlegg" hint="Innlegg fra kunder dukker opp her." />
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.id}>
              <Card className={p.hidden ? "opacity-70" : undefined}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-night">{p.authorName}</span>{p.authorEmail ? ` · ${p.authorEmail}` : ""} · {formatDateTime(p.createdAt)}
                      {p.routeTag && <span className="ml-1.5 rounded bg-night/5 px-1.5 py-0.5 font-mono">{p.routeTag}</span>}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-night">{p.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{p.kind} · {p.likes} likerklikk · {p.commentCount} kommentarer</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.hidden ? <Pill tone="warning">Skjult</Pill> : <Pill tone="success">Synlig</Pill>}
                    {p.hidden ? (
                      <Btn tone="ghost" className="min-h-9 px-3 text-xs" onClick={() => unhide.mutate({ targetType: "post", id: p.id })} disabled={unhide.isPending}><Eye className="h-3.5 w-3.5" aria-hidden="true" /> Vis</Btn>
                    ) : (
                      <Btn tone="ghost" className="min-h-9 px-3 text-xs" onClick={() => setHideId(p.id)}><EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Skjul</Btn>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={hideId != null} onOpenChange={(o) => !o && setHideId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skjul innlegg</DialogTitle>
            <DialogDescription>Innlegget fjernes fra offentlig visning. Begrunnelsen lagres i aktivitetsloggen.</DialogDescription>
          </DialogHeader>
          <Field label="Begrunnelse (valgfritt)" htmlFor="hide-reason">
            <input id="hide-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className={inputCls} />
          </Field>
          <DialogFooter>
            <Btn tone="ghost" onClick={() => setHideId(null)}>Avbryt</Btn>
            <Btn tone="danger" disabled={hide.isPending || hideId == null} onClick={() => hideId != null && hide.mutate({ targetType: "post", id: hideId, reason: reason.trim() || undefined })}>
              {hide.isPending ? "Skjuler …" : "Skjul"}
            </Btn>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {fb.reauthDialog}
    </div>
  );
}
