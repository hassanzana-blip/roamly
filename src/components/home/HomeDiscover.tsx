import { useMemo } from "react";
import { Link } from "react-router";
import { ArrowRight, Building2, ChevronRight, Sun } from "lucide-react";
import Icon from "@/components/app/Icon";
import { FavoriteButton } from "@/components/app/primitives";
import { imageSrcSet, type DiscoverDestination } from "@/content/discover";
import { airportByIata } from "@contracts/airports";
import { formatDateRangeShort } from "@/lib/format";
import { useSavedDestinations } from "@/lib/useAccount";
import { BUDGETS, ORIGINS, ORIGIN_LABEL, flightSearchHref, photographed, seasonKey, type Budget, type OriginIata, type Trip } from "@/lib/homeDiscover";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Forsidens oppdagelsesdel.
 *
 * Kortene her er innganger til ekte søk, ikke tilbud. Vi har ingen leverandør
 * som gir oss dagspriser uten et fullt søk per dato, så ingen av dem viser et
 * pristall: de viser hva vi faktisk kan gjøre – søke – og budsjettet den
 * reisende har valgt følger med inn i søket som et ekte pristak.
 *
 * Fargeflatene bærer mening. Sjøgrønn er «velg noe», aprikos og gult er
 * reisemål, lavendel er inspirasjon.
 */

/* ── Seksjon: budsjett ──────────────────────────────────────────────────── */

/** Sjøgrønn flate: velg ramme. Valget følger med i alle lenkene under. */
export function BudgetPanel({ budget, onChange, trip }: { budget: Budget; onChange: (b: Budget) => void; trip: Trip }) {
  const t = useT();
  const kr = (n: number) => t("hd.budget.under", { amount: n.toLocaleString("nb-NO") });
  return (
    <section aria-labelledby="hd-budget" className="rounded-2xl bg-sea p-5 text-forest sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="hd-budget" className="text-[22px] font-bold leading-tight sm:text-[24px]">
            {t("hd.budget.title")}
          </h2>
          <p className="mt-1 text-[15px] text-forest/75">{t("hd.budget.sub")}</p>
        </div>
      </div>
      {/* Valgene beholder sin egen bredde. Strekker vi dem, ser det valgte ut
          som en hovedknapp – og et filter er ikke en hovedhandling. */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t("hd.budget.title")}>
        {BUDGETS.map((value) => {
          const on = budget === value;
          return (
            <button
              key={String(value)}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(value)}
              className={cn(
                "inline-flex min-h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-4 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
                on ? "bg-forest text-white" : "bg-white text-forest hover:bg-white/80",
              )}
            >
              {value ? kr(value) : t("hd.budget.all")}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] leading-snug text-forest/75">
        {budget ? t("hd.budget.basis", { dates: formatDateRangeShort(trip.depart, trip.ret) }) : t("hd.budget.basis.none")}
      </p>
    </section>
  );
}

/* ── Reisemålskort ──────────────────────────────────────────────────────── */

/**
 * Ett reisemål: fotografiet øverst, en tonet fot med navnet og veien videre.
 * Ingen pris, fordi vi ikke har en å stå inne for før søket er gjort.
 */
export function DealCard({
  dest,
  href,
  tone,
  context,
  saved,
  onToggleSaved,
  cta,
}: {
  dest: DiscoverDestination;
  href: string;
  tone: "apricot" | "sunny";
  context: string;
  saved: boolean;
  onToggleSaved: () => void;
  cta: string;
}) {
  const t = useT();
  return (
    <article className={cn("flex flex-col overflow-hidden rounded-2xl", tone === "apricot" ? "bg-apricot" : "bg-sunny-warm")}>
      <div className="relative">
        <Link to={href} className="block aspect-[4/3] overflow-hidden bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <img
            src={dest.image}
            srcSet={imageSrcSet(dest.image!)}
            sizes="(max-width: 640px) 46vw, 300px"
            alt={dest.imageAlt}
            width={400}
            height={300}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </Link>
        <FavoriteButton
          active={saved}
          onToggle={onToggleSaved}
          label={saved ? t("insp.unsave", { city: dest.city }) : t("insp.save", { city: dest.city })}
          className="absolute right-2.5 top-2.5 size-10"
        />
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3 text-petrol">
        <h3 className="text-[19px] font-bold leading-tight">{dest.city}</h3>
        <Link
          to={href}
          className="mt-1 inline-flex min-h-10 w-fit items-center gap-1 text-[16px] font-semibold text-azure-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {cta} <Icon icon={ArrowRight} size={20} />
        </Link>
        <p className="mt-auto pt-1 text-[13px] leading-snug text-petrol/70">{context}</p>
      </div>
    </article>
  );
}

/* ── Seksjon: en helg et annet sted ─────────────────────────────────────── */

export function WeekendAway({ origin, trip, budget }: { origin: OriginIata; trip: Trip; budget: Budget }) {
  const t = useT();
  const { ids: saved, toggle } = useSavedDestinations();
  const picks = useMemo(() => photographed(["lisboa", "warszawa"]), []);
  const originCity = airportByIata(origin)?.city ?? origin;
  return (
    <section aria-labelledby="hd-weekend">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <h2 id="hd-weekend" className="t-h2 min-w-0 text-balance">
          {t("hd.weekend.title")}
        </h2>
        <Link to="/utforsk" className="inline-flex min-h-11 items-center gap-0.5 whitespace-nowrap text-[16px] font-semibold text-azure-ink underline-offset-4 hover:underline">
          {t("home.seeall")} <Icon icon={ChevronRight} size={20} />
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4">
        {picks.map((d, i) => (
          <DealCard
            key={d.id}
            dest={d}
            href={flightSearchHref(origin, d, trip, budget)}
            tone={i % 2 === 0 ? "apricot" : "sunny"}
            context={t("hd.card.context", { city: originCity, dates: formatDateRangeShort(trip.depart, trip.ret) })}
            saved={saved.has(d.id)}
            onToggleSaved={() => toggle(d.id)}
            cta={t("hd.card.cta")}
          />
        ))}
      </div>
    </section>
  );
}

/* ── Seksjon: sesongbanner ──────────────────────────────────────────────── */

export function SeasonBanner({ origin, trip, budget }: { origin: OriginIata; trip: Trip; budget: Budget }) {
  const t = useT();
  const season = seasonKey();
  const dest = photographed(["malaga"])[0];
  if (!dest) return null;
  const href = flightSearchHref(origin, dest, trip, budget);
  return (
    <section aria-labelledby="hd-season" className="overflow-hidden rounded-2xl bg-apricot">
      <div className="flex flex-wrap items-stretch">
        <div className="flex min-w-[58%] flex-1 flex-col justify-center gap-3 p-5 text-petrol sm:p-6">
          <div>
            <h2 id="hd-season" className="text-balance text-[26px] font-bold leading-tight sm:text-[30px]">
              {t(`hd.season.${season}.title` as const)}
            </h2>
            <p className="mt-1 text-[16px] text-petrol/75">{t(`hd.season.${season}.sub` as const)}</p>
          </div>
          <Link
            to={href}
            aria-label={t(`hd.season.${season}.sub` as const)}
            className="press grid size-12 place-items-center rounded-full bg-petrol text-white transition-colors hover:bg-petrol-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Icon icon={ArrowRight} size={24} />
          </Link>
        </div>
        <img
          src={dest.image}
          srcSet={imageSrcSet(dest.image!)}
          sizes="(max-width: 640px) 45vw, 380px"
          alt={dest.imageAlt}
          width={380}
          height={260}
          loading="lazy"
          decoding="async"
          className="h-auto min-h-[150px] w-full flex-1 basis-[38%] object-cover sm:min-w-[200px]"
        />
      </div>
    </section>
  );
}

/* ── Seksjon: reis fra din flyplass ─────────────────────────────────────── */

export function DeparturePanel({ origin, onChange }: { origin: OriginIata; onChange: (o: OriginIata) => void }) {
  const t = useT();
  return (
    <section aria-labelledby="hd-origin" className="rounded-2xl bg-sea p-5 text-forest sm:p-6">
      <h2 id="hd-origin" className="text-[22px] font-bold leading-tight sm:text-[24px]">
        {t("hd.origin.title")}
      </h2>
      <p className="mt-1 text-[15px] text-forest/75">{t("hd.origin.sub")}</p>
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto" role="group" aria-label={t("hd.origin.title")}>
        {ORIGINS.map((code) => {
          const on = origin === code;
          const a = airportByIata(code);
          return (
            <button
              key={code}
              type="button"
              aria-pressed={on}
              aria-label={`${ORIGIN_LABEL[code]} (${code})${a ? ` – ${a.name}` : ""}`}
              onClick={() => onChange(code)}
              className={cn(
                "inline-flex min-h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-5 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
                on ? "bg-forest text-white" : "bg-white text-forest hover:bg-white/80",
              )}
            >
              {ORIGIN_LABEL[code]}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] leading-snug text-forest/75">{t("hd.origin.scope")}</p>
    </section>
  );
}

/* ── Seksjon: reisemål innenfor rammen ──────────────────────────────────── */

export function BudgetOffers({ origin, trip, budget }: { origin: OriginIata; trip: Trip; budget: Budget }) {
  const t = useT();
  const originCity = airportByIata(origin)?.city ?? origin;
  const rows = useMemo(() => photographed(["warszawa", "london", "paris", "malaga"]), []);
  return (
    <section aria-labelledby="hd-offers">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <h2 id="hd-offers" className="t-h2 min-w-0 text-balance">
          {budget ? t("hd.offers.title", { amount: budget.toLocaleString("nb-NO") }) : t("hd.offers.title.all", { city: originCity })}
        </h2>
        <Link to="/utforsk" className="inline-flex min-h-11 items-center gap-0.5 whitespace-nowrap text-[16px] font-semibold text-azure-ink underline-offset-4 hover:underline">
          {t("hd.offers.more")} <Icon icon={ChevronRight} size={20} />
        </Link>
      </div>
      <p className="mt-1 text-[14px] text-muted-foreground">
        {t("hd.offers.context", { city: originCity, dates: formatDateRangeShort(trip.depart, trip.ret) })}
      </p>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-muted/60 p-4 text-[15px] text-muted-foreground">{t("hd.offers.empty")}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map((d) => (
            <li key={d.id}>
              <Link
                to={flightSearchHref(origin, d, trip, budget)}
                className="press flex items-center gap-3.5 overflow-hidden rounded-2xl border border-border bg-card pr-3.5 transition-colors hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <img
                  src={d.image}
                  srcSet={imageSrcSet(d.image!)}
                  sizes="112px"
                  alt=""
                  width={112}
                  height={80}
                  loading="lazy"
                  decoding="async"
                  className="h-[72px] w-[104px] shrink-0 object-cover sm:h-20 sm:w-28"
                />
                <span className="min-w-0 flex-1 py-2">
                  <span className="block truncate text-[17px] font-bold leading-tight">{d.city}</span>
                  <span className="mt-0.5 block text-[14px] text-muted-foreground">{t("hd.offers.roundtrip")}</span>
                </span>
                <span className="shrink-0 text-right text-[15px] font-semibold text-azure-ink">{t("hd.card.cta")}</span>
                <Icon icon={ChevronRight} size={20} className="shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[13px] leading-snug text-muted-foreground">{t("hd.offers.note")}</p>
    </section>
  );
}

/* ── Seksjon: hva slags pause ───────────────────────────────────────────── */

export function BreakStyles() {
  const t = useT();
  const tiles = [
    { key: "city", icon: Building2, tone: "bg-lav-soft", to: "/utforsk?tempo=city", label: t("hd.break.city") },
    { key: "sun", icon: Sun, tone: "bg-apricot", to: "/utforsk?tempo=sea", label: t("hd.break.sun") },
  ] as const;
  return (
    <section aria-labelledby="hd-break">
      <h2 id="hd-break" className="t-h2">
        {t("hd.break.title")}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4">
        {tiles.map((tile) => (
          <Link
            key={tile.key}
            to={tile.to}
            className={cn("press flex min-h-[150px] flex-col justify-between rounded-2xl p-5 text-petrol transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", tile.tone)}
          >
            <Icon icon={tile.icon} size={28} strokeWidth={1.5} />
            <span className="flex flex-wrap items-end justify-between gap-2">
              <span className="min-w-0 text-[18px] font-bold leading-tight">{tile.label}</span>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-petrol text-white">
                <Icon icon={ArrowRight} size={20} />
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
