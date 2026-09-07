import type { ReactNode } from "react";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";

/** Felles ramme for innholdssider (vilkår, personvern, bagasje, visum, om oss). */
export default function ContentPage({
  eyebrow,
  title,
  intro,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  /** ISO-dato for «Sist oppdatert». */
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pb-20 outline-none sm:px-6">
        <div className="-mx-4 -mt-0 mb-10 border-b border-border bg-muted/40 px-4 pb-12 pt-32 sm:-mx-6 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <p className="font-mono-label text-[12px] text-primary">{eyebrow}</p>
            <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">{title}</h1>
            {intro && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{intro}</p>}
            {updated && (
              <p className="mt-3 text-[12px] text-muted-foreground">
                Sist oppdatert{" "}
                <time dateTime={updated}>
                  {new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", year: "numeric" }).format(new Date(updated))}
                </time>
              </p>
            )}
          </div>
        </div>
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function Section({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-b border-border py-7 first:pt-0 last:border-0">
      <h2 className="font-display text-xl tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

/** Markert plassholder for juridisk gjennomgang. */
export function LegalNote({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-warning/10 px-1 py-0.5 text-[13px] font-medium text-warning" data-legal-review>
      [JURIST: {children}]
    </span>
  );
}
