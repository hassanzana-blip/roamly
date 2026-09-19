import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Icon from "@/components/app/Icon";
import CountryFlag from "@/components/brand/CountryFlag";
import { Chip } from "@/components/ui/chip";
import { DESTINATIONS, imageSrcSet, searchHref, spreadAcrossRegions, type ThemeId } from "@/content/discover";
import { airportByIata } from "@contracts/airports";
import { useT, type I18nKey } from "@/lib/i18n";

/**
 * Verden, etter tema.
 *
 * Elleve like kortseksjoner under hverandre er ikke oppdagelse, det er en
 * katalog. Her er det én seksjon: du velger en følelse, og utvalget bytter.
 * Utvalget spres bevisst over regioner, så «sol» ikke blir fem naboland og
 * forsiden ikke ser ut som om HelloSky bare flyr ett sted.
 *
 * Alt her er ekte reisemål vi faktisk flyr til, med ekte fotografi. Ingen
 * priser loves i denne seksjonen – prisen står i søket, der den er reell.
 */

const THEMES: { id: ThemeId; label: I18nKey; sub: I18nKey }[] = [
  { id: "sol", label: "theme.sol", sub: "theme.sol.sub" },
  { id: "storby", label: "theme.storby", sub: "theme.storby.sub" },
  { id: "familie", label: "theme.familie", sub: "theme.familie.sub" },
  { id: "mat", label: "theme.mat", sub: "theme.mat.sub" },
  { id: "natur", label: "theme.natur", sub: "theme.natur.sub" },
  { id: "langtur", label: "theme.langtur", sub: "theme.langtur.sub" },
];

export default function WorldDiscovery() {
  const t = useT();
  const [theme, setTheme] = useState<ThemeId>("sol");
  const active = THEMES.find((x) => x.id === theme)!;
  const picks = spreadAcrossRegions(DESTINATIONS.filter((d) => d.themes.includes(theme) && d.image), 3);

  return (
    <section aria-labelledby="world" className="container-x mt-20 sm:mt-28">
      <h2 id="world" className="t-h1 max-w-2xl">{t("world.title")}</h2>

      {/* Temaene er sidens ene kontroll. De ligger over utvalget, ikke inni et kort. */}
      <div className="no-scrollbar -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label={t("world.title")}>
        {THEMES.map((x) => (
          <Chip
            key={x.id}
            role="tab"
            aria-selected={theme === x.id}
            selected={theme === x.id}
            onClick={() => setTheme(x.id)}
            className="shrink-0"
          >
            {t(x.label)}
          </Chip>
        ))}
      </div>

      <p className="t-lead mt-5 max-w-xl text-muted-foreground">{t(active.sub)}</p>

      {/*
        Tre kort, ikke seks.

        Seks små kort leses som en katalog: øyet skanner dem og velger
        ingenting. Tre store leses som et utvalg noen har gjort. Kortet er
        stort nok til at fotografiet faktisk får si noe, og byen står i
        handlingslinjen slik at man vet hvor man havner før man trykker.

        `key` gjør at listen monteres på nytt når temaet skifter, så
        CSS-kryssfaden spiller av. Ren CSS: et animasjonsbibliotek er ikke
        verdt 136 kB på forsidens kritiske sti.
      */}
      <ul
        key={theme}
        className="theme-swap no-scrollbar -mx-5 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0"
      >
        {picks.map((d) => {
          const air = airportByIata(d.iata);
          return (
            <li key={d.id} className="w-[78vw] shrink-0 snap-start sm:w-auto">
              <Link
                to={searchHref(d.iata)}
                className="press img-zoom group relative block overflow-hidden rounded-2xl bg-night text-white outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="block aspect-[4/3] sm:aspect-[3/4] lg:aspect-[4/3]">
                  {d.image && (
                    <img
                      src={d.image}
                      srcSet={imageSrcSet(d.image)}
                      sizes="(max-width: 640px) 78vw, (max-width: 1024px) 33vw, 400px"
                      alt={d.imageAlt}
                      loading="lazy"
                      decoding="async"
                      width={1024}
                      height={640}
                      className="h-full w-full object-cover object-[center_58%]"
                    />
                  )}
                </span>
                <span className="photo-wash absolute inset-0" aria-hidden="true" />
                <span className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                  <span className="block font-display text-[22px] leading-tight sm:text-[24px]">{d.tagline}</span>
                  <span className="mt-1.5 flex items-center gap-2 text-[14px] font-semibold text-white/90">
                    <CountryFlag code={air?.countryCode} size={12} />
                    {d.city}
                    <Icon icon={ArrowRight} size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link to="/reisemal" className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline">
        {t("world.all")} <Icon icon={ArrowRight} size={16} />
      </Link>

      {/*
        Utveien for den som har bladd gjennom alle temaene og fortsatt ikke vet.
        Den står her, rett etter valgene, og ikke nederst på siden – det er her
        man gir opp, ikke der.
      */}
      <div className="mt-10 overflow-hidden rounded-2xl bg-primary-soft sm:flex sm:items-stretch">
        <div className="min-w-0 flex-1 p-6 sm:p-8">
          <p className="font-display text-[26px] leading-tight text-foreground sm:text-[30px]">{t("home.quizband.title")}</p>
          <p className="mt-1.5 text-[15px] text-foreground/75">{t("home.quizband.sub")}</p>
          <Link
            to="/quiz"
            className="press mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-night px-5 text-[15px] font-bold text-white transition-all hover:brightness-110"
          >
            {t("home.quizband.cta")} <Icon icon={ArrowUpRight} size={16} />
          </Link>
        </div>
        <div className="hidden w-[38%] shrink-0 sm:block">
          <img
            src="/destinations/lisboa-640.jpg"
            srcSet="/destinations/lisboa-640.jpg 640w, /destinations/lisboa.jpg 1024w"
            sizes="38vw"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            width={1024}
            height={640}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}
