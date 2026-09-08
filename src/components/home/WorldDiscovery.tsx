import { useState } from "react";
import { Link } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
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
  { id: "hjem", label: "theme.hjem", sub: "theme.hjem.sub" },
];

export default function WorldDiscovery() {
  const t = useT();
  const reduce = useReducedMotion();
  const [theme, setTheme] = useState<ThemeId>("sol");
  const active = THEMES.find((x) => x.id === theme)!;
  const picks = spreadAcrossRegions(DESTINATIONS.filter((d) => d.themes.includes(theme) && d.image), 6);

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

      <motion.ul
        key={theme}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
        className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3"
      >
        {picks.map((d, i) => {
          const air = airportByIata(d.iata);
          return (
            <li key={d.id} className={i === 0 ? "col-span-2 lg:col-span-1" : undefined}>
              <Link
                to={searchHref(d.iata)}
                className="press img-zoom group relative block overflow-hidden rounded-2xl bg-night text-white outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className={i === 0 ? "block aspect-[16/10] lg:aspect-[4/5]" : "block aspect-[4/5]"}>
                  {d.image && (
                    <img
                      src={d.image}
                      srcSet={imageSrcSet(d.image)}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 380px"
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
                <span className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
                  <span className="flex items-center gap-2 text-white/85">
                    <CountryFlag code={air?.countryCode} size={11} />
                    <span className="t-code">{d.iata}</span>
                  </span>
                  <span className="mt-1 block text-[18px] font-semibold leading-tight sm:text-[20px]">{d.city}</span>
                  <span className="mt-0.5 block text-[13px] text-white/75">{d.tagline}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </motion.ul>

      <Link to="/reisemal" className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline">
        {t("world.all")} <Icon icon={ArrowRight} size={16} />
      </Link>
    </section>
  );
}
