import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Lock, Send } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Btn, ClickableRow, EmptyState, ErrorState, Field, LoadingRows, PageHeader, Pager, Pill, TableCard } from "../ui";
import { formatDateTime, inputCls, selectCls, tdCls, thCls } from "../helpers";
import { useActionFeedback } from "../useActionFeedback";
import { CASE_PRIORITY, CASE_STATUS } from "../helpers";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const QUEUES = [
  { value: "all", label: "Alle" },
  { value: "unassigned", label: "Ufordelte" },
  { value: "urgent", label: "Haster" },
  { value: "waiting", label: "Venter på kunde" },
  { value: "mine", label: "Mine saker" },
] as const;
type Queue = (typeof QUEUES)[number]["value"];

export function PriorityPill({ priority }: { priority: string }) {
  return (
    <Pill tone={priority === "urgent" ? "danger" : priority === "high" ? "warning" : "neutral"}>{CASE_PRIORITY[priority] ?? priority}</Pill>
  );
}
export function CaseStatusPill({ status }: { status: string }) {
  return (
    <Pill tone={status === "open" ? "info" : status === "resolved" || status === "closed" ? "success" : "warning"}>{CASE_STATUS[status] ?? status}</Pill>
  );
}

/* ── Sak-detalj ─────────────────────────────────────────────────────────── */

export function CaseDetail({ id, onClose, canWrite }: { id: number | null; onClose: () => void; canWrite: boolean }) {
  const utils = trpc.useUtils();
  const fb = useActionFeedback();
  const detail = trpc.admin.caseDetail.useQuery({ id: id ?? 0 }, { enabled: id != null, retry: false, refetchInterval: 30_000 });
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const invalidate = () => {
    utils.admin.casesList.invalidate();
    if (id != null) utils.admin.caseDetail.invalidate({ id });
    utils.admin.dashboard.invalidate();
  };
  const send = trpc.admin.replyToCase.useMutation({
    onSuccess: () => { setReply(""); fb.flash(internal ? "Internt notat lagret." : "Svar sendt til kunden."); invalidate(); },
    onError: fb.fail,
  });
  const update = trpc.admin.updateCase.useMutation({
    onSuccess: () => { fb.flash("Saken er oppdatert."); invalidate(); },
    onError: fb.fail,
  });

  const c = detail.data;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [c?.messages.length]);

  return (
    <Sheet open={id != null} onOpenChange={(o) => { if (!o) { onClose(); fb.clear(); } }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{c ? `${c.reference} · ${c.subject}` : "Sak"}</SheetTitle>
          <SheetDescription>
            {c ? <>{c.customerName ? `${c.customerName} · ` : ""}{c.customerEmail} · opprettet {formatDateTime(c.createdAt)}</> : "Laster …"}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          {fb.banner}
          {detail.isLoading ? (
            <LoadingRows rows={3} />
          ) : detail.error || !c ? (
            <ErrorState error={detail.error} />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Status" htmlFor="case-status">
                  <select id="case-status" value={c.status} disabled={!canWrite || update.isPending} onChange={(e) => update.mutate({ id: c.id, status: e.target.value as never })} className={`${selectCls} w-full`}>
                    {Object.entries(CASE_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Prioritet" htmlFor="case-priority">
                  <select id="case-priority" value={c.priority} disabled={!canWrite || update.isPending} onChange={(e) => update.mutate({ id: c.id, priority: e.target.value as never })} className={`${selectCls} w-full`}>
                    {Object.entries(CASE_PRIORITY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Ansvarlig" htmlFor="case-assignee">
                  <select id="case-assignee" value={c.assigneeId ?? ""} disabled={!canWrite || update.isPending} onChange={(e) => update.mutate({ id: c.id, assigneeId: e.target.value ? Number(e.target.value) : null })} className={`${selectCls} w-full`}>
                    <option value="">Ikke fordelt</option>
                    {c.staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
              </div>
              {c.bookingId && (
                <p className="text-sm text-muted-foreground">
                  Tilknyttet bestilling:{" "}
                  <Link to={`/admin/bestillinger/${c.bookingId}`} className="font-semibold text-primary hover:underline">#{c.bookingId}</Link>
                </p>
              )}

              <div className="space-y-3">
                <h3 className="font-display text-base font-bold text-night">Meldinger</h3>
                {c.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen meldinger ennå.</p>
                ) : (
                  <ol className="space-y-3" aria-label="Meldingstråd">
                    {c.messages.map((m) => {
                      const staff = m.authorType === "staff";
                      return (
                        <li
                          key={m.id}
                          className={cn(
                            "max-w-[92%] rounded-2xl px-4 py-3 text-sm",
                            m.isInternal ? "border border-dashed border-amber-300 bg-amber-50 text-amber-950" : staff ? "ml-auto bg-night text-white" : "bg-muted text-night",
                          )}
                        >
                          <p className={cn("mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide", m.isInternal ? "text-amber-800" : staff ? "text-white/70" : "text-muted-foreground")}>
                            {m.isInternal && <Lock className="h-3 w-3" aria-hidden="true" />}
                            {m.isInternal ? "Internt notat" : staff ? "Ansatt" : "Kunde"} · {m.name} · {formatDateTime(m.createdAt)}
                          </p>
                          <p className="whitespace-pre-wrap">{m.message}</p>
                        </li>
                      );
                    })}
                  </ol>
                )}
                <div ref={bottomRef} />
              </div>

              {canWrite && (
                <form
                  className="space-y-3 border-t border-border pt-4"
                  onSubmit={(e) => { e.preventDefault(); if (reply.trim()) send.mutate({ id: c.id, message: reply.trim(), internal }); }}
                >
                  <div className="flex gap-2" role="radiogroup" aria-label="Meldingstype">
                    {[
                      { v: false, l: "Svar til kunde (e-post)" },
                      { v: true, l: "Internt notat" },
                    ].map((o) => (
                      <button
                        key={String(o.v)}
                        type="button"
                        role="radio"
                        aria-checked={internal === o.v}
                        onClick={() => setInternal(o.v)}
                        className={cn("min-h-10 rounded-full px-3.5 text-xs font-bold transition-colors", internal === o.v ? "bg-night text-white" : "border border-border bg-white text-night")}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} className={inputCls} placeholder={internal ? "Notat kun synlig for ansatte …" : "Skriv svar til kunden …"} aria-label="Melding" />
                  <Btn type="submit" tone={internal ? "ghost" : "night"} disabled={!reply.trim() || send.isPending}>
                    <Send className="h-4 w-4" aria-hidden="true" /> {send.isPending ? "Sender …" : internal ? "Lagre notat" : "Send svar"}
                  </Btn>
                </form>
              )}
            </>
          )}
        </div>
        {fb.reauthDialog}
      </SheetContent>
    </Sheet>
  );
}

/* ── Opprett sak fra bestilling (brukes i AdminBookingDetail) ──────────── */

export function CreateCaseDialog({ bookingId, open, onClose, onCreated }: { bookingId: number; open: boolean; onClose: () => void; onCreated?: (id: number) => void }) {
  const utils = trpc.useUtils();
  const fb = useActionFeedback();
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("normal");
  const create = trpc.admin.createCaseFromBooking.useMutation({
    onSuccess: (r) => { utils.admin.casesList.invalidate(); utils.admin.bookingDetail.invalidate({ id: bookingId }); onCreated?.(r.id); onClose(); setSubject(""); },
    onError: fb.fail,
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ny kundeservicesak</DialogTitle>
          <DialogDescription>Saken knyttes til bestillingen og tildeles deg.</DialogDescription>
        </DialogHeader>
        {fb.banner}
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate({ bookingId, subject: subject.trim(), priority: priority as never }); }}>
          <Field label="Emne" htmlFor="cc-subject">
            <input id="cc-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} minLength={3} required />
          </Field>
          <Field label="Prioritet" htmlFor="cc-priority">
            <select id="cc-priority" value={priority} onChange={(e) => setPriority(e.target.value)} className={`${selectCls} w-full`}>
              {Object.entries(CASE_PRIORITY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <DialogFooter>
            <Btn tone="ghost" onClick={onClose}>Avbryt</Btn>
            <Btn type="submit" tone="night" disabled={subject.trim().length < 3 || create.isPending}>{create.isPending ? "Oppretter …" : "Opprett sak"}</Btn>
          </DialogFooter>
        </form>
        {fb.reauthDialog}
      </DialogContent>
    </Dialog>
  );
}

/* ── Liste ──────────────────────────────────────────────────────────────── */

export function AdminCases() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queue = (searchParams.get("queue") ?? "all") as Queue;
  const selected = searchParams.get("case") ? Number(searchParams.get("case")) : null;
  const [page, setPage] = useState(1);
  const perms = trpc.staffAuth.myPermissions.useQuery(undefined, { staleTime: 60_000, retry: false });
  const canWrite = perms.data?.permissions.includes("support:write") ?? false;
  const list = trpc.admin.casesList.useQuery({ queue, page, pageSize: 25 }, { retry: false, placeholderData: (p) => p });

  const setQueue = (q: Queue) => {
    setPage(1);
    setSearchParams(q === "all" ? {} : { queue: q });
  };
  const openCase = (id: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("case", String(id));
    setSearchParams(next);
  };
  const closeCase = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("case");
    setSearchParams(next);
  };

  return (
    <div>
      <PageHeader title="Kundeservice" description="Saker fra kontaktskjema og oppfølging av bestillinger." />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Sakskøer">
        {QUEUES.map((q) => (
          <button
            key={q.value}
            type="button"
            role="tab"
            aria-selected={queue === q.value}
            onClick={() => setQueue(q.value)}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm font-semibold transition-colors",
              queue === q.value ? "bg-night text-white" : "border border-border bg-white text-night hover:border-night/30",
            )}
          >
            {q.label}
          </button>
        ))}
      </div>
      {list.isLoading ? (
        <LoadingRows rows={5} />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Ingen saker i denne køen" hint="Nye henvendelser fra kunder dukker opp her." />
      ) : (
        <TableCard minWidth={760} caption="Kundeservicesaker">
          <thead>
            <tr className="border-b border-border">
              <th className={thCls}>Sak</th>
              <th className={thCls}>Emne</th>
              <th className={thCls}>Prioritet</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Ansvarlig</th>
              <th className={thCls}>Oppdatert</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.data.items.map((c) => (
              <ClickableRow key={c.id} onClick={() => openCase(c.id)} selected={selected === c.id}>
                <td className={`${tdCls} font-semibold text-night`}>{c.reference}</td>
                <td className={`${tdCls} max-w-[280px] truncate text-night`} title={c.subject}>{c.subject}</td>
                <td className={tdCls}><PriorityPill priority={c.priority} /></td>
                <td className={tdCls}><CaseStatusPill status={c.status} /></td>
                <td className={`${tdCls} text-muted-foreground`}>{c.assigneeName ?? "Ikke fordelt"}</td>
                <td className={`${tdCls} whitespace-nowrap text-muted-foreground`}>{formatDateTime(c.updatedAt)}</td>
              </ClickableRow>
            ))}
          </tbody>
        </TableCard>
      )}
      {list.data && <Pager page={page} total={list.data.total} pageSize={25} onPage={setPage} />}
      <CaseDetail id={selected} onClose={closeCase} canWrite={canWrite} />
    </div>
  );
}
