import { useState } from "react";
import { Briefcase, Car, ExternalLink, MapPin, Users } from "lucide-react";
import type { CarOffer } from "@contracts/cars";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";

function CarImage({ car }: { car: CarOffer }) {
  const [failed, setFailed] = useState(false);
  if (!car.imageUrl || failed) {
    return (
      <div className="grid h-full w-full place-items-center bg-secondary text-muted-foreground" role="img" aria-label={car.model}>
        <Car className="size-8" aria-hidden="true" />
      </div>
    );
  }
  return <img src={car.imageUrl} alt={`${car.model} – ${car.className}`} loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-contain p-3" />;
}

function AgencyLogo({ name, url }: { name: string; url?: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-foreground">{name}</span>;
  return <img src={url} alt={name} loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-6 w-auto max-w-[120px] object-contain" />;
}

/** Leiebilkort: bilde, klasse og fakta fra leverandøren, vilkår, pris per dag + totalt, ekstern CTA. */
export default function CarCard({ car, sandbox }: { car: CarOffer; sandbox?: boolean }) {
  const t = useT();
  const facts = [
    car.className,
    car.transmission ? (car.transmission === "automatic" ? t("cr.automatic") : t("cr.manual")) : null,
    car.seats ? t("cr.seats", { count: car.seats }) : null,
    car.bags ? t("cr.bags", { count: car.bags }) : null,
  ].filter(Boolean) as string[];
  const seller = car.provider.name && car.provider.name !== car.agency.name ? car.provider.name : car.agency.name;
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-[border-color] duration-base hover:border-primary/50 md:flex">
      <div className="aspect-[16/9] w-full shrink-0 bg-secondary md:aspect-auto md:w-[240px]">
        <CarImage car={car} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
        <div>
          <h3 className="text-[17px] font-semibold leading-snug">
            {car.model} {car.orSimilar && <span className="font-normal text-muted-foreground">{t("cr.orsimilar")}</span>}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {facts.map((f) => (
              <span key={f} className="inline-flex items-center gap-1">
                {f === facts[2] ? <Users className="size-3.5" aria-hidden="true" /> : f === facts[3] ? <Briefcase className="size-3.5" aria-hidden="true" /> : null}
                {f}
              </span>
            ))}
          </p>
        </div>
        {car.policies.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {car.policies.slice(0, 5).map((p) => (
              <li key={p} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-foreground">{p}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <AgencyLogo name={car.agency.name} url={car.agency.logoUrl} />
          {car.pickup.name && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" /> {car.pickup.name}
              {car.pickup.inTerminal ? " · i terminalen" : ""}
            </span>
          )}
        </div>
        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="t-num text-2xl font-bold leading-none tracking-tight">{formatMoney(car.perDayAmount, car.currency)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("cr.perday")} · {t("cr.total", { count: car.days, price: formatMoney(car.totalAmount, car.currency) })}
            </p>
            {sandbox && <span className="mt-2 inline-block rounded-md bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">{t("sr.sandbox.badge")}</span>}
          </div>
          <Button asChild size="md" className="w-full rounded-full sm:w-auto">
            <a href={car.bookUrl} target="_blank" rel="noopener noreferrer nofollow sponsored">
              {t("oc.view.at", { name: seller })} <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
}
