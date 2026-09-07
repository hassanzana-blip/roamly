/** Loading placeholders that match the final layout's shape. */
export function SkeletonFlightCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card" aria-hidden="true">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <div className="shimmer size-7 rounded-md" />
        <div className="shimmer h-4 w-28 rounded-md" />
      </div>
      <div className="space-y-5 px-5 py-5">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="shimmer h-7 w-14 rounded-md" />
            <div className="shimmer h-px flex-1" />
            <div className="shimmer h-7 w-14 rounded-md" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border px-5 py-4">
        <div className="shimmer h-8 w-28 rounded-md" />
        <div className="shimmer h-12 w-24 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonDestinationCard({ fluid = false }: { fluid?: boolean }) {
  return (
    <div className={fluid ? "w-full" : "w-[196px] shrink-0 sm:w-[228px]"} aria-hidden="true">
      <div className="shimmer aspect-[4/5] rounded-xl" />
      <div className="mt-3 space-y-2 px-1.5">
        <div className="shimmer h-4 w-2/3 rounded-md" />
        <div className="shimmer h-3 w-1/2 rounded-md" />
      </div>
    </div>
  );
}
