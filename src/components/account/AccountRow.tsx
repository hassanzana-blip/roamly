import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import Icon from "@/components/app/Icon";
import { cn } from "@/lib/utils";

/**
 * Kontomenyen er grupperte lister, ikke stabler av like kort: én flate per
 * gruppe, hårlinjer mellom radene, ingen ramme per rad.
 */
export function AccountGroup({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section className={cn("mt-7", className)}>
      {label ? <h2 className="mb-2 px-1 text-[13px] font-semibold text-muted-foreground">{label}</h2> : null}
      <ul className="surface divide-y divide-border overflow-hidden">{children}</ul>
    </section>
  );
}

/** Én rad i konto-menyen: ikon, tittel, undertekst, valgfritt tall/merke. */
export function AccountRow({ to, icon, title, sub, badge, className }: { to: string; icon: LucideIcon; title: string; sub?: string; badge?: ReactNode; className?: string }) {
  return (
    <li>
      <Link to={to} className={cn("flex min-h-[64px] items-center gap-3.5 bg-card px-4 transition-colors duration-fast hover:bg-muted/60 active:bg-muted", className)}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <Icon icon={icon} size={20} />
        </span>
        <span className="min-w-0 flex-1 py-3">
          <span className="block text-[15px] font-semibold leading-tight">{title}</span>
          {sub ? <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">{sub}</span> : null}
        </span>
        {badge ? <span className="shrink-0">{badge}</span> : null}
        <Icon icon={ChevronRight} size={20} className="shrink-0 text-muted-foreground/70" />
      </Link>
    </li>
  );
}

/** Rad med egen kontroll (bryter, nedtrekk) i stedet for lenke. */
export function ControlRow({ icon, title, sub, htmlFor, children }: { icon: LucideIcon; title: string; sub?: string; htmlFor?: string; children: ReactNode }) {
  const Title = htmlFor ? "label" : "span";
  return (
    <li className="flex min-h-[64px] items-center gap-3.5 bg-card px-4 py-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"><Icon icon={icon} size={20} /></span>
      <span className="min-w-0 flex-1">
        <Title htmlFor={htmlFor} className="block text-[15px] font-semibold leading-tight">{title}</Title>
        {sub ? <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{sub}</span> : null}
      </span>
      {children}
    </li>
  );
}

export function CountBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold tabular text-primary-foreground">{n}</span>;
}

/** Gruppeoverskrift — beholdt for sider som setter egne lister. */
export function GroupLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mb-2 mt-7 px-1 text-[13px] font-semibold text-muted-foreground", className)}>{children}</p>;
}

/** Rolig bryter (switch) — samme grammatikk som resten av profilen. */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-base disabled:opacity-60", checked ? "bg-primary" : "bg-input/70")}
    >
      <span className={cn("absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-base ease-out", checked ? "translate-x-5" : "translate-x-0")} />
    </button>
  );
}

/** Valgbrikke — én av flere, eller flere av flere. 44 px høy. */
export function Chip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3.5 text-[14px] font-semibold transition-[background-color,border-color,color,transform] duration-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.97] motion-reduce:active:scale-100",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:border-foreground/40",
        className,
      )}
    >
      {children}
    </button>
  );
}
