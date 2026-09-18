import type { ReactNode } from "react";
import { AlertTriangle, Info, RefreshCw, SearchX } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Nøytral skjelettrad for hotell- og leiebilkort. */
export function StaySkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card md:flex" aria-hidden="true">
      <div className="shimmer aspect-[16/10] w-full md:aspect-auto md:h-auto md:w-[280px]" />
      <div className="flex-1 space-y-3 p-4 sm:p-5">
        <div className="shimmer h-5 w-2/3 rounded-md" />
        <div className="shimmer h-3.5 w-1/2 rounded-md" />
        <div className="flex gap-2">
          <div className="shimmer h-6 w-20 rounded-full" />
          <div className="shimmer h-6 w-24 rounded-full" />
        </div>
        <div className="flex items-end justify-between border-t border-border pt-3">
          <div className="shimmer h-7 w-24 rounded-md" />
          <div className="shimmer h-11 w-40 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function StateBlock({ kind, title, body, action }: { kind: "empty" | "error" | "disabled" | "info"; title: string; body: string; action?: ReactNode }) {
  const Icon = kind === "error" ? AlertTriangle : kind === "empty" ? SearchX : Info;
  return (
    <div role={kind === "error" ? "alert" : undefined} className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
      <span className={cn("mx-auto grid size-14 place-items-center rounded-full", kind === "error" ? "bg-destructive/10 text-destructive" : "bg-primary-soft text-accent-foreground")}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <Button variant="outline" onClick={onClick}>
      <RefreshCw aria-hidden="true" /> {t("common.retry")}
    </Button>
  );
}

export function DisclosureNote({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-secondary px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-px size-4 shrink-0" aria-hidden="true" />
      {text}
    </p>
  );
}

export function SandboxBadge() {
  const t = useT();
  return <span className="rounded-md bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">{t("sr.sandbox.badge")}</span>;
}

export function DisabledState({ title, body, cta, to }: { title: string; body: string; cta: string; to: string }) {
  return (
    <StateBlock
      kind="disabled"
      title={title}
      body={body}
      action={
        <Button asChild variant="outline">
          <Link to={to}>{cta}</Link>
        </Button>
      }
    />
  );
}

/** Segmentert sortering i HelloSky 2.0-stil (Anbefalt / Billigst / …). */
export function SortBar<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-full items-stretch gap-1 rounded-xl bg-muted p-1 sm:w-auto">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium outline-none transition-[background-color,color,box-shadow] duration-fast focus-visible:ring-2 focus-visible:ring-ring",
            "h-11 sm:h-9",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
