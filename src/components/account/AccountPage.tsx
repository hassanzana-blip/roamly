import type { ReactNode } from "react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import { cn } from "@/lib/utils";

/**
 * Felles ramme for undersidene i Min HelloSky: én tittel (h1), én rolig
 * ingress og seksjoner med samme luft – 40 px på mobil, 48 px fra lg.
 * Ingen kort-i-kort: seksjonene ligger rett på siden, listene er én flate.
 */
export function AccountPage({
  title,
  intro,
  children,
  className,
  contentClassName,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className={cn("max-w-2xl", className)}>
        <AppHeader title={title} back as="h1" />
        {intro ? <p className="t-body -mt-1 mb-8 max-w-lg text-muted-foreground lg:mb-10">{intro}</p> : null}
        <div className={cn("space-y-10 lg:space-y-12", contentClassName)}>{children}</div>
      </AppShell>
    </div>
  );
}

/** Én seksjon: tittel i t-h3, valgfri undertekst, valgfri handling til høyre. */
export function AccountSection({
  title,
  sub,
  action,
  children,
  className,
  id,
}: {
  title?: string;
  sub?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      {title || action ? (
        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            {title ? <h2 className="t-h3">{title}</h2> : null}
            {sub ? <p className="t-caption mt-1">{sub}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
