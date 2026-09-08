import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, ArrowUpRight, FileText, Gift, Plus, TrendingDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Icon from "@/components/app/Icon";
import { Button } from "@/components/ui/button";
import CountryFlag from "@/components/brand/CountryFlag";
import { AdultGlyph, ChildGlyph, InfantGlyph, NoTripsSpot } from "@/components/graphics";
import { countKinds, travellerKind } from "@/components/account/family";
import { confirmationHref, receiptHref, type TripSummary } from "@/components/account/tripUtils";
import { airportByIata } from "@contracts/airports";
import type { Passport } from "@/components/account/passport";
import { destinationById, imageSrcSet, ALL_DESTINATIONS } from "@/content/discover";
import { formatDateShort } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { AccountHub } from "@/lib/useAccount";
import type { RouterOutputs } from "@/providers/trpc";

/**
 * Min HelloSky – reiseverdenen din, ikke en innstillingsside.
 *
 * Hver modul er et eget objekt med sin egen form: neste reise er en scene,
 * passet er data, familien er ansikter, rutene er en rad. Ingen modul viser
 * noe kontoen ikke faktisk har, og ingen modul finner på tall.
 */

type Traveller = RouterOutputs["extras"]["myTravelers"][number];

/* ── Felles seksjonshode ──────────────────────────────────────────────── */

export function ModuleHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="t-h3">{title}</h2>
        {sub ? <p className="t-caption mt-0.5">{sub}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

const QuietLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">
    {children} <Icon icon={ArrowRight} size={16} />
  </Link>
);

/** Dager til avreise, regnet fra midnatt i dag. Rene render. */
function daysUntil(iso: string, now: number): number {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((Date.parse(iso) - start.getTime()) / 86_400_000));
}

/* ── 1 · Neste reise: sidens scene ────────────────────────────────────── */

export function NextTripScene({ trip, now }: { trip: AccountHub["nextTrip"] | null; now: number }) {
  const t = useT();
  const reduce = useReducedMotion();

  if (!trip) {
    return (
      <section aria-labelledby="next-trip" className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
        <NoTripsSpot className="mx-auto" />
        <h2 id="next-trip" className="t-h2 mt-4">{t("acct.hub.nextempty")}</h2>
        <p className="t-body mx-auto mt-2 max-w-sm text-muted-foreground">{t("acct.hub.nextemptysub")}</p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/">{t("tr.search")} <Icon icon={ArrowRight} size={20} /></Link>
        </Button>
      </section>
    );
  }

  const days = daysUntil(trip.departingAt, now);
  const dest = airportByIata(trip.destinationIata);
  // Fotoet er byens eget når vi har det verifisert i katalogen; ellers ren flate.
  const photo = ALL_DESTINATIONS.find((d) => d.iata === trip.destinationIata);
  const depart = new Date(trip.departingAt);
  const time = Number.isNaN(depart.getTime()) ? null : depart.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });

  return (
    <section
      aria-labelledby="next-trip"
      className="relative isolate flex min-h-[360px] flex-col justify-between overflow-hidden rounded-2xl bg-night text-white sm:min-h-[420px]"
    >
      {photo?.image && (
        <>
          {/* Byen skal faktisk være synlig: fotoet i full styrke, teksten
              beskyttet av en bunntung skygge i stedet for et teppe over alt. */}
          <img
            src={photo.image}
            srcSet={imageSrcSet(photo.image)}
            sizes="(max-width: 1024px) 100vw, 720px"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            width={1024}
            height={640}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Skyggen samler seg i nederste halvdel: himmelen blir stående ren,
              og teksten står på en flate mørk nok til å leses uansett foto. */}
          <span
            className="absolute inset-0"
            aria-hidden="true"
            style={{
              backgroundImage:
                "linear-gradient(to top, hsl(var(--night)) 0%, hsl(var(--night) / 0.96) 30%, hsl(var(--night) / 0.78) 50%, hsl(var(--night) / 0.3) 72%, transparent 92%)",
            }}
          />
        </>
      )}

      {/* Nedtellingen er sidens ene tall som betyr noe. Full lime-flate, så
          kontrasten er den samme uansett hvilket foto som ligger bak. */}
      <motion.p
        initial={reduce ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
        className="relative m-4 self-start rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-bold text-primary-foreground sm:m-5"
      >
        {days === 0 ? t("acct.hub.today") : t("acct.hub.daysto", { count: days })}
      </motion.p>

      <div className="relative p-5 sm:p-7">
        <p className="font-mono-label text-[10px] uppercase tracking-[0.18em] text-white/85">{t("acct.hub.nexttrip")}</p>
        <h2 id="next-trip" className="t-h1 mt-1.5 text-white">
          {dest?.city ?? trip.destinationIata}
        </h2>

        {/* Detaljene leses som et boardingkort: rute, dato, klokkeslett. */}
        <dl className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[14px] text-white/85">
          <div className="flex items-baseline gap-2">
            <dt className="sr-only">{t("acct.hub.nexttrip")}</dt>
            <dd className="t-code text-white">{trip.originIata} → {trip.destinationIata}</dd>
          </div>
          <div>
            <dt className="sr-only">{t("tr.depart")}</dt>
            <dd className="t-num">{formatDateShort(trip.departingAt)}{time ? ` · ${time}` : ""}</dd>
          </div>
          {dest?.countryCode && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">{t("acct.passport.countries")}</dt>
              <dd className="flex items-center gap-2"><CountryFlag code={dest.countryCode} size={13} /> {dest.country}</dd>
            </div>
          )}
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="md" className="bg-white text-night hover:bg-white/90">
            <Link to={confirmationHref(trip.orderId)}>{t("acct.trip.open")}</Link>
          </Button>
          <Button asChild variant="outline" size="md" className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:border-white/60 hover:bg-white/20">
            <Link to={receiptHref(trip.orderId)}><Icon icon={FileText} size={20} /> {t("acct.docs.receipt")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ── 2 · Reisepasset: land du har vært i, regnet fra ekte bestillinger ── */

export function TravelPassport({ passport }: { passport: Passport }) {
  const t = useT();
  const { countries, flown } = passport;
  if (flown === 0) return null;

  return (
    <section aria-labelledby="passport">
      <ModuleHead title={t("acct.passport")} sub={t("acct.passport.sub")} />
      {/* Landene er innholdet – tallene er bare bildeteksten under dem. */}
      <ul className="flex flex-wrap gap-2.5" aria-label={t("acct.passport.countries")}>
        {countries.map(([code, name]) => (
          <li key={code} className="flex items-center gap-2.5 rounded-xl bg-muted/70 py-2.5 pl-3 pr-4">
            <CountryFlag code={code} size={20} className="rounded-[3px]" />
            <span className="text-[14px] font-semibold">{name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── 3 · Familien: ansikter, ikke en rad ──────────────────────────────── */

const KIND_GLYPH = { adult: AdultGlyph, child: ChildGlyph, infant: InfantGlyph } as const;

export function FamilyScene({ travellers, loading }: { travellers: Traveller[]; loading: boolean }) {
  const t = useT();
  if (loading) return <div className="shimmer h-32 rounded-2xl" aria-hidden="true" />;

  const n = countKinds(travellers);
  const summary = [
    n.adult ? t("pax.adults", { count: n.adult }) : null,
    n.child ? t("pax.children", { count: n.child }) : null,
    n.infant ? t("pax.infants", { count: n.infant }) : null,
  ].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby="family">
      <ModuleHead
        title={t("acct.family")}
        sub={summary || t("acct.familysub")}
        action={travellers.length > 0 ? <QuietLink to="/profil/reisende">{t("acct.family.manage")}</QuietLink> : undefined}
      />
      {travellers.length === 0 ? (
        <Link to="/profil/reisende" className="press flex items-center gap-4 rounded-2xl border border-dashed border-border p-5 transition-colors hover:border-foreground/40">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-muted"><Icon icon={Plus} size={20} /></span>
          <span className="min-w-0">
            <span className="t-h3 block">{t("acct.family.add")}</span>
            <span className="t-caption mt-0.5 block">{t("acct.family.addsub")}</span>
          </span>
        </Link>
      ) : (
        <ul className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
          {travellers.slice(0, 8).map((p) => {
            const kind = travellerKind(p.bornOn) ?? "adult";
            const Glyph = KIND_GLYPH[kind];
            return (
              <li key={p.id} className="w-[104px] shrink-0 text-center sm:w-[112px]">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-muted text-foreground">
                  <Glyph size={30} />
                </span>
                <span className="mt-2.5 block truncate text-[14px] font-semibold">{p.firstName}</span>
                <span className="t-caption block">{t(`acct.kind.${kind}` as "acct.kind.adult")}</span>
              </li>
            );
          })}
          <li className="w-[104px] shrink-0 text-center sm:w-[112px]">
            <Link to="/profil/reisende" className="press block">
              <span className="mx-auto grid size-16 place-items-center rounded-full border border-dashed border-border text-muted-foreground">
                <Icon icon={Plus} size={24} />
              </span>
              <span className="mt-2.5 block text-[14px] font-semibold">{t("acct.family.addshort")}</span>
            </Link>
          </li>
        </ul>
      )}
    </section>
  );
}

/* ── 4 · Rutene dine: en rad med flagg og foto ───────────────────────── */

export function RoutesScene({ routes, departDate }: { routes: AccountHub["routes"]; departDate: string }) {
  const t = useT();
  if (routes.length === 0) return null;
  return (
    <section aria-labelledby="routes">
      <ModuleHead title={t("acct.routes.fav")} sub={t("acct.hub.routessub")} />
      <ul className="no-scrollbar snap-row -mx-5 flex gap-3 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        {routes.map((r) => {
          const dest = airportByIata(r.destinationIata);
          const photo = ALL_DESTINATIONS.find((d) => d.iata === r.destinationIata);
          return (
            <li key={`${r.originIata}-${r.destinationIata}`} className="w-[220px] shrink-0">
              <Link
                to={`/sok?from=${r.originIata}&to=${r.destinationIata}&depart=${departDate}&adults=1&children=0&infants=0&cabin=economy`}
                className="press img-zoom group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-night text-white outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {photo?.image && (
                  <img src={photo.image} srcSet={imageSrcSet(photo.image)} sizes="220px" alt="" aria-hidden="true" loading="lazy" decoding="async" width={1024} height={640} className="absolute inset-0 h-full w-full object-cover object-[center_62%]" />
                )}
                <span
                  className="absolute inset-0"
                  aria-hidden="true"
                  style={{ backgroundImage: "linear-gradient(to top, hsl(var(--night)) 4%, hsl(var(--night) / 0.6) 34%, transparent 66%)" }}
                />
                <span className="absolute inset-x-0 bottom-0 p-3.5">
                  <span className="flex items-center gap-2">
                    <CountryFlag code={dest?.countryCode} size={13} />
                    <span className="t-code text-white/85">{r.originIata} → {r.destinationIata}</span>
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[17px] font-semibold">{r.destinationCity}</span>
                    <Icon icon={ArrowUpRight} size={16} className="shrink-0 text-white/70 transition-transform duration-fast group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── 5 · Prisovervåking: hva vi faktisk følger med på ─────────────────── */

export function WatchesScene({ watches }: { watches: AccountHub["watches"] }) {
  const t = useT();
  if (watches.length === 0) return null;
  return (
    <section aria-labelledby="watches">
      <ModuleHead
        title={t("acct.hub.watch")}
        sub={t("acct.watchessub")}
        action={<QuietLink to="/profil/prisovervaking">{t("acct.viewall")}</QuietLink>}
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {watches.slice(0, 4).map((w) => {
          const res = w.lastResult as { priceMinor?: number; currency?: string; live?: boolean } | null;
          const dest = airportByIata(w.destinationIata);
          return (
            <li key={w.id}>
              <Link to="/profil/prisovervaking" className="surface press flex items-center gap-3.5 p-4 transition-colors hover:border-foreground/40">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted"><Icon icon={TrendingDown} size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <CountryFlag code={dest?.countryCode} size={12} />
                    <span className="t-code">{w.originIata} → {w.destinationIata}</span>
                  </span>
                  <span className="mt-1 block truncate text-[15px] font-semibold">{w.destinationCity}</span>
                  <span className="t-caption block">
                    {res?.live && res.priceMinor ? t("acct.hub.watchfound", { price: `${Math.round(res.priceMinor / 100)} kr` }) : t("acct.hub.watchchecking")}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── 6 · Bonus: nivå og reell framgang ───────────────────────────────── */

export function RewardsScene({ rewards, bonusKr }: { rewards: AccountHub["rewards"]; bonusKr: number }) {
  const t = useT();
  const { tier, completedTrips, tripsToNext, nextTier } = rewards;
  // Framgangen er ekte: gjennomførte reiser mot terskelen for neste nivå.
  const total = completedTrips + (tripsToNext ?? 0);
  const pct = nextTier && total > 0 ? Math.min(100, Math.round((completedTrips / total) * 100)) : 100;
  return (
    <section aria-labelledby="rewards">
      <ModuleHead title={rewards.programName} action={<QuietLink to="/profil/bonus">{t("acct.viewall")}</QuietLink>} />
      <div className="rounded-2xl bg-primary-soft p-5 text-accent-foreground">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="t-num text-[30px] font-bold leading-none tracking-tight text-foreground">{bonusKr} kr</p>
            <p className="t-caption mt-1.5 text-accent-foreground">{t("acct.rewards.balance")}</p>
          </div>
          <p className="text-[15px] font-semibold text-foreground">{tier.name}</p>
        </div>
        {nextTier && (
          <div className="mt-5">
            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-foreground transition-[width] duration-slow ease-out" style={{ width: `${pct}%` }} />
            </div>
            <p className="t-caption mt-2 text-accent-foreground">
              {t("acct.rewards.tonext", { count: tripsToNext ?? 0, tier: nextTier.name })}
            </p>
          </div>
        )}
        <Link to="/profil/inviter" className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-foreground underline-offset-4 hover:underline">
          <Icon icon={Gift} size={20} /> {t("acct.invite")}
        </Link>
      </div>
    </section>
  );
}

/* ── 7 · Reisehistorikk: tidslinje av ekte, gjennomførte reiser ───────── */

export function HistoryTimeline({ trips, now }: { trips: TripSummary[]; now: number }) {
  const t = useT();
  const byYear = useMemo(() => {
    const past = trips
      .filter((x) => !x.cancelledAt && x.departingAt && Date.parse(x.departingAt) <= now)
      .sort((a, b) => (b.departingAt ?? "").localeCompare(a.departingAt ?? ""));
    const map = new Map<string, TripSummary[]>();
    for (const trip of past) {
      const y = (trip.departingAt ?? "").slice(0, 4);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(trip);
    }
    return [...map.entries()];
  }, [trips, now]);

  if (byYear.length === 0) return null;

  return (
    <section aria-labelledby="history">
      <ModuleHead title={t("acct.history")} sub={t("acct.history.sub")} action={<QuietLink to="/reiser">{t("acct.viewall")}</QuietLink>} />
      <div className="space-y-7">
        {byYear.slice(0, 3).map(([year, rows]) => (
          <div key={year}>
            <p className="t-num mb-2 text-[13px] font-semibold text-muted-foreground">{year}</p>
            <ul className="divide-y divide-border border-y border-border">
              {rows.slice(0, 5).map((trip) => {
                const dest = airportByIata(trip.destinationIata);
                const photo = ALL_DESTINATIONS.find((d) => d.iata === trip.destinationIata) ?? (dest?.city ? destinationById(dest.city.toLowerCase()) : undefined);
                return (
                  <li key={trip.orderId}>
                    <Link to={confirmationHref(trip.orderId)} className="group flex items-center gap-3.5 py-3">
                      <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {photo?.image && <img src={photo.image} srcSet={imageSrcSet(photo.image)} sizes="44px" alt="" aria-hidden="true" loading="lazy" decoding="async" width={44} height={44} className="h-full w-full object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <CountryFlag code={dest?.countryCode} size={12} />
                          <span className="truncate text-[15px] font-semibold">{dest?.city ?? trip.destinationIata}</span>
                        </span>
                        <span className="t-caption block">
                          {trip.departingAt ? formatDateShort(trip.departingAt) : ""} · {t("common.pax", { count: trip.passengerCount })}
                        </span>
                      </span>
                      <Icon icon={ArrowUpRight} size={16} className="shrink-0 text-muted-foreground transition-transform duration-fast group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── 8 · Varsler: bare når det faktisk finnes noe ────────────────────── */

export function ActivityLine({ unread }: { unread: number }) {
  const t = useT();
  if (unread <= 0) return null;
  return (
    <Link
      to="/profil/varsler"
      className="group flex items-center gap-2.5 border-b border-border pb-3 text-[14px] font-semibold transition-colors hover:text-skyline"
    >
      <span className="relative grid size-2 place-items-center">
        <span className="absolute size-2 rounded-full bg-primary" aria-hidden="true" />
      </span>
      <span className="flex-1">{t("acct.unread", { count: unread })}</span>
      <Icon icon={ArrowRight} size={16} className="shrink-0 transition-transform duration-fast group-hover:translate-x-0.5" />
    </Link>
  );
}
