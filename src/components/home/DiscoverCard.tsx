import { useState } from "react";
import { Link } from "react-router";
import { FavoriteButton } from "@/components/app/primitives";
import { imageSrcSet, searchHref, type DiscoverDestination } from "@/content/discover";
import { useRoutePrice } from "@/lib/useRoutePrice";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * A destination as a large photograph.
 *
 * `poster` (phone home): the caption sits on the photo — city, the real
 * «fra»-price from the price search, and what the price means. `tile`
 * (desktop discovery grid): a 4:3 photo with the caption underneath, and a
 * coral ring when it is the destination the map is pointing at.
 *
 * The price is only ever the live price hint for one adult, one way, from
 * Oslo. When there is none we say «Se flypriser» rather than inventing one.
 */
type Props = {
  destination: DiscoverDestination;
  variant?: "poster" | "tile";
  saved: boolean;
  onToggleSaved: (id: string) => void;
  selected?: boolean;
  onHover?: (id: string | null) => void;
  className?: string;
};

export default function DiscoverCard({ destination: d, variant = "poster", saved, onToggleSaved, selected, onHover, className }: Props) {
  const t = useT();
  const price = useRoutePrice("OSL", d.iata);
  const [imgFailed, setImgFailed] = useState(false);
  const photo = d.image && !imgFailed;
  const href = searchHref(d.iata);
  const heart = (
    <FavoriteButton
      active={saved}
      onToggle={() => onToggleSaved(d.id)}
      label={saved ? t("sr.unsavedest", { city: d.city }) : t("sr.savedest", { city: d.city })}
      className="absolute right-3.5 top-3.5 h-11 w-11 sm:h-12 sm:w-12"
    />
  );
  const img = photo ? (
    <img
      src={d.image}
      srcSet={imageSrcSet(d.image!)}
      sizes={variant === "poster" ? "(max-width: 640px) 92vw, 600px" : "(max-width: 1280px) 40vw, 360px"}
      alt={d.imageAlt}
      loading="lazy"
      decoding="async"
      width={1024}
      height={640}
      onError={() => setImgFailed(true)}
      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
    />
  ) : (
    <div className="flex h-full w-full items-end bg-burgundy p-6 text-white/70">
      <span className="text-sm font-medium">OSL → {d.iata}</span>
    </div>
  );

  if (variant === "tile") {
    return (
      <div className={cn("group relative", className)} onMouseEnter={() => onHover?.(d.id)} onMouseLeave={() => onHover?.(null)}>
        <Link to={href} aria-label={t("home.dest.search", { city: d.city })} className="block rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <span className={cn("photo-tile block aspect-[4/3] rounded-[22px] transition-shadow duration-base", selected && "ring-[3px] ring-primary ring-offset-2 ring-offset-background")}>{img}</span>
          <span className="block px-1 pt-3">
            <span className="block text-[21px] font-medium leading-tight tracking-tight">{d.city}</span>
            <span className="t-num mt-0.5 block text-[17px] font-medium leading-tight">{price ? capitalize(price) : t("home.price.check")}</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">{price ? t("home.price.note") : `${d.country} · ${d.tagline}`}</span>
          </span>
        </Link>
        {heart}
      </div>
    );
  }

  return (
    <div className={cn("group relative", className)}>
      <Link to={href} aria-label={t("home.dest.search", { city: d.city })} className="photo-tile block aspect-[4/5] text-white outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:aspect-[4/3]">
        {img}
        <span className="photo-wash absolute inset-0" aria-hidden="true" />
        <span className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <span className="block text-[34px] font-medium leading-none tracking-tight sm:text-[40px]">{d.city}</span>
          <span className="t-num mt-1.5 block text-[18px] font-medium leading-tight sm:text-[20px]">{price ? t("home.price.from", { price }) : t("home.price.check")}</span>
          <span className="mt-0.5 block text-[12px] text-white/85 sm:text-[13px]">{price ? t("home.price.note") : `${d.country} · ${d.tagline}`}</span>
        </span>
      </Link>
      {heart}
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
