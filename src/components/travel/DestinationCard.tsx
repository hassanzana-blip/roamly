import { useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { ArrowUpRight, Heart } from "lucide-react";
import type { DiscoverDestination } from "@/content/discover";
import { searchHref } from "@/content/discover";

/** Branded route illustration — honest fallback when no verified photo exists. */
function RouteIllustration({ iata }: { iata: string }) {
  return (
    <div className="flex h-full w-full flex-col justify-between bg-night p-5">
      <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">
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
      <span className="text-xs text-white/60">Direkte søk hos Roamly</span>
    </div>
  );
}

type Props = {
  destination: DiscoverDestination;
  isFavourite: boolean;
  onToggleFavourite: (id: string) => void;
};

export default function DestinationCard({ destination: d, isFavourite, onToggleFavourite }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = d.image !== undefined && !imgFailed;

  return (
    <div className="group relative w-[248px] shrink-0 sm:w-[284px]">
      {/* Card navigation — a single, clean link target */}
      <Link
        to={searchHref(d.iata)}
        className="block rounded-2xl outline-none transition-transform duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Søk flyreiser til ${d.city}, ${d.country}`}
      >
        <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-secondary">
          {showPhoto ? (
            <img
              src={d.image}
              alt={d.imageAlt}
              loading="lazy"
              decoding="async"
              width={1200}
              height={800}
              sizes="(max-width: 640px) 248px, 284px"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <RouteIllustration iata={d.iata} />
          )}
          <span className="absolute left-3 top-3 rounded-lg bg-night/70 px-2 py-1 text-[11px] font-bold tracking-[0.14em] text-white backdrop-blur-sm">
            {d.iata}
          </span>
        </div>

        {/* Content height is intrinsic — long translated titles clamp instead of clipping */}
        <div className="px-1 pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="line-clamp-1 text-lg font-extrabold tracking-tight text-foreground">
              {d.city}
            </h3>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
            {d.country} · {d.tagline}
          </p>
          <p className="mt-1.5 text-sm font-semibold text-primary">Se flyreiser</p>
        </div>
      </Link>

      {/* Favourite control — deliberately NOT nested inside the card link.
          Motion: one library, brief press feedback only. */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.82 }}
        transition={{ type: "spring", stiffness: 500, damping: 26 }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavourite(d.id);
        }}
        aria-pressed={isFavourite}
        aria-label={
          isFavourite
            ? `Fjern ${d.city} fra favoritter`
            : `Lagre ${d.city} som favoritt`
        }
        className={`absolute right-2.5 top-2.5 grid h-11 w-11 place-items-center rounded-full backdrop-blur-md transition-colors duration-200 ${
          isFavourite
            ? "bg-primary text-white shadow-lg shadow-primary/30"
            : "bg-white/85 text-night hover:bg-white"
        }`}
      >
        <motion.span
          key={isFavourite ? "fav-on" : "fav-off"}
          initial={{ scale: 0.55 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 620, damping: 22 }}
          className="grid place-items-center"
        >
          <Heart
            className="h-[18px] w-[18px]"
            strokeWidth={2.2}
            fill={isFavourite ? "currentColor" : "none"}
          />
        </motion.span>
      </motion.button>
    </div>
  );
}
