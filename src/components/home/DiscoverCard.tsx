import { useState } from "react";
import { Link } from "react-router";
import { FavoriteButton } from "@/components/app/primitives";
import { imageSrcSet, searchHref, type DiscoverDestination, type ThemeId } from "@/content/discover";
import { useRoutePrice } from "@/lib/useRoutePrice";
import { useT, type I18nKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * A destination as a large photograph.
 *
 * `editorial` (phone home, HelloSky 4.0): one wide 2:1 photograph, a coral
 * theme chip, the heart, and «En helg i Lisboa» in the corner. `poster`: the
 * caption sits on the photo with the real «fra»-price. `tile` (desktop
 * discovery grid): a 4:3 photo with the caption underneath, and an azure ring
 * when it is the destination the map is pointing at.
 *
 * The price is only ever the live price hint for one adult, one way, from
 * Oslo. When there is none we say «Se flypriser» rather than inventing one.
 */
type Props = {
  destination: DiscoverDestination;
  variant?: "poster" | "tile" | "editorial";
  saved: boolean;
  onToggleSaved: (id: string) => void;
  selected?: boolean;
  onHover?: (id: string | null) => void;
  className?: string;
};

const THEME_LABEL: Record<ThemeId, I18nKey> = {
  sol: "home.theme.sol",
  storby: "home.theme.storby",
  familie: "home.theme.familie",
  mat: "home.theme.mat",
  natur: "home.theme.natur",
  langtur: "home.theme.langtur",
  hjem: "home.theme.hjem",
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
      className={cn("absolute right-3.5 top-3.5 h-12 w-12", variant === "editorial" && "right-4 top-4 h-14 w-14")}
    />
  );
  const img = photo ? (
    <img
      src={d.image}
      srcSet={imageSrcSet(d.image!)}
      sizes={variant === "tile" ? "(max-width: 1280px) 40vw, 360px" : "(max-width: 640px) 92vw, 720px"}
      alt={d.imageAlt}
      loading="lazy"
      decoding="async"
      width={1024}
      height={640}
      onError={() => setImgFailed(true)}
      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
    />
  ) : (
    <div className="flex h-full w-full items-end bg-petrol p-6 text-white/70">
      <span className="text-sm font-medium">OSL → {d.iata}</span>
    </div>
  );

  if (variant === "editorial") {
    const theme = d.themes[0];
    return (
      <div className={cn("group relative", className)}>
        <Link to={href} aria-label={t("home.dest.search", { city: d.city })} className="photo-tile block aspect-[2/1] text-white outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:aspect-[2.2/1]">
          {img}
          <span className="absolute inset-0 bg-gradient-to-t from-petrol/70 via-petrol/10 to-transparent" aria-hidden="true" />
          {theme && (
            <span className="absolute left-4 top-4 rounded-lg bg-coral-ink px-3 py-1.5 text-[13px] font-bold uppercase tracking-[0.08em] text-white">{t(THEME_LABEL[theme])}</span>
          )}
          <span className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <span className="block text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">{t("home.weekend.in", { city: d.city })}</span>
            {price && <span className="t-num mt-1 block text-[15px] font-medium text-white/90">{t("home.price.from", { price })} · {t("home.price.note")}</span>}
          </span>
        </Link>
        {heart}
      </div>
    );
  }

  if (variant === "tile") {
    return (
      <div className={cn("group relative", className)} onMouseEnter={() => onHover?.(d.id)} onMouseLeave={() => onHover?.(null)}>
        <Link to={href} aria-label={t("home.dest.search", { city: d.city })} className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <span className={cn("photo-tile block aspect-[4/3] transition-shadow duration-base", selected && "ring-[3px] ring-primary ring-offset-2 ring-offset-background")}>{img}</span>
          <span className="block px-1 pt-3">
            <span className="block text-[20px] font-bold leading-tight tracking-tight">{d.city}</span>
            <span className="t-num mt-0.5 block text-[16px] font-semibold leading-tight">{price ? capitalize(price) : t("home.price.check")}</span>
            <span className="mt-0.5 block text-[13px] text-muted-foreground">{price ? t("home.price.note") : `${d.country} · ${d.tagline}`}</span>
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
          <span className="block text-[30px] font-bold leading-none tracking-tight sm:text-[36px]">{d.city}</span>
          <span className="t-num mt-1.5 block text-[17px] font-semibold leading-tight">{price ? t("home.price.from", { price }) : t("home.price.check")}</span>
          <span className="mt-0.5 block text-[13px] text-white/85">{price ? t("home.price.note") : `${d.country} · ${d.tagline}`}</span>
        </span>
      </Link>
      {heart}
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
