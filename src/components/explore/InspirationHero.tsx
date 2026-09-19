import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import Icon from "@/components/app/Icon";
import { FavoriteButton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { imageSrcSet } from "@/content/discover";
import { destinationHref, picksFor, TEMPOS, type TempoId } from "@/content/inspiration";
import { useSavedDestinations } from "@/lib/useAccount";
import { useT } from "@/lib/i18n";

/**
 * «Hva slags ferie trenger du?» (godkjent design, ref 4).
 *
 * Tempo først, sted etterpå. Hovedkortet og bikortet kommer fra registeret
 * for det valgte tempoet; hjertet lagrer reisemålet på kontoen (eller i
 * nettleseren for gjester), og lenkene går til de ekte reisemålssidene.
 */
export function InspirationHero({ tempo, onTempo }: { tempo: TempoId; onTempo: (t: TempoId) => void }) {
  const t = useT();
  const { ids: saved, toggle } = useSavedDestinations();
  const { primary, secondary } = picksFor(tempo);
  const label = (id: TempoId) => (id === "sea" ? t("insp.tempo.sea") : id === "city" ? t("insp.tempo.city") : t("insp.tempo.calm"));
  const secondaryTitle = TEMPOS.find((x) => x.id === tempo)?.secondaryTitle ?? "";

  return (
    <section aria-labelledby="insp-title">
      <p className="inline-flex min-h-8 items-center rounded-full bg-sunny px-3 text-[13px] font-bold uppercase tracking-[0.14em] text-sunny-ink">{t("insp.eyebrow")}</p>
      <h1 id="insp-title" className="t-h1 mt-3 max-w-[14ch] text-[40px] leading-[1.05] sm:text-[48px]">{t("insp.title")}</h1>
      <p className="t-lead mt-2 text-muted-foreground">{t("insp.sub")}</p>

      <Segmented
        aria-label={t("insp.tempo")}
        value={tempo}
        onValueChange={onTempo}
        className="mt-5 rounded-2xl bg-sky-soft p-1 sm:w-full lg:w-auto [&_[data-state=on]]:bg-petrol [&_[data-state=on]]:text-white [&_[data-state=on]]:shadow-none [&_button]:h-14 [&_button]:rounded-xl [&_button]:text-[19px] [&_button]:sm:h-12 [&_button]:sm:px-6"
        options={TEMPOS.map((x) => ({ value: x.id, label: label(x.id) }))}
      />

      {primary && (
        <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-10">
          <article>
            <div className="relative overflow-hidden rounded-2xl bg-muted">
              <Link to={destinationHref(primary.destination)} className="block">
                <img
                  key={primary.destination.id}
                  src={primary.destination.image}
                  srcSet={imageSrcSet(primary.destination.image!)}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 720px"
                  alt={primary.destination.imageAlt}
                  className="aspect-[4/3] w-full object-cover sm:aspect-[16/10]"
                  loading="eager"
                  decoding="async"
                />
              </Link>
              <FavoriteButton
                active={saved.has(primary.destination.id)}
                onToggle={() => toggle(primary.destination.id)}
                label={saved.has(primary.destination.id) ? t("insp.unsave", { city: primary.destination.city }) : t("insp.save", { city: primary.destination.city })}
                className="absolute right-4 top-4 size-14 [&_svg]:size-7"
              />
            </div>
            <p className="eyebrow mt-5 text-[14px] tracking-[0.18em]">{primary.destination.country}</p>
            <h2 className="mt-1 font-display text-[46px] font-bold leading-[1.02] tracking-tight sm:text-[54px]">{primary.destination.city}</h2>
            <p className="mt-2 text-[22px] leading-snug text-muted-foreground sm:text-[20px]">{primary.line}</p>
            <Link to={destinationHref(primary.destination)} className="mt-3 inline-flex min-h-11 items-center gap-2 text-[20px] font-semibold text-accent-foreground hover:underline sm:text-[18px]">
              {t("insp.explore")} <Icon icon={ArrowRight} size={24} />
            </Link>
          </article>

          {secondary && (
            <article className="mt-8 border-t border-border pt-8 lg:mt-0 lg:border-0 lg:pt-0">
              <Link to={destinationHref(secondary.destination)} className="press flex items-center gap-5 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring lg:flex-col lg:items-stretch">
                <img
                  key={secondary.destination.id}
                  src={secondary.destination.image}
                  srcSet={imageSrcSet(secondary.destination.image!)}
                  sizes="(max-width: 1024px) 40vw, 400px"
                  alt={secondary.destination.imageAlt}
                  className="aspect-square w-[38%] shrink-0 rounded-2xl object-cover lg:aspect-[4/3] lg:w-full"
                  loading="lazy"
                  decoding="async"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[24px] font-bold leading-tight sm:text-[22px]">{secondaryTitle}</span>
                  <span className="mt-1 block text-[20px] text-muted-foreground sm:text-[18px]">{secondary.destination.city}, {secondary.destination.country}</span>
                  <span className="mt-2 inline-flex items-center gap-2 text-[20px] font-semibold text-accent-foreground sm:text-[18px]">
                    {t("insp.see", { city: secondary.destination.city })} <Icon icon={ArrowRight} size={24} />
                  </span>
                </span>
              </Link>
            </article>
          )}
        </div>
      )}

      <div className="-mx-5 mt-8 bg-petrol-deep px-5 py-10 text-white sm:-mx-8 sm:px-8 lg:mx-0 lg:rounded-2xl lg:px-10">
        <div className="lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div>
            <h2 className="font-display text-[36px] font-bold leading-tight sm:text-[40px]">{t("insp.narrow.title")}</h2>
            <p className="mt-2 text-[20px] text-white/80 sm:text-[18px]">{t("insp.narrow.body")}</p>
          </div>
          <Button asChild size="xl" className="mt-6 w-full rounded-full lg:mt-0 lg:w-auto lg:min-w-64">
            <Link to="/quiz">{t("insp.narrow.cta")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
