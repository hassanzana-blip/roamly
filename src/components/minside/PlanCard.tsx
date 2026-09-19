import type { ReactNode } from "react";
import { Link } from "react-router";
import { CalendarDays, ChevronRight } from "lucide-react";
import Icon from "@/components/app/Icon";
import { NoTripsSpot } from "@/components/graphics";
import { imageSrcSet } from "@/content/discover";
import { formatDayMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Reiseplan-kortet: ett foto, ett statusmerke, én tittel. Fotoet er alltid
 * reisemålets eget, kontrollerte bilde fra registeret. Tittelen ligger på en
 * mørk fot slik at hvit tekst leses på alle bilder, uten å tegne et
 * gjennomsiktig lag over hele fotoet.
 */
export function PlanPhotoCard({
  image,
  imageAlt,
  badge,
  badgeTone = "sunny",
  title,
  to,
  className,
  aspect = "aspect-[13/12] sm:aspect-[16/9]",
}: {
  image: string | null | undefined;
  imageAlt: string;
  badge: string;
  badgeTone?: "sunny" | "mint";
  title: string;
  to?: string;
  className?: string;
  aspect?: string;
}) {
  const body = (
    <>
      {image ? (
        <img src={image} srcSet={imageSrcSet(image)} sizes="(max-width: 640px) 100vw, 720px" alt={imageAlt} className="absolute inset-0 h-full w-full object-cover" loading="eager" decoding="async" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-mint"><NoTripsSpot /></div>
      )}
      <span className={cn("absolute left-4 top-4 inline-flex min-h-8 items-center rounded-full px-3 text-[14px] font-semibold", badgeTone === "sunny" ? "bg-sunny text-sunny-ink" : "bg-mint text-petrol")}>{badge}</span>
      <span className="absolute inset-x-0 bottom-0 bg-petrol-deep/70 px-4 pb-4 pt-6 text-white">
        <span className="block font-display text-[26px] font-bold leading-tight sm:text-[30px]">{title}</span>
      </span>
    </>
  );
  const cls = cn("relative block w-full overflow-hidden rounded-2xl bg-muted", aspect, className);
  return to ? (
    <Link to={to} className={cn(cls, "press focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Datolinjen under kortet: kalenderikon, tekst, og én handling til høyre. */
export function DatesRow({ dateFrom, dateTo, emptyLabel, action, actionLabel, onAction, className }: { dateFrom: string | null; dateTo: string | null; emptyLabel: string; action?: string; actionLabel: string; onAction?: () => void; className?: string }) {
  const text = dateFrom ? (dateTo && dateTo !== dateFrom ? `${formatDayMonth(dateFrom)} – ${formatDayMonth(dateTo)}` : formatDayMonth(dateFrom)) : emptyLabel;
  const right = (
    <span className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-[16px] font-semibold text-accent-foreground">
      {actionLabel} <Icon icon={ChevronRight} size={20} />
    </span>
  );
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1", className)}>
      <span className="flex min-w-0 items-center gap-3 text-[17px] text-foreground">
        <Icon icon={CalendarDays} size={24} className="shrink-0" />
        <span className="truncate">{text}</span>
      </span>
      {action ? <Link to={action} className="press rounded-lg focus-visible:outline-2 focus-visible:outline-ring">{right}</Link> : onAction ? <button type="button" onClick={onAction} className="press rounded-lg focus-visible:outline-2 focus-visible:outline-ring">{right}</button> : null}
    </div>
  );
}

/** Tonet informasjonskort: ikon til venstre, fet linje, forklaring, lenke. */
export function InfoCard({ icon, title, body, cta, to, onClick, tone = "sky", className, children }: { icon: ReactNode; title: string; body?: string; cta?: string; to?: string; onClick?: () => void; tone?: "sky" | "rose" | "mint"; className?: string; children?: ReactNode }) {
  const bg = tone === "rose" ? "bg-rose-soft" : tone === "mint" ? "bg-mint" : "bg-sky-soft";
  const link = cta ? (
    to ? (
      <Link to={to} className="mt-2 inline-flex min-h-10 items-center gap-2 text-[17px] font-semibold text-accent-foreground hover:underline">
        {cta} <span aria-hidden="true">→</span>
      </Link>
    ) : (
      <button type="button" onClick={onClick} className="mt-2 inline-flex min-h-10 items-center gap-2 text-[17px] font-semibold text-accent-foreground hover:underline">
        {cta} <span aria-hidden="true">→</span>
      </button>
    )
  ) : null;
  return (
    <div className={cn("flex items-start gap-4 rounded-2xl p-5", bg, className)}>
      <span className="mt-0.5 shrink-0 text-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[18px] font-bold leading-snug text-foreground">{title}</p>
        {body ? <p className="mt-0.5 text-[16px] leading-snug text-muted-foreground">{body}</p> : null}
        {link}
        {children}
      </div>
    </div>
  );
}
