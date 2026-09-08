import { Link } from "react-router";
import { FavoriteButton } from "@/components/app/primitives";
import { HsRoute } from "@/components/graphics";
import { imageSrcSet } from "@/content/discover";
import { cn } from "@/lib/utils";

/**
 * Ett stedskort for hele nettstedet (Reisemål, Utforsk, naboer på en
 * reisemålsside): 4:3-foto eller en stille ruteflate, så by, IATA-kode og
 * én linje. Samme anatomi som artikkelkortene i journalen.
 */
export type PlaceLike = {
  id?: string;
  city: string;
  country: string;
  iata: string;
  /** Én linje under byen: tagline eller notis. */
  caption?: string;
  image?: string;
  imageAlt?: string;
};

/** Stille typografisk flate for et sted uten verifisert foto: rutekoden og ruteglyfen, ingenting lånt. */
export function RouteTile({ iata, className }: { iata: string; className?: string }) {
  return (
    <span className={cn("flex h-full w-full flex-col justify-between bg-muted p-4 text-muted-foreground", className)} aria-hidden="true">
      <span className="t-code">OSL → {iata}</span>
      <HsRoute size={24} className="self-end" />
    </span>
  );
}

type Props = {
  place: PlaceLike;
  /** Lenkemål. Ignoreres når onOpen er satt (kortet blir en knapp). */
  to?: string;
  onOpen?: () => void;
  favourite?: boolean;
  onToggleFavourite?: () => void;
  sizes?: string;
  className?: string;
};

export default function PlaceCard({
  place: p,
  to,
  onOpen,
  favourite,
  onToggleFavourite,
  sizes = "(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 280px",
  className,
}: Props) {
  const label = `${p.city}, ${p.country}`;
  const body = (
    <>
      <span className="block aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
        {p.image ? (
          <img
            src={p.image}
            srcSet={imageSrcSet(p.image)}
            sizes={sizes}
            alt={p.imageAlt ?? label}
            loading="lazy"
            decoding="async"
            width={1024}
            height={640}
            className="h-full w-full object-cover"
          />
        ) : (
          <RouteTile iata={p.iata} />
        )}
      </span>
      <span className="block px-1 pt-3">
        <span className="flex items-baseline justify-between gap-3">
          <span className="t-h3 min-w-0 truncate">{p.city}</span>
          <span className="t-code shrink-0 text-muted-foreground">{p.iata}</span>
        </span>
        <span className="t-caption mt-0.5 block truncate">{p.caption ? `${p.country} · ${p.caption}` : p.country}</span>
      </span>
    </>
  );
  const cls = cn(
    "press img-zoom block w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    className,
  );
  return (
    <div className="relative">
      {onOpen ? (
        <button type="button" onClick={onOpen} className={cls} aria-label={`Se ${label}`}>
          {body}
        </button>
      ) : (
        <Link to={to ?? "/utforsk"} className={cls}>
          {body}
        </Link>
      )}
      {onToggleFavourite && (
        <FavoriteButton
          active={Boolean(favourite)}
          onToggle={onToggleFavourite}
          label={favourite ? `Fjern ${p.city} fra lagrede` : `Lagre ${p.city}`}
          className="absolute right-3 top-3"
        />
      )}
    </div>
  );
}
