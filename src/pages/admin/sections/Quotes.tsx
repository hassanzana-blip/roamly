import { useState } from "react";
import { Link } from "react-router";
import { PlusCircle, Send, BadgeCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Btn, Card, ClickableRow, CopyButton, EmptyState, ErrorState, Field, KV, LoadingRows, PageHeader, Pager, Pill, TableCard } from "../ui";
import { formatDateTime, formatMoney, inputCls, selectCls, tdCls, thCls } from "../helpers";
import { useActionFeedback } from "../useActionFeedback";
import { useRecordParam } from "../useRecordParam";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Utkast",
  sent: "Sendt",
  paid: "Betalt",
  booked: "Booket",
  expired: "Utløpt",
  failed: "Feilet",
};

function quoteTone(status: string) {
  if (status === "booked") return "success" as const;
  if (status === "failed" || status === "expired") return "danger" as const;
  if (status === "sent" || status === "paid") return "info" as const;
  return "neutral" as const;
}

/* ── Opprett tilbud ─────────────────────────────────────────────────────── */

function CreateQuoteDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const utils = trpc.useUtils();
  const fb = useActionFeedback();
  const [form, setForm] = useState({ offerId: "", customerName: "", customerEmail: "", customerPhone: "", serviceFeeAmount: "", expiresInHours: "24" });
  const [result, setResult] = useState<{ reference: string; total: string; checkoutPath: string } | null>(null);
  const create = trpc.admin.createQuote.useMutation({
    onSuccess: (r) => {
      setResult(r);
      utils.admin.quotesList.invalidate();
      onCreated(r.id);
    },
    onError: fb.fail,
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const reset = () => {
    setForm({ offerId: "", customerName: "", customerEmail: "", customerPhone: "", serviceFeeAmount: "", expiresInHours: "24" });
    setResult(null);
    fb.clear();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nytt tilbud</DialogTitle>
          <DialogDescription>
            Lim inn tilbuds-ID fra flysøket (Duffel offer id). Servicegebyret beregnes automatisk (8 % + 250 kr) hvis du lar feltet stå tomt.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
              <p className="font-semibold">Tilbud {result.reference} opprettet · {formatMoney(result.total)}</p>
              <p className="mt-1">Betalingslenke (vises kun nå – send den til kunden eller bruk «Send» for e-post):</p>
              <p className="mt-1.5 select-all break-all rounded-lg bg-card px-3 py-2 font-mono text-xs text-foreground">
                {window.location.origin}{result.checkoutPath}
              </p>
            </div>
            <DialogFooter>
              <CopyButton text={`${window.location.origin}${result.checkoutPath}`} label="Kopier lenke" />
              <Btn tone="night" onClick={() => { onClose(); reset(); }}>Lukk</Btn>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({
                offerId: form.offerId.trim(),
                customerName: form.customerName.trim(),
                customerEmail: form.customerEmail.trim(),
                customerPhone: form.customerPhone.trim() || undefined,
                serviceFeeAmount: form.serviceFeeAmount.trim() || undefined,
                expiresInHours: Number(form.expiresInHours) || 24,
              });
            }}
          >
            {fb.banner}
            <Field label="Tilbuds-ID (offer id)" htmlFor="q-offer">
              <input id="q-offer" required value={form.offerId} onChange={set("offerId")} className={inputCls} placeholder="off_…" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kundens navn" htmlFor="q-name">
                <input id="q-name" required value={form.customerName} onChange={set("customerName")} className={inputCls} autoComplete="off" />
              </Field>
              <Field label="E-post" htmlFor="q-email">
                <input id="q-email" type="email" required value={form.customerEmail} onChange={set("customerEmail")} className={inputCls} autoComplete="off" />
              </Field>
              <Field label="Telefon (valgfritt)" htmlFor="q-phone">
                <input id="q-phone" value={form.customerPhone} onChange={set("customerPhone")} className={inputCls} autoComplete="off" />
              </Field>
              <Field label="Gyldig i timer" htmlFor="q-hours">
                <input id="q-hours" type="number" min={1} max={168} value={form.expiresInHours} onChange={set("expiresInHours")} className={inputCls} />
              </Field>
            </div>
            <Field label="Overstyr servicegebyr (valgfritt)" htmlFor="q-fee" hint="Desimalbeløp i tilbudets valuta, f.eks. 350.00. Tomt = automatisk.">
              <input id="q-fee" inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={form.serviceFeeAmount} onChange={set("serviceFeeAmount")} className={inputCls} placeholder="Automatisk" />
            </Field>
            <DialogFooter>
              <Btn tone="ghost" onClick={() => { onClose(); reset(); }}>Avbryt</Btn>
              <Btn type="submit" tone="night" disabled={create.isPending}>
                {create.isPending ? "Oppretter …" : "Opprett tilbud"}
              </Btn>
            </DialogFooter>
          </form>
        )}
        {fb.reauthDialog}
      </DialogContent>
    </Dialog>
  );
}

/* ── Detalj ─────────────────────────────────────────────────────────────── */

function QuoteDetail({ id, onClose }: { id: number | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const fb = useActionFeedback();
  const detail = trpc.admin.quoteDetail.useQuery({ id: id ?? 0 }, { enabled: id != null, retry: false });
  const [paidOpen, setPaidOpen] = useState(false);
  const [paidNote, setPaidNote] = useState("");
  const [sentPath, setSentPath] = useState<string | null>(null);

  const invalidate = () => {
    utils.admin.quotesList.invalidate();
    if (id != null) utils.admin.quoteDetail.invalidate({ id });
  };
  const send = trpc.admin.sendQuote.useMutation({
    onSuccess: (r) => { setSentPath(r.checkoutPath); fb.flash("Tilbudet er sendt til kunden på e-post."); invalidate(); },
    onError: fb.fail,
  });
  const markPaid = trpc.admin.markQuotePaid.useMutation({
    onSuccess: () => { setPaidOpen(false); setPaidNote(""); fb.flash("Merket som betalt. Booking legges i kø."); invalidate(); },
    onError: (e) => { setPaidOpen(false); fb.fail(e); },
  });

  const q = detail.data;
  const offer = (q?.offer ?? {}) as { slices?: { origin?: { iata?: string }; destination?: { iata?: string }; departingAt?: string }[]; passengers?: unknown[]; totalAmount?: string; totalCurrency?: string };

  return (
    <Sheet open={id != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{q ? `Tilbud ${q.reference}` : "Tilbud"}</SheetTitle>
          <SheetDescription>{q ? `Opprettet av ${q.creatorName} · ${formatDateTime(q.createdAt)}` : "Laster …"}</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          {fb.banner}
          {detail.isLoading ? (
            <LoadingRows rows={3} />
          ) : detail.error || !q ? (
            <ErrorState error={detail.error} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={quoteTone(q.status)}>{QUOTE_STATUS_LABELS[q.status] ?? q.status}</Pill>
                <span className="text-sm text-muted-foreground">Utløper {formatDateTime(q.expiresAt)}</span>
              </div>
              <KV
                items={[
                  { k: "Kunde", v: <>{q.customerName}<br /><span className="text-muted-foreground">{q.customerEmail}{q.customerPhone ? ` · ${q.customerPhone}` : ""}</span></> },
                  { k: "Totalt", v: <strong>{formatMoney(q.totalAmount, q.currency)}</strong> },
                  { k: "Servicegebyr", v: formatMoney(q.serviceFeeAmount, q.currency) },
                  { k: "Flypris", v: formatMoney(offer.totalAmount, offer.totalCurrency ?? q.currency) },
                  { k: "Rute", v: (offer.slices ?? []).map((s) => `${s.origin?.iata ?? "?"} → ${s.destination?.iata ?? "?"}`).join(" · ") || "–" },
                  { k: "Passasjerer", v: String(offer.passengers?.length ?? "–") },
                  { k: "Tilbuds-ID", v: <span className="font-mono text-xs">{q.offerId}</span> },
                ]}
              />
              {sentPath && (
                <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
                  <p className="font-semibold text-success">Ny betalingslenke (gamle lenker er ugyldige):</p>
                  <p className="mt-1 select-all break-all font-mono text-xs text-foreground">{window.location.origin}{sentPath}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {(q.status === "draft" || q.status === "sent") && (
                  <Btn tone="night" onClick={() => send.mutate({ quoteId: q.id })} disabled={send.isPending}>
                    <Send className="h-4 w-4" aria-hidden="true" /> {send.isPending ? "Sender …" : q.status === "sent" ? "Send på nytt" : "Send til kunde"}
                  </Btn>
                )}
                {q.status === "sent" && (
                  <Btn tone="success" onClick={() => setPaidOpen(true)}>
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Merk som betalt
                  </Btn>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                «Merk som betalt» brukes kun ved manuell betaling (bank). Krever nylig innlogging og logges.
              </p>
            </>
          )}
        </div>

        <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bekreft manuell betaling</DialogTitle>
              <DialogDescription>Skriv hvor betalingen er mottatt (f.eks. bankreferanse). Bookingen starter automatisk etterpå.</DialogDescription>
            </DialogHeader>
            <Field label="Notat" htmlFor="paid-note">
              <input id="paid-note" value={paidNote} onChange={(e) => setPaidNote(e.target.value)} className={inputCls} placeholder="Bankoverføring, ref. 12345" minLength={3} />
            </Field>
            <DialogFooter>
              <Btn tone="ghost" onClick={() => setPaidOpen(false)}>Avbryt</Btn>
              <Btn
                tone="success"
                disabled={paidNote.trim().length < 3 || markPaid.isPending || !q}
                onClick={() => q && markPaid.mutate({ quoteId: q.id, note: paidNote.trim(), confirmFreshSession: true })}
              >
                {markPaid.isPending ? "Bekrefter …" : "Bekreft betaling"}
              </Btn>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {fb.reauthDialog}
      </SheetContent>
    </Sheet>
  );
}

/* ── Liste ──────────────────────────────────────────────────────────────── */

export function AdminQuotes() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useRecordParam("tilbud");
  const perms = trpc.staffAuth.myPermissions.useQuery(undefined, { staleTime: 60_000, retry: false });
  const canWrite = perms.data?.permissions.includes("quotes:write") ?? false;
  const list = trpc.admin.quotesList.useQuery({ status: status || undefined, page, pageSize: 25 }, { retry: false, placeholderData: (p) => p });

  return (
    <div>
      <PageHeader
        title="Tilbud"
        description="Assistert booking: opprett et tilbud fra et flytilbud og send betalingslenke til kunden."
        actions={
          canWrite && (
            <Btn tone="night" onClick={() => setCreateOpen(true)}>
              <PlusCircle className="h-4 w-4" aria-hidden="true" /> Nytt tilbud
            </Btn>
          )
        }
      />
      <Card className="mb-4">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filtrer på status" className={selectCls}>
          <option value="">Alle statuser</option>
          {Object.entries(QUOTE_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Card>
      {list.isLoading ? (
        <LoadingRows rows={5} />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Ingen tilbud ennå" hint="Opprett tilbud fra et flysøk for kunder som vil ha hjelp til bookingen." />
      ) : (
        <TableCard minWidth={760} caption="Tilbud">
          <thead>
            <tr className="border-b border-border">
              <th className={thCls}>Referanse</th>
              <th className={thCls}>Kunde</th>
              <th className={thCls}>Beløp</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Utløper</th>
              <th className={thCls}>Opprettet av</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.data.items.map((q) => (
              <ClickableRow key={q.id} onClick={() => setSelected(q.id)} selected={selected === q.id}>
                <td className={`${tdCls} font-semibold text-foreground`}>{q.reference}</td>
                <td className={tdCls}>
                  <span className="block text-foreground">{q.customerName}</span>
                  <span className="block text-xs text-muted-foreground">{q.customerEmail}</span>
                </td>
                <td className={`${tdCls} whitespace-nowrap font-semibold text-foreground`}>{formatMoney(q.totalAmount, q.currency)}</td>
                <td className={tdCls}><Pill tone={quoteTone(q.status)}>{QUOTE_STATUS_LABELS[q.status] ?? q.status}</Pill></td>
                <td className={`${tdCls} whitespace-nowrap text-muted-foreground`}>{formatDateTime(q.expiresAt)}</td>
                <td className={`${tdCls} text-muted-foreground`}>{q.creatorName}</td>
              </ClickableRow>
            ))}
          </tbody>
        </TableCard>
      )}
      {list.data && <Pager page={page} total={list.data.total} pageSize={25} onPage={setPage} />}
      <p className="mt-4 text-xs text-muted-foreground">
        Bookinger opprettet fra tilbud finner du under <Link to="/admin/bestillinger" className="font-semibold text-primary hover:underline">Bestillinger</Link>.
      </p>
      <CreateQuoteDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => undefined} />
      <QuoteDetail id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
