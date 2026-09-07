import { useState } from "react";
import { imageSrcSet, type DiscoverDestination } from "@/content/discover";
import { FavoriteButton } from "@/components/app/primitives";

/** Branded route illustration — honest fallback when no verified photo exists. */
function RouteIllustration({ iata }: { iata: string }) {
  return (
    <div className="flex h-full w-full flex-col justify-between bg-night p-5">
      <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-white/60">
        OSL → {iata}
      </span>
      <svg viewBox="0 0 200 60" className="w-full text-white/50" aria-hidden="true">
        <path
          d="M6 48 C 62 8, 138 8, 194 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="route-dash"
        />
        <circle cx="6" cy="48" r="3.5" fill="currentColor" />
        <circle cx="194" cy="40" r="3.5" fill="hsl(var(--primary))" />
      </svg>
      <span className="text-xs text-white/60">Direkte søk hos HelloSky</span>
    </div>
  );
}

type Props = {
  destination: DiscoverDestination;
  isFavourite: boolean;
  onToggleFavourite: (id: string) => void;
  /** Tap opens the quick-view sheet (native app behaviour) */
  onOpen?: (d: DiscoverDestination) => void;
  /** Optional honest price line, e.g. "fra 1 890 kr" — only ever real API data */
  price?: string | null;
  /** Fill a grid cell instead of fixed strip width */
  fluid?: boolean;
};

/**
 * Image-led app card (reference grammar): large rounded photo with a
 * floating rating chip and favourite heart; the info surface sits BENEATH
 * the photo — destination name, geographic descriptor, price. Minimal copy.
 */
export default function DestinationCard({ destination: d, isFavourite, onToggleFavourite, onOpen, price, fluid }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = d.image !== undefined && !imgFailed;

  return (
    <div className={fluid ? "hover-lift group relative w-full" : "hover-lift group relative w-[196px] shrink-0 sm:w-[228px]"}>
      <button
        type="button"
        onClick={() => onOpen?.(d)}
        className="block w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Se ${d.city}, ${d.country}`}
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
          {showPhoto ? (
            <img
              src={d.image}
              srcSet={imageSrcSet(d.image!)}
              alt={d.imageAlt}
              loading="lazy"
              decoding="async"
              width={1024}
              height={1280}
              sizes="(max-width: 640px) 196px, 228px"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <RouteIllustration iata={d.iata} />
          )}

        </div>

        {/* Info surface beneath the photo */}
        <div className="px-1.5 pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-[16px] font-semibold leading-tight">{d.city}</h3>
            {price ? (
              <span className="shrink-0 text-[13px] font-semibold tabular">{price}</span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {d.country} · {d.tagline}
          </p>
        </div>
      </button>

      <FavoriteButton
        active={isFavourite}
        onToggle={() => onToggleFavourite(d.id)}
        label={isFavourite ? `Fjern ${d.city} fra lagrede` : `Lagre ${d.city}`}
        className="absolute right-3 top-3"
      />
    </div>
  );
}
