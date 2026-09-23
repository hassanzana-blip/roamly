import { useMemo } from "react";
import { Link, useParams } from "react-router";
import { ArrowRight, Clock, MapPin, Plane } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import Icon from "@/components/app/Icon";
import SiteFooter from "@/components/layout/SiteFooter";
import NotFound from "@/pages/NotFound";
import { ALL_DESTINATIONS } from "@/content/discover";
import { airportByIata } from "@contracts/airports";
import { ROUTES, routeBySlug, routeDescription, routeTitle } from "@contracts/routes";
import { formatDuration } from "@/lib/format";
import { usePageMeta } from "@/lib/seo";
import { datesFor } from "@/lib/tripDates";

/**
 * Rutesiden: /fly/oslo-london.
 *
 * Det som står her er ruteopplysninger – flyplasser, vanlig reisetid, hvem
 * som flyr direkte. De endrer seg sjelden og kan stå på en side som skal
 * indekseres. **Priser står ikke her.** De er ferskvare, de kommer fra
 * leverandøren, og et tall på en statisk side ville vært utdatert i det den
 * ble lest. Siden sender deg videre til søket, og søket henter prisen.
 *
 * Serveren rendrer det samme innholdet som HTML før JavaScript
 * (api/lib/prerender.ts), fra det samme registeret, slik at de to aldri kan
 * si hver sin ting.
 */

export default function RoutePage() {
  const { slug = "" } = useParams();
  const route = routeBySlug(slug);
  const trip = useMemo(() => datesFor("weekend", 3), []);

  usePageMeta(
    route
      ? { title: routeTitle(route), description: routeDescription(route), canonicalPath: `/fly/${route.slug}` }
      : { title: "Ruten finnes ikke", description: "Denne ruten har ingen side hos HelloSky.", canonicalPath: "/fly", noindex: true },
  );

  if (!route) return <NotFound />;

  const from = airportByIata(route.from);
  const to = airportByIata(route.to);
  const destination = ALL_DESTINATIONS.find((d) => d.iata === route.to);
  const searchHref = `/sok?${new URLSearchParams({
    from: route.from,
    to: route.to,
    depart: trip.depart,
    ret: trip.ret,
    adults: "1",
    children: "0",
    infants: "0",
    cabin: "economy",
  }).toString()}`;

  const facts: { label: string; value: string }[] = [
    { label: "Fra", value: from ? `${from.city} (${route.from}) – ${from.name}` : route.from },
    { label: "Til", value: to ? `${to.city} (${route.to}) – ${to.name}` : route.to },
    ...(route.typicalDurationMinutes ? [{ label: "Vanlig reisetid uten stopp", value: formatDuration(route.typicalDurationMinutes) }] : []),
    { label: "Direktefly", value: route.directCarriers.length ? route.directCarriers.join(", ") : "Ingen kjente direktefly – reisen går med bytte" },
  ];

  const nearby = route.nearbyOrigins
    .map((code) => ({ code, airport: airportByIata(code) }))
    .filter((x): x is { code: string; airport: NonNullable<ReturnType<typeof airportByIata>> } => Boolean(x.airport))
    .map((x) => ({
      href: `/fly/${slugPart(x.airport.city)}-${slugPart(to?.city ?? route.to)}`,
      label: `${x.airport.city} – ${to?.city ?? route.to}`,
    }))
    .filter((l) => ROUTES.some((r) => `/fly/${r.slug}` === l.href));

  return (
    <div className="min-h-[100dvh] bg-page">
      <AppShell className="pb-10">
        <h1 className="t-display mt-2 lg:mt-8">{routeTitle(route)}</h1>
        <p className="mt-3 max-w-2xl text-[17px] leading-normal text-muted-foreground">{route.intro}</p>

        <Link
          to={searchHref}
          className="press mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-[16px] font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Søk {from?.city ?? route.from} – {to?.city ?? route.to} <Icon icon={ArrowRight} size={20} />
        </Link>

        <section aria-labelledby="rute-fakta" className="mt-10">
          <h2 id="rute-fakta" className="t-h2">
            Om ruten
          </h2>
          <dl className="mt-3 max-w-2xl">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-wrap justify-between gap-x-6 gap-y-1 border-b border-border py-3">
                <dt className="text-[15px] text-muted-foreground">{f.label}</dt>
                <dd className="text-[15px] font-semibold">{f.value}</dd>
              </div>
            ))}
          </dl>
          {/* Skillet mellom det som står fast og det som hentes: leseren skal
              aldri lure på om tallet over er dagens pris. */}
          <p className="mt-4 flex max-w-2xl items-start gap-2.5 text-[14px] leading-snug text-muted-foreground">
            <Icon icon={Clock} size={20} className="mt-0.5 shrink-0" />
            Opplysningene over beskriver ruten og endrer seg sjelden. Priser og ledige avganger henter vi først når du søker, og de kommer fra leverandøren.
          </p>
        </section>

        {nearby.length > 0 && (
          <section aria-labelledby="rute-nabo" className="mt-10">
            <h2 id="rute-nabo" className="t-h3">
              Fra en flyplass i nærheten
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {nearby.map((l) => (
                <li key={l.href}>
                  <Link
                    to={l.href}
                    className="press inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-[15px] font-semibold text-azure-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Icon icon={Plane} size={16} /> {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="rute-les-mer" className="mt-10">
          <h2 id="rute-les-mer" className="t-h3">
            Les mer
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {[
              destination ? { href: `/reisemal/${destination.id}`, label: `Reisemål: ${destination.city}` } : null,
              { href: "/fly", label: "Alle ruter" },
              { href: "/reisemal", label: "Alle reisemål" },
            ]
              .filter((x): x is { href: string; label: string } => x !== null)
              .map((l) => (
                <li key={l.href}>
                  <Link
                    to={l.href}
                    className="press inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-[15px] font-semibold text-azure-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Icon icon={MapPin} size={16} /> {l.label}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      </AppShell>
      <SiteFooter />
    </div>
  );
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
