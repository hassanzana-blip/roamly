/**
 * RouteFallback — skjelett mens en lat rute lastes. Holder samme rytme som
 * sidene (topplinje + kort) så overgangen ikke «hopper». Admin-varianten
 * speiler sidebar + innholdsflate.
 */
export default function RouteFallback({ admin = false }: { admin?: boolean }) {
  if (admin) {
    return (
      <div className="min-h-screen bg-background" aria-busy="true" aria-label="Laster">
        <div className="hidden lg:block fixed inset-y-0 left-0 w-64 border-r border-border bg-card" />
        <div className="lg:pl-64">
          <div className="h-16 border-b border-border bg-white/90" />
          <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
            <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-8 sm:px-8" aria-busy="true" aria-label="Laster">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
      <div className="mt-8 h-44 animate-pulse rounded-[28px] bg-muted" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-[24px] bg-muted" />
        ))}
      </div>
    </div>
  );
}
