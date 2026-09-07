import { useState } from "react";
import { Plane } from "lucide-react";
import Icon from "./Icon";
import { imageSrcSet, type DealRoute, type DiscoverDestination } from "@/content/discover";
import { useRoutePrice } from "@/lib/useRoutePrice";

/**
 * DealCard — horizontally swipeable deal (reference grammar): big rounded
 * photo, route line, destination, starting price. The price is a live
 * «fra»-hint from the price API — never a fabricated discount or deadline.
 */
export default function DealCard({
  deal,
  onOpen,
}: {
  deal: DealRoute;
  onOpen?: (d: DiscoverDestination) => void;
}) {
  const d = deal.destination;
  const [imgFailed, setImgFailed] = useState(false);
  const price = useRoutePrice(deal.originIata, d.iata);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(d)}
      aria-label={`Se flyreiser ${deal.originCity} til ${d.city}`}
      className="hover-lift group block w-[272px] shrink-0 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-[300px]"
    >
      <div className="relative aspect-[16/11] overflow-hidden rounded-xl bg-muted">
        {d.image && !imgFailed ? (
          <img
            src={d.image}
            srcSet={imageSrcSet(d.image)}
            alt={d.imageAlt}
            loading="lazy"
            decoding="async"
            width={1024}
            height={704}
            sizes="(max-width: 640px) 272px, 300px"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-night text-white/70">
            <Icon icon={Plane} size={24} />
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2 px-1.5 pt-3">
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-semibold leading-tight">
            {deal.originCity} → {d.city}
          </h3>
          <p className="truncate text-[13px] text-muted-foreground">{d.country}</p>
        </div>
        {price ? (
          <span className="shrink-0 rounded-md bg-primary-soft px-2.5 py-1 text-[13px] font-semibold tabular text-accent-foreground">
            {price}
          </span>
        ) : null}
      </div>
    </button>
  );
}
