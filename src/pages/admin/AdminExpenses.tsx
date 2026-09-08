import { useMemo, useRef, useState } from "react";
import { Camera, Download, FileText, Lock, Plus, Receipt, Trash2, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/admin/Avatar";
import { humanMessage } from "@/lib/apiError";
import { formatMinor } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Utgifter ───────────────────────────────────────────────────────────────
//
// Bilagsføring for to personer som er på farten: ta bilde av kvitteringen,
// skriv beløpet, ferdig. Mva regnes ut av serveren, ikke av den som står i
// avgangshallen. Måneden låses når regnskapsføreren har fått eksporten.

const today = () => new Date().toISOString().slice(0, 10);
const thisPeriod = () => new Date().toISOString().slice(0, 7);

/** Måned som «september 2026», ikke «2026-09». */
function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/**
 * Kvitteringer fra et telefonkamera er 4–8 MB. Nedskalering i nettleseren gjør
 * dem til noen hundre kilobyte uten at teksten på kvitteringen blir uleselig –
 * og sparer både nettet og databasen for arbeid ingen har bruk for.
 */
async function shrinkImage(file: File, maxSide = 1600, quality = 0.82): Promise<{ data: string; mime: string }> {
  if (file.type === "application/pdf") {
    const buf = await file.arrayBuffer();
    return { data: btoa(String.fromCharCode(...new Uint8Array(buf))), mime: "application/pdf" };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", quality);
  return { data: url.slice(url.indexOf(",") + 1), mime: "image/jpeg" };
}

const field = "w-full min-h-11 rounded-xl border border-input bg-card px-3 text-base outline-none transition-colors focus:border-primary";

export default function AdminExpenses() {
  const [period, setPeriod] = useState(thisPeriod);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const options = trpc.expenses.options.useQuery();
  const list = trpc.expenses.list.useQuery({ period });
  const summary = trpc.expenses.summary.useQuery({ period });

  const refresh = () => {
    void utils.expenses.list.invalidate();
    void utils.expenses.summary.invalidate();
  };

  const remove = trpc.expenses.remove.useMutation({ onSuccess: refresh, onError: (e) => setError(humanMessage(e)) });
  const close = trpc.expenses.closePeriod.useMutation({ onSuccess: refresh, onError: (e) => setError(humanMessage(e)) });

  const categoryLabel = useMemo(() => {
    const map = new Map<string, string>((options.data?.categories ?? []).map((c) => [c.id as string, c.label as string]));
    return (id: string) => map.get(id) ?? id;
  }, [options.data]);

  const rows = list.data ?? [];
  const draftCount = rows.filter((r) => r.status === "draft").length;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-h1">Utgifter</h1>
          <p className="t-lead mt-1 text-muted-foreground">Kvittering, beløp, kategori. Mva regnes ut her.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="period">
            Måned
          </label>
          <input id="period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className={cn(field, "w-auto")} />
          <button
            type="button"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.99]"
          >
            <Plus className="size-4" aria-hidden="true" /> Nytt bilag
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {/* Månedens tall, øverst, fordi det er dem man kommer for. */}
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Brutto", value: summary.data?.grossMinor ?? 0 },
          { label: "Herav mva", value: summary.data?.vatMinor ?? 0 },
          { label: "Netto", value: summary.data?.netMinor ?? 0 },
        ].map((box) => (
          <div key={box.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="eyebrow">{box.label}</p>
            <p className="t-price mt-1">{formatMinor(box.value, "NOK")}</p>
          </div>
        ))}
      </section>

      {(summary.data?.byCategory.length ?? 0) > 0 && (
        <section className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 className="eyebrow">Fordeling i {periodLabel(period)}</h2>
          <ul className="mt-3 space-y-2.5">
            {summary.data!.byCategory.map((c) => {
              const share = summary.data!.grossMinor > 0 ? c.grossMinor / summary.data!.grossMinor : 0;
              return (
                <li key={c.category}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{categoryLabel(c.category)}</span>
                    <span className="t-num tabular-nums text-muted-foreground">
                      {formatMinor(c.grossMinor, "NOK")} · {Math.round(share * 100)} %
                    </span>
                  </div>
                  {/* Én stolpe per kategori: andelen er lettere å lese enn tallet alene. */}
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-night" style={{ width: `${Math.max(2, share * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          {summary.data!.byPerson.length > 1 && (
            <ul className="mt-4 flex flex-wrap gap-3 border-t border-border pt-3">
              {summary.data!.byPerson.map((p) => (
                <li key={p.name} className="flex items-center gap-2 text-sm">
                  <Avatar name={p.name} size={24} />
                  <span className="font-medium">{p.name}</span>
                  <span className="t-num tabular-nums text-muted-foreground">{formatMinor(p.grossMinor, "NOK")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <ExportButton period={period} onError={setError} />
        {draftCount > 0 && (
          <button
            type="button"
            onClick={() => close.mutate({ period })}
            disabled={close.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:border-foreground/40 disabled:opacity-50"
          >
            <Lock className="size-4" aria-hidden="true" />
            {close.isPending ? "Låser …" : `Lås ${periodLabel(period)} (${draftCount})`}
          </button>
        )}
      </div>

      <section className="mt-6">
        {list.isLoading ? (
          <p className="text-sm text-muted-foreground">Henter …</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Receipt className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-display text-xl">Ingen bilag i {periodLabel(period)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Ta bilde av kvitteringen mens du har den i hånden.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-3 sm:p-4">
                <ReceiptThumb id={r.id} has={r.hasReceipt} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.vendor}</p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {r.spentOn} · {categoryLabel(r.category)}
                    {r.vatRateBp != null && ` · ${r.vatRateBp / 100} % mva`}
                    {r.status !== "draft" && " · bokført"}
                  </p>
                </div>
                <Avatar name={r.staffName} size={24} />
                <div className="shrink-0 text-right">
                  <p className="t-num tabular-nums text-sm font-semibold">{formatMinor(r.grossMinor, r.currency)}</p>
                  {r.vatMinor > 0 && <p className="t-num text-[11px] tabular-nums text-muted-foreground">mva {formatMinor(r.vatMinor, r.currency)}</p>}
                </div>
                {r.status === "draft" && (
                  <button
                    type="button"
                    onClick={() => remove.mutate({ id: r.id })}
                    aria-label={`Slett bilaget fra ${r.vendor}`}
                    className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {open && <NewExpense onClose={() => setOpen(false)} onSaved={refresh} categories={options.data?.categories ?? []} vatRates={options.data?.vatRates ?? []} />}
    </div>
  );
}

function ExportButton({ period, onError }: { period: string; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const utils = trpc.useUtils();
  const [y, m] = period.split("-").map(Number);
  const from = `${period}-01`;
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await utils.expenses.exportCsv.fetch({ from, to });
          // Nedlasting uten server: filen finnes allerede i svaret.
          const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = res.filename;
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          onError(humanMessage(e));
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:border-foreground/40 disabled:opacity-50"
    >
      <Download className="size-4" aria-hidden="true" />
      {busy ? "Lager fil …" : "Eksport til regnskap"}
    </button>
  );
}

function ReceiptThumb({ id, has }: { id: number; has: boolean }) {
  const [open, setOpen] = useState(false);
  const receipt = trpc.expenses.receipt.useQuery({ id }, { enabled: open });
  if (!has) {
    return (
      <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-dashed border-border text-muted-foreground" title="Ingen kvittering">
        <FileText className="size-4" aria-hidden="true" />
      </span>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Vis kvitteringen" className="grid size-11 shrink-0 place-items-center rounded-lg border border-border text-foreground hover:border-foreground/40">
        <Receipt className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Kvittering">
          <button type="button" aria-label="Lukk" className="palette-scrim absolute inset-0 bg-night/60" onClick={() => setOpen(false)} />
          <div className="palette-panel relative max-h-[88vh] w-[min(40rem,94vw)] overflow-auto rounded-2xl bg-card p-3 shadow-2xl">
            {receipt.isLoading && <p className="p-8 text-center text-sm text-muted-foreground">Henter kvitteringen …</p>}
            {receipt.data?.mime === "application/pdf" ? (
              <object data={receipt.data.dataUrl} type="application/pdf" className="h-[70vh] w-full rounded-xl" aria-label={receipt.data.name}>
                <a href={receipt.data.dataUrl} download={receipt.data.name} className="underline">
                  Last ned {receipt.data.name}
                </a>
              </object>
            ) : (
              receipt.data && <img src={receipt.data.dataUrl} alt={receipt.data.name} className="w-full rounded-xl" />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function NewExpense({
  onClose,
  onSaved,
  categories,
  vatRates,
}: {
  onClose: () => void;
  onSaved: () => void;
  categories: readonly { id: string; label: string }[];
  vatRates: readonly { bp: number; label: string }[];
}) {
  const [spentOn, setSpentOn] = useState(today);
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("annet");
  const [vatRateBp, setVatRateBp] = useState<number | null>(2500);
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<{ data: string; mime: string; name: string; preview: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const grossMinor = Math.round(Number(amount.replace(",", ".")) * 100);
  const valid = vendor.trim().length > 0 && Number.isFinite(grossMinor) && grossMinor > 0;
  // Samme regnestykke som serveren, kun for å vise tallet mens man skriver.
  const vatPreview = vatRateBp ? grossMinor - Math.round((grossMinor * 10_000) / (10_000 + vatRateBp)) : 0;

  const create = trpc.expenses.create.useMutation({
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e) => setError(humanMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-[60] grid place-items-end sm:place-items-center" role="dialog" aria-modal="true" aria-label="Nytt bilag">
      <button type="button" aria-label="Lukk" className="palette-scrim absolute inset-0 bg-night/50" onClick={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            spentOn,
            vendor: vendor.trim(),
            category: category as "annet",
            grossMinor,
            currency: "NOK",
            vatRateBp,
            note: note.trim() || undefined,
            receipt: receipt ? { data: receipt.data, mime: receipt.mime as "image/jpeg", name: receipt.name } : undefined,
          });
        }}
        className="palette-panel relative max-h-[92vh] w-full overflow-auto rounded-t-3xl bg-card p-5 shadow-2xl sm:w-[min(32rem,94vw)] sm:rounded-3xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="t-h3">Nytt bilag</h2>
          <button type="button" onClick={onClose} aria-label="Lukk" className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Kvitteringen først: det er den man har i hånden. */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-4 flex w-full items-center gap-4 rounded-2xl border border-dashed border-border p-4 text-left hover:border-foreground/40"
        >
          {receipt ? (
            <img src={receipt.preview} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Camera className="size-6" aria-hidden="true" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{receipt ? receipt.name : "Ta bilde av kvitteringen"}</span>
            <span className="block text-[12px] text-muted-foreground">{receipt ? "Trykk for å bytte" : "Eller velg en fil – bildet krympes før det sendes"}</span>
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const { data, mime } = await shrinkImage(file);
              setReceipt({ data, mime, name: file.name.slice(0, 160), preview: `data:${mime};base64,${data}` });
              setError(null);
            } catch {
              setError("Kunne ikke lese filen. Prøv et bilde eller en PDF.");
            }
          }}
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Dato</span>
            <input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} required className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Beløp inkl. mva</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0,00" className={cn(field, "t-num tabular-nums")} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-semibold">Hvem betalte du?</span>
            <input value={vendor} onChange={(e) => setVendor(e.target.value)} required maxLength={120} placeholder="SAS, Rema 1000, Adobe …" className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Kategori</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Mva</span>
            <select value={vatRateBp ?? ""} onChange={(e) => setVatRateBp(e.target.value === "" ? null : Number(e.target.value))} className={field}>
              <option value="">Ingen mva</option>
              {vatRates.map((v) => (
                <option key={v.bp} value={v.bp}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-semibold">Notat</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Hva var det for?" className={field} />
          </label>
        </div>

        {valid && (
          <p className="mt-3 text-sm text-muted-foreground">
            Netto <span className="t-num tabular-nums font-semibold text-foreground">{formatMinor(grossMinor - vatPreview, "NOK")}</span>
            {vatPreview > 0 && (
              <>
                {" "}
                + mva <span className="t-num tabular-nums font-semibold text-foreground">{formatMinor(vatPreview, "NOK")}</span>
              </>
            )}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!valid || create.isPending}
          className="mt-5 w-full min-h-12 rounded-xl bg-primary font-bold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
        >
          {create.isPending ? "Lagrer …" : "Lagre bilaget"}
        </button>
      </form>
    </div>
  );
}
