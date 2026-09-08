import { Link } from "react-router";
import { ArrowRight, FileText, ReceiptText, Users, type LucideIcon } from "lucide-react";
import Icon from "@/components/app/Icon";
import { Button } from "@/components/ui/button";
import { AccountRow, CountBadge } from "@/components/account/AccountRow";
import { AccountSection } from "@/components/account/AccountPage";
import { StatusPill, TripDocLinks, bucketOf, confirmationHref, receiptHref, type TripSummary } from "@/components/account/TripCard";
import { countKinds, travellerKind, type TravellerKind } from "@/components/account/family";
import { AdultGlyph, ChildGlyph, InfantGlyph, NoTripsSpot, type GlyphProps } from "@/components/graphics";
import { formatDateLong, formatDateShort } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { AccountHub } from "@/lib/useAccount";
import type { RouterOutputs } from "@/providers/trpc";
import { cn } from "@/lib/utils";

/**
 * Modulene på navet (/profil). Alle viser bare ekte data fra kontoen; uten
 * data står det som kan gjøres. Ingen tall som ikke finnes.
 */

type NextTrip = NonNullable<AccountHub["nextTrip"]>;
type Traveller = RouterOutputs["extras"]["myTravelers"][number];

/* ── Neste reise ──────────────────────────────────────────────────────── */

export function NextTripModule({ trip, days }: { trip: NextTrip | null; days: number | null }) {
  const t = useT();
  if (!trip) {
    return (
      <section className="surface p-5" aria-labelledby="next-trip-title">
        <div className="flex items-start gap-4">
          <NoTripsSpot className="h-16 w-20 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 id="next-trip-title" className="t-h3">{t("acct.hub.nextempty")}</h2>
            <p className="t-caption mt-1">{t("acct.hub.nextemptysub")}</p>
          </div>
        </div>
        <Button asChild variant="primary" size="lg" className="mt-4 w-full sm:w-auto">
          <Link to="/">
            {t("tr.search")} <Icon icon={ArrowRight} size={18} />
          </Link>
        </Button>
      </section>
    );
  }
  const from = trip.originCity || trip.originIata;
  const to = trip.destinationCity || trip.destinationIata;
  return (
    <section className="surface-lift p-5" aria-labelledby="next-trip-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="next-trip-title" className="t-label">{t("acct.hub.nexttrip")}</h2>
        <span className={cn("inline-flex min-h-6 items-center rounded-md px-2 text-[12px] font-semibold leading-none", days === 0 ? "bg-primary text-primary-foreground" : "bg-primary-soft text-accent-foreground")}>
          {days === 0 ? t("acct.hub.today") : t("acct.hub.daysto", { count: days ?? 0 })}
        </span>
      </div>
      <p className="t-h2 mt-3">
        {from} <span aria-hidden="true">→</span> {to}
      </p>
      {trip.originIata && trip.destinationIata ? (
        <p className="t-code mt-1.5 text-muted-foreground">
          {trip.originIata} – {trip.destinationIata}
        </p>
      ) : null}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
        <div>
          <dt className="t-label">{t("tr.depart")}</dt>
          <dd className="t-num mt-0.5 font-medium">{formatDateLong(trip.departingAt)}</dd>
        </div>
        {trip.returningAt ? (
          <div>
            <dt className="t-label">{t("tr.return")}</dt>
            <dd className="t-num mt-0.5 font-medium">{formatDateLong(trip.returningAt)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="t-label">{t("pw.pax")}</dt>
          <dd className="mt-0.5 font-medium">{t("common.pax", { count: trip.passengerCount })}</dd>
        </div>
        <div>
          <dt className="t-label">PNR</dt>
          <dd className="t-code mt-1 text-foreground">{trip.bookingReference || "–"}</dd>
        </div>
        <div>
          <dt className="t-label">{t("common.status")}</dt>
          <dd className="mt-1"><StatusPill state={trip.state} /></dd>
        </div>
      </dl>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="primary" size="lg" className="sm:flex-1">
          <Link to={confirmationHref(trip.orderId)}>
            <Icon icon={FileText} size={18} /> {t("acct.docs.ticket")}
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to={receiptHref(trip.orderId)}>
            <Icon icon={ReceiptText} size={18} /> {t("acct.docs.receipt")}
          </Link>
        </Button>
      </div>
    </section>
  );
}

/* ── Snarveier ────────────────────────────────────────────────────────── */

export type QuickAction = { to: string; icon: LucideIcon; label: string; count?: number };

export function QuickActions({ items, label }: { items: QuickAction[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="grid grid-cols-2 gap-2.5">
        {items.map((a) => (
          <li key={a.to}>
            <Link to={a.to} className="press flex min-h-14 items-center gap-3 rounded-2xl bg-muted/70 px-4 transition-colors duration-fast hover:bg-muted">
              <Icon icon={a.icon} size={20} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{a.label}</span>
              {a.count ? <CountBadge n={a.count} /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ── Reisedokumenter ──────────────────────────────────────────────────── */

export type DocumentsStatus = "loading" | "unverified" | "error" | "ready";

function SectionLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center gap-1 rounded-lg text-[14px] font-semibold transition-colors duration-fast hover:text-muted-foreground">
      {children} <Icon icon={ArrowRight} size={16} />
    </Link>
  );
}

export function DocumentsModule({ trips, status, now, max = 3 }: { trips: TripSummary[]; status: DocumentsStatus; now: number; max?: number }) {
  const t = useT();
  // Kommende først (nærmeste øverst), så de siste gjennomførte. Kansellerte hører til under /reiser.
  const upcoming = trips.filter((x) => bucketOf(x, now) === "upcoming").sort((a, b) => a.departingAt.localeCompare(b.departingAt));
  const past = trips.filter((x) => bucketOf(x, now) === "past").sort((a, b) => b.departingAt.localeCompare(a.departingAt));
  const shown = [...upcoming, ...past].slice(0, max);
  return (
    <AccountSection title={t("acct.docs")} sub={t("acct.docssub")} action={<SectionLink to="/reiser">{t("acct.viewall")}</SectionLink>}>
      <ul className="surface divide-y divide-border overflow-hidden">
        {status === "loading" && (
          <li className="p-4" aria-busy="true">
            <div className="shimmer h-12 rounded-lg" />
          </li>
        )}
        {status === "unverified" && <li className="t-caption px-4 py-4">{t("acct.docs.verify")}</li>}
        {status === "error" && <li className="t-caption px-4 py-4">{t("mt.fetchfail")}</li>}
        {status === "ready" && shown.length === 0 && <li className="t-caption px-4 py-4">{t("acct.docs.empty")}</li>}
        {status === "ready" &&
          shown.map((trip) => (
            <li key={trip.orderId} className="px-4 pb-1.5 pt-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[15px] font-semibold">
                  {trip.originCity || trip.originIata} <span aria-hidden="true">→</span> {trip.destinationCity || trip.destinationIata}
                </p>
                {trip.departingAt ? <span className="t-num shrink-0 text-[13px] text-muted-foreground">{formatDateShort(trip.departingAt)}</span> : null}
              </div>
              <p className="t-caption mt-0.5">
                {trip.bookingReference ? (
                  <>
                    PNR <span className="t-code text-foreground">{trip.bookingReference}</span> ·{" "}
                  </>
                ) : null}
                {t("common.pax", { count: trip.passengerCount })}
              </p>
              <TripDocLinks orderId={trip.orderId} className="mt-1" />
            </li>
          ))}
        <AccountRow to="/reiser" icon={ReceiptText} title={t("acct.receipts")} sub={t("acct.receiptssub")} />
      </ul>
    </AccountSection>
  );
}

/* ── Familien din ─────────────────────────────────────────────────────── */

const KIND_GLYPH: Record<TravellerKind, (p: GlyphProps) => React.JSX.Element> = { adult: AdultGlyph, child: ChildGlyph, infant: InfantGlyph };

export function FamilyModule({ travellers, loading, max = 4 }: { travellers: Traveller[]; loading: boolean; max?: number }) {
  const t = useT();
  const n = countKinds(travellers);
  const summary = [n.adult ? t("pax.adults", { count: n.adult }) : "", n.child ? t("pax.children", { count: n.child }) : "", n.infant ? t("pax.infants", { count: n.infant }) : ""]
    .filter(Boolean)
    .join(" · ");
  const rest = travellers.length - max;
  return (
    <AccountSection title={t("acct.family")} sub={summary || t("acct.familysub")} action={<SectionLink to="/profil/reisende">{t("acct.family.manage")}</SectionLink>}>
      <ul className="surface divide-y divide-border overflow-hidden">
        {loading && (
          <li className="p-4" aria-busy="true">
            <div className="shimmer h-10 rounded-lg" />
          </li>
        )}
        {!loading &&
          travellers.slice(0, max).map((p) => {
            const kind = travellerKind(p.bornOn);
            const KindGlyph = kind ? KIND_GLYPH[kind] : AdultGlyph;
            return (
              <li key={p.id} className="flex min-h-[64px] items-center gap-3.5 px-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  <KindGlyph size={20} />
                </span>
                <span className="min-w-0 flex-1 py-3">
                  <span className="block truncate text-[15px] font-semibold leading-tight">
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="t-caption mt-0.5 block">
                    {kind ? t(`acct.age.${kind}`) : t("acct.age.unknown")}
                    {p.bornOn ? ` · ${formatDateShort(`${p.bornOn}T12:00:00`)}` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        {!loading && rest > 0 && <AccountRow to="/profil/reisende" icon={Users} title={t("acct.family.more", { count: rest })} />}
        {!loading && travellers.length === 0 && <AccountRow to="/profil/reisende" icon={Users} title={t("acct.family.add")} sub={t("acct.family.addsub")} />}
      </ul>
    </AccountSection>
  );
}

/* ── Favorittruter ────────────────────────────────────────────────────── */

export function RoutesModule({ routes, departDate }: { routes: AccountHub["routes"]; departDate: string }) {
  const t = useT();
  if (routes.length === 0) return null;
  return (
    <AccountSection title={t("acct.routes.fav")} sub={t("acct.hub.routessub")}>
      <ul className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-wrap lg:px-0">
        {routes.map((r) => (
          <li key={`${r.originIata}-${r.destinationIata}`} className="shrink-0">
            <Link
              to={`/sok?from=${r.originIata}&to=${r.destinationIata}&depart=${departDate}&adults=1&children=0&infants=0&cabin=economy`}
              className="press inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-[14px] font-semibold transition-colors duration-fast hover:border-foreground/30"
            >
              {r.originCity} <Icon icon={ArrowRight} size={14} className="text-muted-foreground" /> {r.destinationCity}
            </Link>
          </li>
        ))}
      </ul>
    </AccountSection>
  );
}
