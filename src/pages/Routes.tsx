import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import Icon from "@/components/app/Icon";
import SiteFooter from "@/components/layout/SiteFooter";
import { airportByIata } from "@contracts/airports";
import { ROUTES, routeTitle } from "@contracts/routes";
import { usePageMeta } from "@/lib/seo";

/**
 * /fly – oversikten over rutesidene, gruppert etter avreiseby.
 *
 * Dette er navet i den interne lenkingen: herfra når man hver ruteside, og
 * hver ruteside peker tilbake hit og videre til reisemålet. Listen er kort
 * med vilje. En rute havner her når vi har noe å si om den, ikke fordi to
 * flyplasskoder kan settes sammen.
 */

export default function RoutesPage() {
  usePageMeta({
    title: "Flyruter fra Norge",
    description: "Rutesider med flyplasser, vanlig reisetid og hvem som flyr direkte. Prisene henter vi når du søker.",
    canonicalPath: "/fly",
  });

  const byOrigin = new Map<string, typeof ROUTES>();
  for (const r of ROUTES) {
    const city = airportByIata(r.from)?.city ?? r.from;
    byOrigin.set(city, [...(byOrigin.get(city) ?? []), r]);
  }

  return (
    <div className="min-h-[100dvh] bg-page">
      <AppShell className="pb-10">
        <h1 className="t-display mt-2 lg:mt-8">Flyruter fra Norge</h1>
        <p className="mt-3 max-w-2xl text-[17px] leading-normal text-muted-foreground">
          Flyplasser, vanlig reisetid og hvem som flyr direkte. Priser står ikke på rutesidene – de henter vi fra leverandøren når du søker.
        </p>

        {[...byOrigin.entries()].map(([city, routes]) => (
          <section key={city} aria-labelledby={`fra-${city}`} className="mt-10">
            <h2 id={`fra-${city}`} className="t-h2">
              Fra {city}
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {routes.map((r) => (
                <li key={r.slug}>
                  <Link
                    to={`/fly/${r.slug}`}
                    className="press flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 text-[16px] font-semibold text-azure-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="min-w-0 truncate">{routeTitle(r)}</span>
                    <Icon icon={ArrowRight} size={20} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </AppShell>
      <SiteFooter />
    </div>
  );
}
