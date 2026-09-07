import { cn } from "@/lib/utils";

/**
 * Spot illustrations for empty and error states. 160×120 grid, 2px stroke,
 * ink + one lime accent. Small, specific to travel, never characters.
 */
type SpotProps = { className?: string; title?: string };

function Spot({ className, title, children }: SpotProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 160 120" className={cn("h-24 w-32 text-foreground", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role={title ? "img" : undefined} aria-hidden={title ? undefined : "true"} focusable="false">
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** Small aircraft on a dotted route that stops short of the destination. */
export function NoFlightsSpot(p: SpotProps) {
  return (
    <Spot {...p}>
      <circle cx="20" cy="80" r="4" fill="currentColor" />
      <path d="M28 80c20-30 50-40 80-36" strokeDasharray="4 6" />
      <circle cx="140" cy="46" r="5" stroke="hsl(var(--primary))" strokeWidth="3" fill="hsl(var(--card))" />
      <path d="M52 66h22l10-9h6l-3 9 3 2H57l-5-2Z" fill="hsl(var(--card))" />
      <path d="M62 66l-3-8h4l7 8M58 68l-2 5h5l4-5" />
      <path d="M118 62l14 14M132 62l-14 14" stroke="hsl(var(--warning))" />
    </Spot>
  );
}

/** Ticket with a clock: search or offer expired. */
export function SearchExpiredSpot(p: SpotProps) {
  return (
    <Spot {...p}>
      <path d="M30 40a4 4 0 0 1 4-4h58a4 4 0 0 1 4 4v10a5 5 0 0 0 0 10v10a4 4 0 0 1-4 4H34a4 4 0 0 1-4-4V60a5 5 0 0 0 0-10V40Z" fill="hsl(var(--card))" />
      <path d="M74 36v38" strokeDasharray="3 4" />
      <path d="M40 50h22M40 60h14" />
      <circle cx="118" cy="72" r="20" fill="hsl(var(--card))" />
      <path d="M118 60v13l8 5" stroke="hsl(var(--warning))" />
    </Spot>
  );
}

/** Card with a subtle warning: payment failed. */
export function PaymentFailedSpot(p: SpotProps) {
  return (
    <Spot {...p}>
      <rect x="28" y="38" width="90" height="56" rx="6" fill="hsl(var(--card))" />
      <path d="M28 52h90" />
      <path d="M40 76h24M72 76h12" />
      <circle cx="122" cy="88" r="16" fill="hsl(var(--card))" stroke="hsl(var(--destructive))" />
      <path d="M122 80v9M122 94v1" stroke="hsl(var(--destructive))" />
    </Spot>
  );
}

/** Aircraft with a broken tail line: booking failed at the supplier. */
export function BookingFailedSpot(p: SpotProps) {
  return (
    <Spot {...p}>
      <path d="M20 70c25-25 55-30 90-28" strokeDasharray="4 6" />
      <path d="M60 66h24l11-10h7l-3 10 3 2H65l-5-2Z" fill="hsl(var(--card))" />
      <path d="M70 66l-3-9h5l8 9M66 68l-2 6h5l5-6" />
      <path d="M118 42l16 16M134 42l-16 16" stroke="hsl(var(--destructive))" />
    </Spot>
  );
}

/** Two dots that do not connect: connection problem. */
export function ConnectionProblemSpot(p: SpotProps) {
  return (
    <Spot {...p}>
      <circle cx="30" cy="60" r="6" fill="currentColor" />
      <circle cx="130" cy="60" r="6" fill="hsl(var(--primary))" />
      <path d="M40 60h28M92 60h28" />
      <path d="M74 50l12 20M86 50l-12 20" stroke="hsl(var(--warning))" />
    </Spot>
  );
}

/** Heart outline on a destination card: nothing saved yet. */
export function NoSavedSpot(p: SpotProps) {
  return (
    <Spot {...p}>
      <rect x="40" y="26" width="80" height="68" rx="8" fill="hsl(var(--card))" />
      <path d="M40 70c14-10 26-14 40-8s28 2 40-8" />
      <path d="M80 58c-4-6-12-6-14 0-2 7 8 12 14 16 6-4 16-9 14-16-2-6-10-6-14 0Z" fill="hsl(var(--primary))" stroke="currentColor" />
    </Spot>
  );
}

/** Bed with a search glass: no hotel results. */
export function NoHotelsSpot(p: SpotProps) {
  return (
    <Spot {...p}>
      <path d="M30 86V52h100v34" />
      <path d="M30 70h100" />
      <path d="M40 52v-8a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v8" />
      <circle cx="118" cy="40" r="12" fill="hsl(var(--card))" />
      <path d="M127 49l10 10" />
    </Spot>
  );
}

/** Suitcase with a small tag: no trips yet. */
export function NoTripsSpot(p: SpotProps) {
  return (
    <Spot {...p}>
      <path d="M64 40v-8a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v8" />
      <rect x="46" y="40" width="68" height="52" rx="8" fill="hsl(var(--card))" />
      <path d="M46 58h68M46 74h68" />
      <path d="M112 44l10-6 8 12-10 6-8-12Z" fill="hsl(var(--primary))" stroke="currentColor" />
    </Spot>
  );
}

/** Bell outline: no notifications. */
export function NoNotificationsSpot(p: SpotProps) {
  return (
    <Spot {...p}>
      <path d="M56 78V58a24 24 0 0 1 48 0v20l8 10H48l8-10Z" fill="hsl(var(--card))" />
      <path d="M72 92a8 8 0 0 0 16 0" />
      <path d="M80 30v4" />
    </Spot>
  );
}

/** Empty table rows: admin empty tables. */
export function EmptyTableSpot(p: SpotProps) {
  return (
    <Spot {...p}>
      <rect x="30" y="34" width="100" height="56" rx="6" fill="hsl(var(--card))" />
      <path d="M30 50h100M30 66h100M60 34v56" />
      <path d="M40 42h12" stroke="hsl(var(--primary))" strokeWidth="3" />
    </Spot>
  );
}
