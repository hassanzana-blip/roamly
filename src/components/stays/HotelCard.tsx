import { useState } from "react";
import { Link } from "react-router";
import { ExternalLink, ImageOff, MapPin, Star } from "lucide-react";
import type { HotelSummary } from "@contracts/hotels";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { inclusionLabel } from "./hotelUtils";

/**
 * Hotellkort (HelloSky 2.0). Alt kommer fra leverandøren via KAYAK: bildet er
 * hotellets eget (`images[0]`), vurderingen er KAYAKs gjestevurdering og
 * prisen peker til leverandørens bestillingsside. Uten bilde fra leverandøren
 * viser vi en nøytral plassholder – aldri et tilfeldig foto.
 */

export function HotelPhoto({ hotel, className, sizes = "(min-width: 768px) 280px, 100vw" }: { hotel: Pick<HotelSummary, "images" | "name">; className?: string; sizes?: string }) {
  const [failed, setFailed] = useState(false);
  const img = hotel.images[0];
  if (!img || failed) {
    return (
      <div className={cn("grid place-items-center bg-secondary text-muted-foreground", className)} role="img" aria-label={hotel.name}>
        <span className="flex flex-col items-center gap-1.5 text-xs">
          <ImageOff className="size-5" aria-hidden="true" />
          Ingen bilde fra leverandøren
        </span>
      </div>
    );
  }
  return (
    <img
      src={img.large}
      srcSet={img.small ? `${img.small} 460w, ${img.large} 920w` : undefined}
      sizes={sizes}
      alt={hotel.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}

export function Stars({ n, className }: { n: number; className?: string }) {
  if (!n || n < 1) return null;
  return (
    <span role="img" className={cn("inline-flex items-center gap-px text-warning", className)} aria-label={`${n} stjerner`}>
      {Array.from({ length: Math.min(5, Math.round(n)) }).map((_, i) => (
        <Star key={i} className="size-3 fill-current" aria-hidden="true" />
      ))}
    </span>
  );
}

/** Vurderingen, hvem som har samlet den, og hvor mange den bygger på. */
export function RatingChip({ rating, reviews, sentiment, showSource }: { rating: number | null; reviews: number; sentiment?: string; showSource?: boolean }) {
  const t = useT();
  if (rating === null) return <span className="text-xs text-muted-foreground">{t("ht.norating")}</span>;
  const label = sentiment?.split(",")[0]?.trim();
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
      <span className="rounded-md bg-primary px-1.5 py-0.5 text-[12px] font-bold tabular-nums text-primary-foreground">{rating.toFixed(1).replace(".", ",")}</span>
      {label && <span className="font-medium text-foreground">{label}</span>}
      {reviews > 0 && <span>· {t("ht.reviews", { count: reviews })}</span>}
      {showSource && <span>· {t("ht.rating.source")}</span>}
    </span>
  );
}

export default function HotelCard({
  hotel,
  to,
  sandbox,
  stay,
}: {
  hotel: HotelSummary;
  to: string;
  sandbox?: boolean;
  /** Rom og gjester fra søket – prisen betyr lite uten dem. */
  stay?: { rooms: number; guests: number };
}) {
  const t = useT();
  const best = hotel.rates[0];
  const perks = new Set<string>();
  if (best?.freeCancellation) perks.add(t("ht.freecancel"));
  for (const c of best?.inclusions ?? []) {
    const l = inclusionLabel(c, t);
    if (l) perks.add(l);
  }
  if (best?.payLater) perks.add(t("ht.paylater"));
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-[border-color] duration-base hover:border-primary/50 md:flex">
      <Link to={to} className="block aspect-[16/10] w-full shrink-0 overflow-hidden bg-secondary md:aspect-auto md:w-[280px]">
        <HotelPhoto hotel={hotel} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-semibold leading-snug">
              <Link to={to} className="outline-none focus-visible:underline">{hotel.name}</Link>
            </h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{hotel.address}{hotel.distanceKm !== null ? ` · ${t("ht.distance", { km: hotel.distanceKm.toString().replace(".", ",") })}` : ""}</span>
            </p>
            <Stars n={hotel.starRating} className="mt-1" />
          </div>
        </div>
        <RatingChip rating={hotel.guestRating} reviews={hotel.numberOfReviews} sentiment={hotel.ratingSentiment} showSource />
        {perks.size > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {[...perks].map((p) => (
              <li key={p} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-foreground">{p}</li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {best ? (
              <>
                {/*
                  Totalen står størst. Et lite nattetall øverst og hele beløpet
                  gjemt i grå småtekst får hotellet til å se billigere ut enn
                  det er – det er nettopp det denne rekkefølgen hindrer.
                */}
                <p className="t-num text-2xl font-bold leading-none tracking-tight">{formatMoney(best.totalAmount, hotel.currency)}</p>
                <p className="mt-1 text-[13px] font-medium text-foreground">
                  {t("ht.stay.total")} · {t("ht.stay.nights", { count: hotel.nights })}
                  {stay ? ` · ${t("ht.stay.rooms", { count: stay.rooms })} · ${t("ht.stay.guests", { count: stay.guests })}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("ht.stay.pernight", { price: formatMoney(best.perNightAmount, hotel.currency) })} · {t("ht.stay.quotedby", { name: best.provider.name })}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("ht.stay.localfees")}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("ht.norates")}</p>
            )}
            {sandbox && <span className="mt-2 inline-block rounded-md bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">{t("sr.sandbox.badge")}</span>}
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            {best && (
              <Button asChild size="md" className="w-full rounded-full sm:w-auto">
                <a href={best.bookUrl} target="_blank" rel="noopener noreferrer nofollow sponsored">
                  {t("oc.view.at", { name: best.provider.name })} <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              </Button>
            )}
            {hotel.numberOfProviders > 1 && (
              <Link to={to} className="inline-flex min-h-10 items-center text-xs font-semibold text-accent-foreground underline-offset-4 hover:underline">
                {t("ht.compare", { count: hotel.numberOfProviders })}
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
