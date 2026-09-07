import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ArrowRight, CalendarDays, Plane } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import Icon from "@/components/app/Icon";
import SiteFooter from "@/components/layout/SiteFooter";
import ArticleCard from "@/components/journal/ArticleCard";
import AddToBoard from "@/components/account/AddToBoard";
import DestinationCard from "@/components/travel/DestinationCard";
import DestinationSheet from "@/components/app/DestinationSheet";
import { EmptyState, FavoriteButton } from "@/components/app/primitives";
import { VisaStampGlyph } from "@/components/graphics";
import { ALL_DESTINATIONS, departDate, destinationById, imageSrcSet, searchHref, VISA_NOTES, type DiscoverDestination } from "@/content/discover";
import { FLIGHT_HINT, FLIGHT_LABELS, FLIGHT_OF, moodsFor, REGION_LABELS, REGION_OF } from "@/content/explore";
import { articlesForDestination } from "@/content/journal";
import { useSavedDestinations } from "@/lib/useAccount";
import { breadcrumbJsonLd, usePageMeta } from "@/lib/seo";
import { trpc } from "@/providers/trpc";
import { useState } from "react";

/**
 * Én side per reisemål: foto, det vi faktisk vet (flyplass, region, reisetid
 * som kategori, visumnotis med kilde), ekte priser for de neste avgangene,
 * artikler som handler om stedet, og naboene i samme region.
 */

const DAY_OFFSETS = [21, 28, 35, 42];
const fmtDay = new Intl.DateTimeFormat("nb-NO", { weekday: "short", day: "numeric", month: "short" });
const fmtNok = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[16px] font-semibold leading-tight">{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function View({ d }: { d: DiscoverDestination }) {
  const navigate = useNavigate();
  const { ids: favs, toggle: toggleFav } = useSavedDestinations();
  const [quickView, setQuickView] = useState<DiscoverDestination | null>(null);
  const region = REGION_OF[d.id];
  const flight = FLIGHT_OF[d.id];
  const moods = moodsFor(d.id);
  const articles = articlesForDestination(d.id, 3);
  const neighbours = ALL_DESTINATIONS.filter((x) => x.id !== d.id && REGION_OF[x.id] === region).slice(0, 6);

  usePageMeta({
    title: `Fly til ${d.city}`,
    description: `${d.city}, ${d.country}: ${d.tagline}. Ekte priser fra Oslo, bagasje per billett og det praktiske før du reiser.`,
    canonicalPath: `/reisemal/${d.id}`,
    image: d.image,
    jsonLd: breadcrumbJsonLd([{ name: "Hjem", path: "/" }, { name: "Utforsk", path: "/utforsk" }, { name: d.city, path: `/reisemal/${d.id}` }]),
  });

  const hints = trpc.flights.priceHints.useQuery(
    { origin: "OSL", destination: d.iata, cabinClass: "economy", dates: DAY_OFFSETS.map(departDate), passengers: ["adult"] },
    { staleTime: 600_000, retry: 1 },
  );
  const prices = (hints.data ?? []).map((h) => (h.amount == null ? null : Number(h.amount)));
  const cheapest = prices.reduce<number | null>((min, a) => (a != null && Number.isFinite(a) && (min == null || a < min) ? a : min), null);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-night text-white">
        {d.image && <img src={d.image} srcSet={imageSrcSet(d.image)} sizes="100vw" alt={d.imageAlt} width={1024} height={640} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-90" />}
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/35 to-night/15" aria-hidden="true" />
        <div className="container-x relative flex min-h-[380px] flex-col justify-between pb-8 pt-5 sm:min-h-[480px] sm:pb-12 lg:pt-8">
          <div className="flex items-center justify-between">
            <Link to="/utforsk" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 text-[14px] font-medium backdrop-blur-sm hover:bg-white/15"><Icon icon={ArrowLeft} size={16} /> Utforsk</Link>
            <div className="flex items-center gap-2">
              <AddToBoard kind="destination" refId={d.id} />
              <FavoriteButton active={favs.has(d.id)} onToggle={() => toggleFav(d.id)} label={favs.has(d.id) ? `Fjern ${d.city} fra lagrede` : `Lagre ${d.city}`} />
            </div>
          </div>
          <div>
            <p className="text-[14px] font-medium text-white/80">{d.country}{region && REGION_LABELS[region] !== d.country ? ` · ${REGION_LABELS[region]}` : ""}</p>
            <h1 className="mt-1 font-display text-[44px] leading-[1] sm:text-[72px]">{d.city}</h1>
            <p className="mt-3 max-w-xl text-[16px] text-white/85 sm:text-[18px]">{d.tagline}</p>
          </div>
        </div>
      </section>

      <div className="container-x">
        <div className="mt-8 grid gap-6 sm:grid-cols-3 lg:grid-cols-4">
          <Fact label="Flyplass" value={`${d.iata}`} hint={`Søket bruker ${d.iata} fra Oslo`} />
          {flight && <Fact label="Reisetid" value={FLIGHT_LABELS[flight]} hint={FLIGHT_HINT[flight]} />}
          {region && <Fact label="Region" value={REGION_LABELS[region]} />}
          {moods.length > 0 && <Fact label="Passer til" value={moods.map((m) => m.label).join(", ")} />}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div>
            <h2 className="font-display text-[26px]">Neste avganger fra Oslo</h2>
            <p className="mt-1 text-[14px] text-muted-foreground">Veiledende pris for én voksen, hentet fra vårt eget prissøk. Endelig pris med bagasje og gebyrer ser du i søket.</p>
            <ul className="surface mt-4 divide-y divide-border overflow-hidden">
              {DAY_OFFSETS.map((offset, i) => {
                const date = departDate(offset);
                const amount = prices[i];
                return (
                  <li key={offset}>
                    <Link to={searchHref(d.iata, offset)} className="flex min-h-[56px] items-center justify-between px-4 transition-colors hover:bg-muted/60">
                      <span className="flex items-center gap-3 text-[15px] font-medium first-letter:uppercase"><Icon icon={CalendarDays} size={16} className="text-muted-foreground" /> {fmtDay.format(new Date(`${date}T12:00:00`))}</span>
                      {hints.isLoading ? (
                        <span className="h-4 w-16 animate-pulse rounded-full bg-muted" />
                      ) : amount != null ? (
                        <span className="flex items-center gap-2 text-[15px] font-semibold tabular">
                          {cheapest === amount && <span className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">Lavest</span>}
                          {fmtNok.format(amount)} kr
                        </span>
                      ) : (
                        <span className="text-[13px] text-muted-foreground">Se pris i søk</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={() => navigate(searchHref(d.iata))} className="press mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-foreground sm:w-auto">
              <Icon icon={Plane} size={20} /> Søk fly til {d.city}
            </button>
          </div>

          <aside className="space-y-4">
            {VISA_NOTES[d.id] && (
              <div className="rounded-2xl bg-muted/70 p-5">
                <p className="flex items-center gap-2 text-[13px] font-semibold"><VisaStampGlyph size={18} className="text-muted-foreground" /> Innreise</p>
                <p className="mt-2 text-[14px] leading-relaxed text-foreground/85">{VISA_NOTES[d.id]}</p>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">Generell veiledning for norske pass. Reglene endres; sjekk Utenriksdepartementet og ambassaden før du bestiller. <Link to="/visum" className="font-semibold text-foreground underline underline-offset-2">Visumguiden</Link></p>
              </div>
            )}
            <div className="rounded-2xl bg-primary-soft p-5">
              <p className="text-[13px] font-semibold text-accent-foreground">Vet du hvor, men ikke når?</p>
              <p className="mt-1 text-[14px] leading-relaxed text-foreground/85">Sett en prisovervåking på Oslo–{d.city}. Vi sjekker ekte priser og sier fra når noe passer.</p>
              <Link to="/profil/prisovervaking" className="mt-3 inline-flex min-h-10 items-center gap-1 text-[14px] font-semibold">Start prisovervåking <Icon icon={ArrowRight} size={16} /></Link>
            </div>
          </aside>
        </div>

        {articles.length > 0 && (
          <section className="mt-14">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-[26px]">Fra journalen</h2>
              <Link to="/journal" className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary">Alle artikler <Icon icon={ArrowRight} size={16} /></Link>
            </div>
            <div className="mt-5 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => <ArticleCard key={a.slug} a={a} />)}
            </div>
          </section>
        )}

        {neighbours.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-[26px]">Flere i {region ? REGION_LABELS[region] : "regionen"}</h2>
            <div className="no-scrollbar snap-row -mx-5 mt-5 flex gap-4 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8">
              {neighbours.map((n) => (
                <DestinationCard key={n.id} destination={n} isFavourite={favs.has(n.id)} onToggleFavourite={toggleFav} onOpen={setQuickView} />
              ))}
            </div>
          </section>
        )}
      </div>
      <DestinationSheet destination={quickView} onClose={() => setQuickView(null)} />
    </>
  );
}

export default function DestinationPage() {
  const { id = "" } = useParams();
  const d = destinationById(id);
  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell bleed>
        {d ? <View d={d} /> : (
          <div className="container-x pt-10">
            <EmptyState title="Fant ikke reisemålet" body="Det kan være flyttet." action={<Link to="/utforsk" className="inline-flex min-h-11 items-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background">Utforsk reisemål</Link>} />
          </div>
        )}
      </AppShell>
      <div className="mt-16"><SiteFooter /></div>
    </div>
  );
}
