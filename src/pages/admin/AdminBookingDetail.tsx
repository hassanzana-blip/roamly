import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  Mail,
  RefreshCw,
  FlaskConical,
  MessageSquarePlus,
  PlaneTakeoff,
  PlaneLanding,
  Eye,
  HandCoins,
  LifeBuoy,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { AttemptStatePill, BookingStatePill, Btn, Card, EmptyState, ErrorState, Field, LoadingRows, Pill, RefundStatePill, Timeline } from "./ui";
import { ATTEMPT_STATE_LABELS, BOOKING_STATE_LABELS, STAFF_TRANSITION_TARGETS, formatDateTime, formatMinor, formatMoney, inputCls, parseMinor, selectCls } from "./helpers";
import { useActionFeedback } from "./useActionFeedback";
import { CreateCaseDialog } from "./sections/Cases";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PayloadPassenger = { id?: string; givenName?: string; familyName?: string; bornOn?: string; type?: string };
type Segment = {
  id: number;
  sliceIndex: number;
  carrierIata: string | null;
  flightNumber: string | null;
  originIata: string;
  destinationIata: string;
  departingAt: string;
  arrivingAt: string;
};

const REFUND_KINDS = [
  { v: "customer_cancellation", l: "Kundekansellering" },
  { v: "airline_cancellation", l: "Flyselskapskansellering" },
  { v: "staff_goodwill", l: "Kulanse (krever beløp)" },
] as const;

/* ── Be om refusjon ─────────────────────────────────────────────────────── */

function RequestRefundDialog({ bookingId, currency, passengers, open, onClose, onDone }: { bookingId: number; currency: string; passengers: PayloadPassenger[]; open: boolean; onClose: () => void; onDone: (ref: string) => void }) {
  const fb = useActionFeedback();
  const [kind, setKind] = useState<(typeof REFUND_KINDS)[number]["v"]>("customer_cancellation");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pax, setPax] = useState<string[]>([]);
  const request = trpc.admin.requestRefund.useMutation({
    onSuccess: (r) => { onDone(r.reference); onClose(); setAmount(""); setReason(""); setPax([]); },
    onError: fb.fail,
  });
  const amountMinor = amount.trim() ? parseMinor(amount) : null;
  const invalid = kind === "staff_goodwill" ? amountMinor == null || amountMinor <= 0 : amount.trim() !== "" && amountMinor == null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Be om refusjon</DialogTitle>
          <DialogDescription>Oppretter en refusjonssak som godkjennes av økonomi. Beløp i {currency} (desimaler); tomt = beregnes fra billettens vilkår.</DialogDescription>
        </DialogHeader>
        {fb.banner}
        <div className="space-y-4">
          <Field label="Type" htmlFor="rr-kind">
            <select id="rr-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={`${selectCls} w-full`}>
              {REFUND_KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
          </Field>
          <Field label={`Beløp til kunde (${currency})`} htmlFor="rr-amount" hint={kind === "staff_goodwill" ? "Påkrevd for kulanse." : "Valgfritt."}>
            <input id="rr-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} aria-invalid={invalid} placeholder="0.00" />
          </Field>
          {passengers.length > 1 && (
            <fieldset>
              <legend className="mb-1.5 block eyebrow">Gjelder passasjerer (valgfritt)</legend>
              <div className="flex flex-wrap gap-2">
                {passengers.map((p, i) => {
                  const id = p.id ?? String(i);
                  const on = pax.includes(id);
                  return (
                    <label key={id} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${on ? "border-night bg-night text-white" : "border-border bg-card text-foreground"}`}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => setPax((s) => (on ? s.filter((x) => x !== id) : [...s, id]))} />
                      {`${p.givenName ?? ""} ${p.familyName ?? ""}`.trim() || `Passasjer ${i + 1}`}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          <Field label="Begrunnelse (minst 10 tegn)" htmlFor="rr-reason">
            <textarea id="rr-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <DialogFooter>
          <Btn tone="ghost" onClick={onClose}>Avbryt</Btn>
          <Btn
            tone="night"
            disabled={request.isPending || invalid || reason.trim().length < 10}
            onClick={() => request.mutate({ bookingId, kind, amountMinor: amountMinor ?? undefined, reason: reason.trim(), passengerIds: pax.length ? pax : undefined })}
          >
            {request.isPending ? "Oppretter …" : "Opprett refusjonssak"}
          </Btn>
        </DialogFooter>
        {fb.reauthDialog}
      </DialogContent>
    </Dialog>
  );
}

/* ── Passasjerdokumenter (maskert + «Vis») ─────────────────────────────── */

function PassengerDocuments({ docs, passengers, canReveal }: { docs: { id: number; passengerId: string | null; type: string; last4: string | null; issuingCountryCode: string | null; expiresOn: string | null }[]; passengers: PayloadPassenger[]; canReveal: boolean }) {
  const fb = useActionFeedback();
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Record<number, string>>({});
  const reveal = trpc.admin.revealPassengerDocument.useMutation({
    onSuccess: (r, vars) => { setRevealed((m) => ({ ...m, [vars.documentId]: r.uniqueIdentifier })); fb.flash("Dokumentnummer vist – handlingen er logget i aktivitetsloggen."); },
    onError: fb.fail,
  });
  const nameFor = (pid: string | null) => {
    const p = passengers.find((x) => x.id === pid);
    return p ? `${p.givenName ?? ""} ${p.familyName ?? ""}`.trim() : pid ?? "–";
  };
  if (docs.length === 0) return <p className="text-sm text-muted-foreground">Ingen identitetsdokumenter registrert.</p>;
  return (
    <div>
      {fb.banner}
      <ul className="divide-y divide-border">
        {docs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
            <div>
              <p className="font-semibold text-foreground">{nameFor(d.passengerId)}</p>
              <p className="text-xs text-muted-foreground">
                {d.type} · {d.issuingCountryCode ?? "–"} · utløper {d.expiresOn ?? "–"} ·{" "}
                <span className="font-mono">{revealed[d.id] ?? `••••${d.last4 ?? ""}`}</span>
              </p>
            </div>
            {canReveal && !revealed[d.id] && (
              <Btn tone="ghost" className="min-h-9 px-3 text-xs" onClick={() => setConfirmId(d.id)} disabled={reveal.isPending}>
                <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Vis
              </Btn>
            )}
          </li>
        ))}
      </ul>
      <AlertDialog open={confirmId != null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vise fullt dokumentnummer?</AlertDialogTitle>
            <AlertDialogDescription>Nummeret dekrypteres i minnet og vises kun her. Innsynet logges i aktivitetsloggen med ditt navn og IP-adresse. Gjør dette kun når flyselskapet eller kunden krever det.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmId != null) reveal.mutate({ documentId: confirmId }); setConfirmId(null); }}>Vis og logg</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {fb.reauthDialog}
    </div>
  );
}

/* ── Side ───────────────────────────────────────────────────────────────── */

export function AdminBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const bookingId = Number(id);
  const utils = trpc.useUtils();
  const fb = useActionFeedback();
  const perms = trpc.staffAuth.myPermissions.useQuery(undefined, { staleTime: 60_000, retry: false });
  const can = (p: string) => perms.data?.permissions.includes(p as never) ?? false;

  const detail = trpc.admin.bookingDetail.useQuery({ id: bookingId }, { retry: false, enabled: Number.isFinite(bookingId) });
  const [note, setNote] = useState("");
  const [transitionTo, setTransitionTo] = useState("");
  const [transitionReason, setTransitionReason] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);
  const [attemptEventsFor, setAttemptEventsFor] = useState<number | null>(null);
  const attemptEvents = trpc.admin.attemptEvents.useQuery({ attemptId: attemptEventsFor ?? 0 }, { enabled: attemptEventsFor != null, retry: false });

  const invalidate = () => { utils.admin.bookingDetail.invalidate({ id: bookingId }); utils.admin.bookingsList.invalidate(); utils.admin.dashboard.invalidate(); };

  const addNote = trpc.admin.addBookingNote.useMutation({ onSuccess: () => { setNote(""); fb.flash("Notat lagret."); invalidate(); }, onError: fb.fail });
  const resend = trpc.admin.resendConfirmation.useMutation({ onSuccess: () => fb.flash("Bekreftelse er lagt i e-postkøen."), onError: fb.fail });
  const reconcile = trpc.admin.reconcileBooking.useMutation({ onSuccess: () => fb.flash("Avstemming mot leverandør er lagt i kø."), onError: fb.fail });
  const retryAttempt = trpc.admin.retryAttempt.useMutation({ onSuccess: () => { fb.flash("Forsøket er lagt i kø på nytt."); invalidate(); }, onError: fb.fail });
  const transition = trpc.admin.bookingTransition.useMutation({
    onSuccess: (r) => { setTransitionTo(""); setTransitionReason(""); fb.flash(`Status endret til «${r.newStateLabel}».`); invalidate(); },
    onError: fb.fail,
  });

  if (!Number.isFinite(bookingId)) return <ErrorState message="Ugyldig bestillings-ID." />;
  if (detail.isLoading) return <LoadingRows rows={6} />;
  if (detail.error || !detail.data) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;

  const { booking, events, segments, payments, refundCases, notes, cases, quote, tickets, passengerDocuments, attempts, invoices, scheduleChanges, fraudFlags } = detail.data;
  const payload = booking.payload as { passengers?: PayloadPassenger[]; manual?: boolean; title?: string };
  const passengers = payload.passengers ?? [];
  const currency = booking.totalCurrency ?? "NOK";
  const allowedTargets = STAFF_TRANSITION_TARGETS[booking.state] ?? [];
  const busy = resend.isPending || reconcile.isPending || transition.isPending || addNote.isPending;

  return (
    <div>
      <Link to="/admin/bestillinger" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Alle bestillinger
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">{booking.bookingReference || booking.orderId}</h1>
        <BookingStatePill state={booking.state} />
        {!booking.liveMode && <Pill tone="neutral"><FlaskConical className="h-3 w-3" aria-hidden="true" /> Testmodus</Pill>}
        {fraudFlags.some((f) => f.status === "open") && <Pill tone="danger">Åpent svindelflagg</Pill>}
        <span className="text-sm text-muted-foreground">
          Opprettet {formatDateTime(booking.createdAt)} · {booking.source === "quote" ? "Fra tilbud" : booking.source === "manual" ? "Manuell" : "Direkte fra nettsiden"}
          {booking.supplier ? ` · ${booking.supplier}` : ""}
        </span>
      </div>

      {fb.banner}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <h2 className="mb-4 font-display text-xl font-semibold text-foreground">Reise og passasjerer</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="eyebrow">Kontakt</dt>
                <dd className="mt-1 break-all text-foreground">{booking.contactEmail}</dd>
                {booking.contactPhone && <dd className="text-muted-foreground">{booking.contactPhone}</dd>}
              </div>
              <div>
                <dt className="eyebrow">Beløp</dt>
                <dd className="mt-1 font-display text-xl font-semibold text-foreground">{formatMoney(booking.totalAmount, currency)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="eyebrow">Passasjerer</dt>
                <dd className="mt-1 text-foreground">
                  {passengers.length === 0 ? "–" : (
                    <ul className="flex flex-wrap gap-2">
                      {passengers.map((p, i) => (
                        <li key={p.id ?? i} className="rounded-md bg-muted px-3 py-1 text-sm">
                          {`${p.givenName ?? ""} ${p.familyName ?? ""}`.trim() || `Passasjer ${i + 1}`}
                          {p.bornOn && <span className="ml-1 text-xs text-muted-foreground">({p.bornOn})</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
              {payload.manual && payload.title && (
                <div className="sm:col-span-2">
                  <dt className="eyebrow">Manuell bestilling</dt>
                  <dd className="mt-1 text-foreground">{payload.title} · <Link to={`/admin/kvittering/${booking.id}`} className="font-semibold text-primary hover:underline">Kvittering</Link></dd>
                </div>
              )}
            </dl>
            {quote && (
              <p className="mt-4 rounded-xl bg-primary/5 px-4 py-3 text-sm text-foreground">
                Bestilt fra tilbud <span className="font-semibold">{quote.reference}</span>
              </p>
            )}
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Identitetsdokumenter</h3>
              <PassengerDocuments docs={passengerDocuments} passengers={passengers} canReveal={can("customers:reveal")} />
            </div>
          </Card>

          <Card className="overflow-x-auto p-0">
            <h2 className="px-5 pt-5 font-display text-xl font-semibold text-foreground">Flysegmenter</h2>
            {segments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Ingen segmenter registrert.</p>
            ) : (
              <table className="mt-3 w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border eyebrow">
                    <th className="px-5 py-3">Flight</th>
                    <th className="px-5 py-3">Fra</th>
                    <th className="px-5 py-3">Til</th>
                    <th className="px-5 py-3">Avgang</th>
                    <th className="px-5 py-3">Ankomst</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(segments as Segment[]).map((s) => (
                    <tr key={s.id}>
                      <td className="px-5 py-3 font-semibold text-foreground">{s.carrierIata ?? ""}{s.flightNumber ?? ""}</td>
                      <td className="px-5 py-3"><span className="inline-flex items-center gap-1.5"><PlaneTakeoff className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />{s.originIata}</span></td>
                      <td className="px-5 py-3"><span className="inline-flex items-center gap-1.5"><PlaneLanding className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />{s.destinationIata}</span></td>
                      <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(s.departingAt)}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(s.arrivingAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="px-5 py-3" />
          </Card>

          <Card>
            <Tabs defaultValue="payments">
              <TabsList className="mb-4 flex-wrap">
                <TabsTrigger value="payments">Betalinger ({payments.length})</TabsTrigger>
                <TabsTrigger value="refunds">Refusjoner ({refundCases.length})</TabsTrigger>
                <TabsTrigger value="tickets">Billetter ({tickets.length})</TabsTrigger>
                <TabsTrigger value="attempts">Forsøk ({attempts.length})</TabsTrigger>
                <TabsTrigger value="invoices">Fakturaer ({invoices.length})</TabsTrigger>
                <TabsTrigger value="changes">Ruteendringer ({scheduleChanges.length})</TabsTrigger>
                <TabsTrigger value="fraud">Svindel ({fraudFlags.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="payments">
                {payments.length === 0 ? <p className="text-sm text-muted-foreground">Ingen betalinger registrert ennå.</p> : (
                  <ul className="space-y-3">
                    {payments.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 text-sm">
                        <div>
                          <p className="font-semibold text-foreground">{formatMoney(p.amount, p.currency)}{p.refundedMinor ? <span className="ml-2 text-xs font-normal text-muted-foreground">refundert {formatMinor(p.refundedMinor, p.currency)}</span> : null}</p>
                          <p className="text-xs text-muted-foreground">{p.provider}{p.providerRef ? ` · ${p.providerRef}` : ""} · {formatDateTime(p.createdAt)}{p.note ? ` · ${p.note}` : ""}</p>
                        </div>
                        <Pill tone={["succeeded", "captured"].includes(p.status) ? "success" : p.status === "failed" ? "danger" : "warning"}>{p.status}</Pill>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="refunds">
                {refundCases.length === 0 ? <p className="text-sm text-muted-foreground">Ingen refusjonssaker.</p> : (
                  <ul className="space-y-3">
                    {refundCases.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 text-sm">
                        <div>
                          <p className="font-semibold text-foreground">
                            <Link to={`/admin/refusjoner?sak=${r.id}`} className="text-primary hover:underline">{r.reference}</Link> · {formatMinor(r.customerRefundAmountMinor ?? r.requestedAmountMinor, r.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">{r.kind} · {formatDateTime(r.createdAt)}</p>
                        </div>
                        <RefundStatePill state={r.state} />
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="tickets">
                {tickets.length === 0 ? <p className="text-sm text-muted-foreground">Ingen billetter utstedt ennå.</p> : (
                  <ul className="divide-y divide-border">
                    {tickets.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                        <span className="font-semibold text-foreground">{t.passengerName ?? t.passengerId ?? "–"}</span>
                        <span className="font-mono text-xs text-foreground">{t.uniqueIdentifier}</span>
                        <span className="text-xs text-muted-foreground">{t.type}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="attempts">
                {attempts.length === 0 ? <p className="text-sm text-muted-foreground">Ingen booking-forsøk (manuell eller tilbudsbasert booking).</p> : (
                  <ul className="space-y-3">
                    {attempts.map((a) => (
                      <li key={a.id} className="rounded-xl border border-border px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-foreground">Forsøk #{a.id} · {a.attempts} kjøringer</p>
                            <p className="text-xs text-muted-foreground">
                              {a.supplierOrderId ? `Ordre ${a.supplierOrderId} · ` : ""}{a.supplierBookingReference ? `PNR ${a.supplierBookingReference} · ` : ""}
                              {a.supplierTotalMinor != null ? `${formatMinor(a.supplierTotalMinor, a.supplierCurrency ?? currency)} · ` : ""}{formatDateTime(a.updatedAt)}
                            </p>
                            {a.lastError && <p className="mt-1 text-xs text-destructive"><span className="font-mono">{a.lastErrorCode ?? ""}</span> {a.lastError}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <AttemptStatePill state={a.state} />
                            <Btn tone="ghost" className="min-h-9 px-3 text-xs" onClick={() => setAttemptEventsFor(attemptEventsFor === a.id ? null : a.id)} aria-expanded={attemptEventsFor === a.id}>Tidslinje</Btn>
                            {can("bookings:write") && !["CONFIRMED", "FAILED_VOIDED", "FAILED"].includes(a.state) && (
                              <Btn tone="night" className="min-h-9 px-3 text-xs" onClick={() => retryAttempt.mutate({ attemptId: a.id })} disabled={retryAttempt.isPending}><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Prøv igjen</Btn>
                            )}
                          </div>
                        </div>
                        {attemptEventsFor === a.id && (
                          <div className="mt-3 border-t border-border pt-3">
                            {attemptEvents.isLoading ? <p className="text-xs text-muted-foreground">Laster …</p> : attemptEvents.error ? <ErrorState error={attemptEvents.error} /> : (
                              <Timeline items={(attemptEvents.data ?? []).map((e) => ({ id: e.id, title: <>{e.fromState ? `${ATTEMPT_STATE_LABELS[e.fromState] ?? e.fromState} → ` : ""}<span className="font-semibold">{ATTEMPT_STATE_LABELS[e.toState] ?? e.toState}</span></>, sub: e.detail, at: e.createdAt }))} />
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="invoices">
                {invoices.length === 0 ? <p className="text-sm text-muted-foreground">Ingen fakturaer/kvitteringer utstedt.</p> : (
                  <ul className="divide-y divide-border">
                    {invoices.map((inv) => (
                      <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                        <span className="font-semibold text-foreground">#{inv.invoiceNumber} · {inv.kind === "credit_note" ? "Kreditnota" : "Kvittering"}</span>
                        <span className="text-foreground">{formatMinor(inv.totalMinor, inv.currency)}<span className="ml-1 text-xs text-muted-foreground">(mva {formatMinor(inv.vatMinor, inv.currency)})</span></span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(inv.issuedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="changes">
                {scheduleChanges.length === 0 ? <p className="text-sm text-muted-foreground">Ingen ruteendringer.</p> : (
                  <ul className="space-y-2">
                    {scheduleChanges.map((sc) => (
                      <li key={sc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 text-sm">
                        <span className="text-foreground">Oppdaget {formatDateTime(sc.createdAt)}{sc.resolvedAt ? ` · løst ${formatDateTime(sc.resolvedAt)}` : ""}</span>
                        <div className="flex items-center gap-2">
                          <Pill tone={sc.status === "resolved" ? "success" : "warning"}>{sc.status === "resolved" ? "Løst" : "Uløst"}</Pill>
                          <Link to="/admin/ruteendringer" className="text-xs font-semibold text-primary hover:underline">Åpne</Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="fraud">
                {fraudFlags.length === 0 ? <p className="text-sm text-muted-foreground">Ingen svindelflagg.</p> : (
                  <ul className="space-y-2">
                    {fraudFlags.map((f) => (
                      <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 text-sm">
                        <span className="text-foreground"><span className="font-mono text-xs">{f.type}</span> · score {f.score}{f.note ? ` · ${f.note}` : ""}</span>
                        <div className="flex items-center gap-2">
                          <Pill tone={f.status === "open" ? "danger" : "success"}>{f.status === "open" ? "Åpent" : "Vurdert"}</Pill>
                          <Link to="/admin/svindel" className="text-xs font-semibold text-primary hover:underline">Åpne</Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </Card>

          <Card>
            <h2 className="mb-4 font-display text-xl font-semibold text-foreground">Hendelseslogg</h2>
            <Timeline items={events.map((e) => ({ id: e.id, title: <>{e.fromState ? <>{e.fromState} → </> : null}<span className="font-semibold">{e.toState}</span><span className="text-muted-foreground"> · {e.actorType}</span></>, sub: e.reason, at: e.createdAt }))} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 font-display text-xl font-semibold text-foreground">Handlinger</h2>
            <div className="space-y-2.5">
              {can("bookings:write") && (
                <Btn tone="ghost" className="w-full justify-start" onClick={() => resend.mutate({ bookingId })} disabled={busy}>
                  <Mail className="h-4 w-4 text-primary" aria-hidden="true" /> Send bekreftelse på nytt
                </Btn>
              )}
              {can("bookings:reconcile") && (
                <Btn tone="ghost" className="w-full justify-start" onClick={() => reconcile.mutate({ bookingId })} disabled={busy}>
                  <RefreshCw className="h-4 w-4 text-primary" aria-hidden="true" /> Avstem mot leverandør nå
                </Btn>
              )}
              {can("refunds:request") && (
                <Btn tone="ghost" className="w-full justify-start" onClick={() => setRefundOpen(true)}>
                  <HandCoins className="h-4 w-4 text-primary" aria-hidden="true" /> Be om refusjon
                </Btn>
              )}
              {can("support:write") && (
                <Btn tone="ghost" className="w-full justify-start" onClick={() => setCaseOpen(true)}>
                  <LifeBuoy className="h-4 w-4 text-primary" aria-hidden="true" /> Opprett kundeservicesak
                </Btn>
              )}
            </div>

            {can("bookings:write") && allowedTargets.length > 0 && (
              <form
                className="mt-5 space-y-3 border-t border-border pt-5"
                onSubmit={(e) => { e.preventDefault(); if (!transitionTo || transitionReason.trim().length < 3) return; transition.mutate({ bookingId, toState: transitionTo as never, reason: transitionReason.trim() }); }}
              >
                <Field label="Endre status" htmlFor="transition-to">
                  <select id="transition-to" value={transitionTo} onChange={(e) => setTransitionTo(e.target.value)} className={`${selectCls} w-full`}>
                    <option value="">Velg ny status …</option>
                    {allowedTargets.map((s) => <option key={s} value={s}>{BOOKING_STATE_LABELS[s] ?? s}</option>)}
                  </select>
                </Field>
                <textarea value={transitionReason} onChange={(e) => setTransitionReason(e.target.value)} placeholder="Begrunnelse (påkrevd, minst 3 tegn) – logges i aktivitetsloggen" aria-label="Begrunnelse for statusendring" rows={3} className={inputCls} />
                <Btn type="submit" tone="night" className="w-full" disabled={busy || !transitionTo || transitionReason.trim().length < 3}>
                  {transition.isPending ? "Endrer …" : "Bekreft statusendring"}
                </Btn>
              </form>
            )}

            {cases.length > 0 && (
              <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                <p className="mb-1 font-semibold text-foreground">Kundeservicesaker</p>
                <ul className="space-y-1">
                  {cases.map((c) => (
                    <li key={c.id}>
                      <Link to={`/admin/kundeservice?case=${c.id}`} className="font-semibold text-primary hover:underline">{c.reference}</Link> · {c.subject} <span className="text-xs">({c.status})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-foreground">
              <MessageSquarePlus className="h-5 w-5 text-primary" aria-hidden="true" /> Interne notater
            </h2>
            {can("bookings:write") && (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (note.trim()) addNote.mutate({ bookingId, body: note.trim() }); }}>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Skriv et internt notat (kun synlig for ansatte) …" aria-label="Nytt internt notat" rows={3} className={inputCls} />
                <Btn type="submit" tone="primary" className="w-full" disabled={busy || !note.trim()}>{addNote.isPending ? "Lagrer …" : "Legg til notat"}</Btn>
              </form>
            )}
            {notes.length > 0 ? (
              <ul className="mt-4 space-y-3 border-t border-border pt-4">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-xl bg-background px-4 py-3">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{n.body}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">{n.author} · {formatDateTime(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Ingen notater ennå.</p>
            )}
          </Card>
        </div>
      </div>

      <RequestRefundDialog bookingId={bookingId} currency={currency} passengers={passengers} open={refundOpen} onClose={() => setRefundOpen(false)} onDone={(ref) => { fb.flash(`Refusjonssak ${ref} opprettet.`); invalidate(); utils.admin.refundCasesList.invalidate(); }} />
      <CreateCaseDialog bookingId={bookingId} open={caseOpen} onClose={() => setCaseOpen(false)} onCreated={() => { fb.flash("Kundeservicesak opprettet."); invalidate(); }} />
      {fb.reauthDialog}
    </div>
  );
}

export function AdminBookingsEmpty() {
  return <EmptyState title="Velg en bestilling" hint="Åpne listen over bestillinger først." />;
}
