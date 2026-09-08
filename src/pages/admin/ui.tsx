import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { LockKeyhole, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyTableSpot } from "@/components/graphics";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ATTEMPT_STATE_LABELS,
  ATTEMPT_TONES,
  BOOKING_STATE_LABELS,
  BTN_CLASSES,
  REFUND_STATE_LABELS,
  REFUND_TONES,
  STATE_TONES,
  TONE_CLASSES,
  errorMessage,
  formatDateTime,
  labelCls,
  type BtnTone,
  type PillTone,
  type TrpcErrorLike,
} from "./helpers";

/* Komponenter for admin. Hjelpere/etiketter ligger i ./helpers, feilhåndtering i ./useActionFeedback. */

/** Dialog som tilbys når en handling krever fersk sesjon. */
export function ReauthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const logout = trpc.staffAuth.logout.useMutation({
    onSettled: () => {
      utils.staffAuth.me.reset();
      navigate(`/admin/logg-inn?next=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true });
    },
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockKeyhole className="h-5 w-5 text-primary" aria-hidden="true" /> Krever nylig innlogging
          </DialogTitle>
          <DialogDescription>
            Denne handlingen er sensitiv og krever at du har logget inn i løpet av de siste 15 minuttene. Logg inn
            på nytt, så kommer du tilbake hit.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Btn tone="ghost" onClick={onClose}>Avbryt</Btn>
          <Btn tone="night" onClick={() => logout.mutate()} disabled={logout.isPending}>
            {logout.isPending ? "Logger ut …" : "Logg inn på nytt"}
          </Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Pill({ tone = "neutral", children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-semibold",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function BookingStatePill({ state }: { state: string }) {
  return <Pill tone={STATE_TONES[state] ?? "neutral"}>{BOOKING_STATE_LABELS[state] ?? state}</Pill>;
}

export function RefundStatePill({ state }: { state: string }) {
  return <Pill tone={REFUND_TONES[state] ?? "neutral"}>{REFUND_STATE_LABELS[state] ?? state}</Pill>;
}

export function AttemptStatePill({ state }: { state: string }) {
  return <Pill tone={ATTEMPT_TONES[state] ?? "neutral"}>{ATTEMPT_STATE_LABELS[state] ?? state}</Pill>;
}

/* ── Layout pieces ──────────────────────────────────────────────────────── */

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] text-foreground sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-border bg-card p-5 shadow-xs", className)}>{children}</div>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <EmptyTableSpot className="mx-auto mb-3 h-16 w-24" />
      <p className="font-semibold text-foreground">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, error, onRetry }: { message?: string; error?: TrpcErrorLike; onRetry?: () => void }) {
  const text = message ?? (error ? errorMessage(error, "Kunne ikke laste data. Prøv å laste siden på nytt.") : "Kunne ikke laste data. Prøv å laste siden på nytt.");
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center">
      <p className="font-semibold text-destructive">Noe gikk galt</p>
      <p className="mt-1 text-sm text-destructive">{text}</p>
      {error?.data?.appCode && <p className="mt-1 font-mono text-[11px] text-destructive">{error.data.appCode}</p>}
      {onRetry && (
        <Btn tone="ghost" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Prøv igjen
        </Btn>
      )}
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Laster" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

/** Tabell-ramme med horisontal scroll. `minWidth` holder kolonnene lesbare på mobil. */
export function TableCard({ children, minWidth = 720, caption }: { children: ReactNode; minWidth?: number; caption?: string }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </Card>
  );
}

/** Tastaturfokuserbar rad: Enter/Space aktiverer onClick. */
export function ClickableRow({ onClick, children, className, selected }: { onClick: () => void; children: ReactNode; className?: string; selected?: boolean }) {
  return (
    <tr
      tabIndex={0}
      role="button"
      aria-selected={selected}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "cursor-pointer transition-colors hover:bg-primary/[0.04] focus-visible:bg-primary/[0.06] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
        selected && "bg-primary/[0.06]",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground" aria-label="Paginering">
      <p>
        Side {page} av {totalPages} · {total} totalt
      </p>
      <div className="flex gap-2">
        <Btn tone="ghost" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}>
          Forrige
        </Btn>
        <Btn tone="ghost" onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
          Neste
        </Btn>
      </div>
    </nav>
  );
}

export function Btn({ tone = "primary", className, type = "button", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: BtnTone }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50",
        BTN_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelCls}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Nøkkel/verdi-liste for detaljpaneler. */
export function KV({ items }: { items: { k: string; v: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.k} className="min-w-0">
          <dt className="eyebrow">{it.k}</dt>
          <dd className="mt-0.5 break-words text-foreground">{it.v ?? "–"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Tidslinje (hendelser). */
export function Timeline({ items }: { items: { id: number | string; title: ReactNode; sub?: ReactNode; at: string | Date | null | undefined }[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Ingen hendelser registrert.</p>;
  return (
    <ol className="relative space-y-4 border-l-2 border-border pl-5">
      {items.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-primary" aria-hidden="true" />
          <p className="text-sm text-foreground">{e.title}</p>
          {e.sub && <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">{e.sub}</p>}
          <time className="mt-0.5 block text-xs text-muted-foreground">{formatDateTime(e.at)}</time>
        </li>
      ))}
    </ol>
  );
}

/** Kopier tekst til utklippstavlen med tilbakemelding. */
export function CopyButton({ text, label = "Kopier" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Btn
      tone="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* utklippstavle utilgjengelig */
        }
      }}
    >
      {done ? "Kopiert" : label}
    </Btn>
  );
}
