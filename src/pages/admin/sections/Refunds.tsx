import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { BookingStatePill, Btn, Card, ClickableRow, EmptyState, ErrorState, Field, KV, LoadingRows, PageHeader, Pager, RefundStatePill, TableCard, Timeline } from "../ui";
import { REFUND_STATE_LABELS, formatDateTime, formatMinor, inputCls, minorToDecimal, parseMinor, selectCls, tdCls, thCls } from "../helpers";
import { useActionFeedback } from "../useActionFeedback";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const KIND_LABELS: Record<string, string> = {
  staff_goodwill: "Kulanse",
  customer_cancellation: "Kundekansellering",
  airline_cancellation: "Flyselskapskansellering",
};

const APPROVABLE = ["requested", "eligibility_checked", "supplier_requested", "supplier_pending", "supplier_confirmed", "psp_refund_failed"];
const REJECTABLE = ["requested", "eligibility_checked", "supplier_requested", "supplier_pending"];
const RETRYABLE = ["psp_refund_failed", "amount_confirmed", "supplier_confirmed"];

function RefundDetail({ id, onClose, canProcess }: { id: number | null; onClose: () => void; canProcess: boolean }) {
  const utils = trpc.useUtils();
  const fb = useActionFeedback();
  const detail = trpc.admin.refundCaseDetail.useQuery({ id: id ?? 0 }, { enabled: id != null, retry: false });
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [amounts, setAmounts] = useState({ customer: "", supplier: "", fee: "", note: "" });

  const invalidate = () => {
    utils.admin.refundCasesList.invalidate();
    if (id != null) utils.admin.refundCaseDetail.invalidate({ id });
    utils.admin.dashboard.invalidate();
  };
  const approve = trpc.admin.approveRefund.useMutation({
    onSuccess: (r) => { setApproveOpen(false); fb.flash(`Godkjent: ${formatMinor(r.amountMinor, rc?.currency)} legges i refusjonskø.`); invalidate(); },
    onError: (e) => { setApproveOpen(false); fb.fail(e); },
  });
  const reject = trpc.admin.rejectRefund.useMutation({
    onSuccess: () => { setRejectOpen(false); setRejectReason(""); fb.flash("Refusjonen er avvist og kunden varslet."); invalidate(); },
    onError: (e) => { setRejectOpen(false); fb.fail(e); },
  });
  const retry = trpc.admin.retryRefund.useMutation({
    onSuccess: () => { fb.flash("Refusjon lagt i kø på nytt."); invalidate(); },
    onError: fb.fail,
  });

  const rc = detail.data;
  const openApprove = () => {
    if (!rc) return;
    setAmounts({
      customer: minorToDecimal(rc.customerRefundAmountMinor ?? rc.requestedAmountMinor ?? null),
      supplier: minorToDecimal(rc.supplierRefundAmountMinor ?? null),
      fee: minorToDecimal(rc.serviceFeeRefundMinor),
      note: "",
    });
    setApproveOpen(true);
  };
  const cur = rc?.currency ?? "NOK";
  const invalidAmount = (v: string) => v.trim() !== "" && parseMinor(v) == null;

  return (
    <Sheet open={id != null} onOpenChange={(o) => { if (!o) { onClose(); fb.clear(); } }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{rc ? `Refusjonssak ${rc.reference}` : "Refusjonssak"}</SheetTitle>
          <SheetDescription>{rc ? `${KIND_LABELS[rc.kind] ?? rc.kind} · opprettet ${formatDateTime(rc.createdAt)}` : "Laster …"}</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          {fb.banner}
          {detail.isLoading ? (
            <LoadingRows rows={3} />
          ) : detail.error || !rc ? (
            <ErrorState error={detail.error} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <RefundStatePill state={rc.state} />
                {rc.booking && (
                  <Link to={`/admin/bestillinger/${rc.booking.id}`} className="text-sm font-semibold text-primary hover:underline">
                    Bestilling {rc.booking.bookingReference ?? `#${rc.booking.id}`}
                  </Link>
                )}
                {rc.booking && <BookingStatePill state={rc.booking.state} />}
              </div>
              <KV
                items={[
                  { k: "Forespurt beløp", v: formatMinor(rc.requestedAmountMinor, cur) },
                  { k: "Til kunde", v: <strong>{formatMinor(rc.customerRefundAmountMinor, cur)}</strong> },
                  { k: "Fra leverandør", v: formatMinor(rc.supplierRefundAmountMinor, rc.supplierRefundCurrency ?? cur) },
                  { k: "Servicegebyr refundert", v: formatMinor(rc.serviceFeeRefundMinor, cur) },
                  { k: "Tjenester refundert", v: formatMinor(rc.servicesRefundMinor, cur) },
                  { k: "Allerede refundert (booking)", v: formatMinor(rc.alreadyRefundedMinor, cur) },
                  { k: "Betaling", v: rc.payment ? <>{rc.payment.provider} · fanget {formatMinor(rc.payment.amountMinor, rc.payment.currency)}<br /><span className="font-mono text-xs text-muted-foreground">{rc.payment.providerRef ?? ""}</span></> : "–" },
                  { k: "PSP-refusjon", v: rc.pspRefundId ? <span className="font-mono text-xs">{rc.pspRefundId} · {rc.pspRefundStatus ?? ""}</span> : "–" },
                  { k: "Initiert av", v: rc.initiatedBy },
                  { k: "Kunde", v: rc.booking?.contactEmail ?? "–" },
                ]}
              />
              <div>
                <p className="eyebrow">Begrunnelse</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{rc.reason}</p>
              </div>
              {rc.lastError && (
                <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">Siste feil: {rc.lastError}</p>
              )}
              {canProcess && (
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  {APPROVABLE.includes(rc.state) && (
                    <Btn tone="success" onClick={openApprove}><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Godkjenn</Btn>
                  )}
                  {REJECTABLE.includes(rc.state) && (
                    <Btn tone="danger" onClick={() => setRejectOpen(true)}><XCircle className="h-4 w-4" aria-hidden="true" /> Avvis</Btn>
                  )}
                  {RETRYABLE.includes(rc.state) && (
                    <Btn tone="ghost" onClick={() => retry.mutate({ refundCaseId: rc.id })} disabled={retry.isPending}>
                      <RefreshCw className="h-4 w-4" aria-hidden="true" /> {retry.isPending ? "Legger i kø …" : "Prøv utbetaling på nytt"}
                    </Btn>
                  )}
                </div>
              )}
              <div>
                <h3 className="mb-3 font-display text-base font-semibold text-foreground">Tidslinje</h3>
                <Timeline
                  items={rc.events.map((e) => ({
                    id: e.id,
                    title: <>{e.fromState ? <>{REFUND_STATE_LABELS[e.fromState] ?? e.fromState} → </> : null}<span className="font-semibold">{e.toLabel}</span><span className="text-muted-foreground"> · {e.actorType}</span></>,
                    sub: e.note,
                    at: e.createdAt,
                  }))}
                />
              </div>
            </>
          )}
        </div>

        <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Godkjenn refusjon</DialogTitle>
              <DialogDescription>
                Beløp i {cur} (desimaler). Tomt felt bruker verdien fra saken. Beløpet kan ikke overstige fanget beløp minus det som allerede er refundert. Krever nylig innlogging.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <Field label={`Til kunde (${cur})`} htmlFor="ap-customer" hint="Totalt beløp kunden får tilbake.">
                <input id="ap-customer" inputMode="decimal" value={amounts.customer} onChange={(e) => setAmounts((a) => ({ ...a, customer: e.target.value }))} className={inputCls} aria-invalid={invalidAmount(amounts.customer)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`Fra leverandør (${cur})`} htmlFor="ap-supplier">
                  <input id="ap-supplier" inputMode="decimal" value={amounts.supplier} onChange={(e) => setAmounts((a) => ({ ...a, supplier: e.target.value }))} className={inputCls} aria-invalid={invalidAmount(amounts.supplier)} />
                </Field>
                <Field label={`Servicegebyr (${cur})`} htmlFor="ap-fee">
                  <input id="ap-fee" inputMode="decimal" value={amounts.fee} onChange={(e) => setAmounts((a) => ({ ...a, fee: e.target.value }))} className={inputCls} aria-invalid={invalidAmount(amounts.fee)} />
                </Field>
              </div>
              <Field label="Notat (valgfritt)" htmlFor="ap-note">
                <textarea id="ap-note" rows={2} value={amounts.note} onChange={(e) => setAmounts((a) => ({ ...a, note: e.target.value }))} className={inputCls} />
              </Field>
            </div>
            <DialogFooter>
              <Btn tone="ghost" onClick={() => setApproveOpen(false)}>Avbryt</Btn>
              <Btn
                tone="success"
                disabled={approve.isPending || !rc || [amounts.customer, amounts.supplier, amounts.fee].some(invalidAmount)}
                onClick={() =>
                  rc &&
                  approve.mutate({
                    refundCaseId: rc.id,
                    customerRefundAmountMinor: amounts.customer.trim() ? (parseMinor(amounts.customer) ?? undefined) : undefined,
                    supplierRefundAmountMinor: amounts.supplier.trim() ? (parseMinor(amounts.supplier) ?? undefined) : undefined,
                    serviceFeeRefundMinor: amounts.fee.trim() ? (parseMinor(amounts.fee) ?? undefined) : undefined,
                    note: amounts.note.trim() || undefined,
                  })
                }
              >
                {approve.isPending ? "Godkjenner …" : "Godkjenn og utbetal"}
              </Btn>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Avvis refusjon</DialogTitle>
              <DialogDescription>Begrunnelsen sendes til kunden på e-post.</DialogDescription>
            </DialogHeader>
            <Field label="Begrunnelse" htmlFor="rj-reason">
              <textarea id="rj-reason" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className={inputCls} minLength={3} />
            </Field>
            <DialogFooter>
              <Btn tone="ghost" onClick={() => setRejectOpen(false)}>Avbryt</Btn>
              <Btn tone="danger" disabled={rejectReason.trim().length < 3 || reject.isPending || !rc} onClick={() => rc && reject.mutate({ refundCaseId: rc.id, reason: rejectReason.trim() })}>
                {reject.isPending ? "Avviser …" : "Avvis"}
              </Btn>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {fb.reauthDialog}
      </SheetContent>
    </Sheet>
  );
}

export function AdminRefunds() {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [page, setPage] = useState(1);
  const selected = params.get("sak") ? Number(params.get("sak")) : null;
  const perms = trpc.staffAuth.myPermissions.useQuery(undefined, { staleTime: 60_000, retry: false });
  const canProcess = perms.data?.permissions.includes("refunds:process") ?? false;
  const list = trpc.admin.refundCasesList.useQuery(
    { state: state || undefined, open: onlyOpen && !state ? true : undefined, page, pageSize: 25 },
    { retry: false, placeholderData: (p) => p },
  );

  return (
    <div>
      <PageHeader title="Refusjoner" description="Refusjonssaker fra kunder, ansatte og flyselskap. Godkjenning krever nylig innlogging og logges." />
      <Card className="mb-4 flex flex-wrap items-center gap-3">
        <select value={state} onChange={(e) => { setState(e.target.value); setPage(1); }} aria-label="Filtrer på tilstand" className={selectCls}>
          <option value="">Alle tilstander</option>
          {Object.entries(REFUND_STATE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => { setOnlyOpen(e.target.checked); setPage(1); }} disabled={Boolean(state)} className="h-4 w-4 rounded border-border" />
          Kun åpne saker
        </label>
      </Card>
      {list.isLoading ? (
        <LoadingRows rows={4} />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Ingen refusjonssaker" hint="Saker opprettes fra en bestilling («Be om refusjon») eller av kunden selv." />
      ) : (
        <TableCard minWidth={820} caption="Refusjonssaker">
          <thead>
            <tr className="border-b border-border">
              <th className={thCls}>Sak</th>
              <th className={thCls}>Bestilling</th>
              <th className={thCls}>Type</th>
              <th className={thCls}>Beløp</th>
              <th className={thCls}>Tilstand</th>
              <th className={thCls}>Godkjent av</th>
              <th className={thCls}>Oppdatert</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.data.items.map((r) => (
              <ClickableRow key={r.id} onClick={() => setParams({ sak: String(r.id) })} selected={selected === r.id}>
                <td className={`${tdCls} font-semibold text-foreground`}>{r.reference}</td>
                <td className={tdCls}>
                  <span className="block text-foreground">{r.bookingReference ?? `#${r.bookingId}`}</span>
                  <span className="block text-xs text-muted-foreground">{r.customerEmail}</span>
                </td>
                <td className={`${tdCls} text-foreground`}>{KIND_LABELS[r.kind] ?? r.kind}</td>
                <td className={`${tdCls} whitespace-nowrap font-semibold text-foreground`}>{formatMinor(r.customerRefundAmountMinor ?? r.requestedAmountMinor, r.currency)}</td>
                <td className={tdCls}><RefundStatePill state={r.state} /></td>
                <td className={`${tdCls} text-muted-foreground`}>{r.approverName ?? "–"}</td>
                <td className={`${tdCls} whitespace-nowrap text-muted-foreground`}>{formatDateTime(r.updatedAt)}</td>
              </ClickableRow>
            ))}
          </tbody>
        </TableCard>
      )}
      {list.data && <Pager page={page} total={list.data.total} pageSize={25} onPage={setPage} />}
      <RefundDetail id={selected} onClose={() => setParams({})} canProcess={canProcess} />
    </div>
  );
}
