import { useState } from "react";
import { Banknote, Plus, Check, Trash2, CalendarClock } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Btn, Card, EmptyState, ErrorState, LoadingRows, PageHeader, Pill } from "./ui";
import { formatDateTime, formatMoney, inputCls, labelCls } from "./helpers";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Eier",
  ADMIN: "Administrator",
  SUPPORT: "Kundeservice",
  FINANCE: "Økonomi",
  READ_ONLY: "Kun lesing",
};

export function AdminPayroll() {
  const utils = trpc.useUtils();
  const me = trpc.staffAuth.me.useQuery(undefined, { retry: false });
  const data = trpc.team.payrollList.useQuery();
  const canManage = me.data?.role === "OWNER";

  const [open, setOpen] = useState(false);
  const [staffUserId, setStaffUserId] = useState<number | "">("");
  const [periodLabel, setPeriodLabel] = useState(() => {
    const d = new Date();
    return d.toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
  });
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [markPaid, setMarkPaid] = useState(true);

  const invalidate = () => utils.team.payrollList.invalidate();
  const add = trpc.team.payrollAdd.useMutation({
    onSuccess: () => { setOpen(false); setAmount(""); setNote(""); invalidate(); },
  });
  const pay = trpc.team.payrollMarkPaid.useMutation({ onSuccess: invalidate });
  const del = trpc.team.payrollDelete.useMutation({ onSuccess: invalidate });

  const totalsFor = (id: number) => data.data?.totals.find((t) => t.staffUserId === id);

  return (
    <div>
      <PageHeader
        title="Lønn"
        description="Registrer og følg lønnsutbetalinger til teamet."
        actions={
          canManage ? (
            <Btn onClick={() => setOpen((v) => !v)}>
              <Plus className="h-4 w-4" /> Registrer utbetaling
            </Btn>
          ) : undefined
        }
      />

      {/* Ansattkort med summer */}
      {data.isLoading && <LoadingRows rows={2} />}
      {data.isError && <ErrorState />}
      {data.data && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.data.staff.map((s) => {
            const t = totalsFor(s.id);
            return (
              <Card key={s.id} className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-night" />
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                    {s.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{s.name}</p>
                    <p className="eyebrow">
                      {ROLE_LABEL[s.role] ?? s.role}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                  <div>
                    <p className="eyebrow">Utbetalt</p>
                    <p className="mt-0.5 font-display text-xl font-semibold text-success">
                      {formatMoney(t?.paid ?? "0")}
                    </p>
                  </div>
                  <div>
                    <p className="eyebrow">Planlagt</p>
                    <p className="mt-0.5 font-display text-xl font-semibold text-warning">
                      {formatMoney(t?.planned ?? "0")}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Skjema */}
      {open && canManage && (
        <Card className="mb-8 border-primary/30">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-foreground">
            <Banknote className="h-5 w-5 text-primary" /> Ny lønnspost
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Ansatt</label>
              <select
                className={inputCls}
                value={staffUserId}
                onChange={(e) => setStaffUserId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Velg ansatt …</option>
                {data.data?.staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Periode</label>
              <input className={inputCls} value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="f.eks. september 2026" />
            </div>
            <div>
              <label className={labelCls}>Beløp (NOK)</label>
              <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="35000.00" />
            </div>
            <div>
              <label className={labelCls}>Notat (valgfritt)</label>
              <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="f.eks. inkl. bonus" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
              <input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} className="h-4 w-4 accent-primary" />
              Allerede utbetalt
            </label>
            <div className="ml-auto flex gap-2">
              <Btn tone="ghost" onClick={() => setOpen(false)}>Avbryt</Btn>
              <Btn
                onClick={() => staffUserId && add.mutate({
                  staffUserId: Number(staffUserId), periodLabel, amount, note: note || undefined, markPaid,
                })}
                disabled={!staffUserId || !/^\d+(\.\d{1,2})?$/.test(amount) || add.isPending}
              >
                Lagre
              </Btn>
            </div>
          </div>
          {add.isError && <p className="mt-3 text-sm font-medium text-destructive">{add.error.message}</p>}
        </Card>
      )}

      {/* Historikk */}
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <CalendarClock className="h-4 w-4" /> Historikk
      </h2>
      {data.data?.entries.length === 0 && (
        <EmptyState title="Ingen lønnsposter ennå" hint="Registrer første utbetaling med knappen over." />
      )}
      <div className="space-y-2">
        {data.data?.entries.map((e) => (
          <Card key={e.id} className="!p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                {e.staffName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">
                  {e.staffName} · {e.periodLabel}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Registrert av {e.registeredByName} · {formatDateTime(e.createdAt)}
                  {e.note ? ` · ${e.note}` : ""}
                </p>
              </div>
              <p className="font-display text-xl font-semibold text-foreground">{formatMoney(e.amount, e.currency)}</p>
              {e.status === "paid" ? (
                <Pill tone="success"><Check className="h-3 w-3" /> Utbetalt {e.paidAt ? formatDateTime(e.paidAt) : ""}</Pill>
              ) : (
                <Pill tone="warning">Planlagt</Pill>
              )}
              {canManage && (
                <span className="flex gap-1">
                  {e.status === "planned" && (
                    <Btn tone="success" className="!px-3 !py-2 text-xs" onClick={() => pay.mutate({ id: e.id })}>
                      Merk utbetalt
                    </Btn>
                  )}
                  {e.status === "planned" && (
                    <button
                      type="button"
                      aria-label="Slett"
                      onClick={() => del.mutate({ id: e.id })}
                      className="rounded-lg p-2 text-destructive hover:bg-destructive/5"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
