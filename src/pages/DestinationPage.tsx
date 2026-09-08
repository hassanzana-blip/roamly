import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ArrowRight, CalendarDays, Plane } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import Icon from "@/components/app/Icon";
import SiteFooter from "@/components/layout/SiteFooter";
import ArticleCard from "@/components/journal/ArticleCard";
import { coverVariantAt } from "@/components/journal/TypeCover";
import AddToBoard from "@/components/account/AddToBoard";
import PlaceCard from "@/components/travel/PlaceCard";
import { EmptyState, FavoriteButton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { VisaStampGlyph } from "@/components/graphics";
import { ALL_DESTINATIONS, departDate, destinationById, imageSrcSet, searchHref, VISA_NOTES, type DiscoverDestination } from "@/content/discover";
import { FLIGHT_HINT, FLIGHT_LABELS, FLIGHT_OF, moodsFor, REGION_LABELS, REGION_OF } from "@/content/explore";
import { articlesForDestination } from "@/content/journal";
import { useT } from "@/lib/i18n";
import { useSavedDestinations } from "@/lib/useAccount";
import { breadcrumbJsonLd, usePageMeta } from "@/lib/seo";
import { trpc } from "@/providers/trpc";

/**
 * Én side per reisemål: foto, det vi faktisk vet (flyplass, region, reisetid
 * som kategori, visumnotis med kilde), ekte priser for de neste avgangene,
 * artikler som handler om stedet, og naboene i samme region.
 */

const DAY_OFFSETS = [21, 28, 35, 42];
const fmtDay = new Intl.DateTimeFormat("nb-NO", { weekday: "short", day: "numeric", month: "short" });
const fmtNok = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

function View({ d }: { d: DiscoverDestination }) {
  const t = useT();
  const navigate = useNavigate();
  const { ids: favs, toggle: toggleFav } = useSavedDestinations();
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

  const facts: { label: string; value: string; hint?: string }[] = [
    { label: "Flyplass", value: d.iata, hint: `Søket bruker ${d.iata} fra Oslo` },
    ...(flight ? [{ label: "Reisetid", value: FLIGHT_LABELS[flight], hint: FLIGHT_HINT[flight] }] : []),
    ...(region ? [{ label: "Region", value: REGION_LABELS[region] }] : []),
    ...(moods.length > 0 ? [{ label: "Passer til", value: moods.map((m) => m.label).join(", ") }] : []),
  ];
  const regionLabel = region ? REGION_LABELS[region] : undefined;

  return (
    <>
      <section className="relative isolate overflow-hidden bg-night text-white">
        {d.image && (
          <img
            src={d.image}
            srcSet={imageSrcSet(d.image)}
            sizes="100vw"
            alt={d.imageAlt}
            width={1024}
            height={640}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/35 to-night/10" aria-hidden="true" />
        <div className="container-x relative flex min-h-[420px] flex-col justify-between pb-8 pt-5 sm:min-h-[540px] sm:pb-12 lg:pt-8">
          <div className="flex items-center justify-between">
            <Link to="/utforsk" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/30 bg-night/50 px-3.5 text-[14px] font-medium transition-colors duration-fast hover:bg-night/70">
              <Icon icon={ArrowLeft} size={16} /> Utforsk
            </Link>
            <div className="flex items-center gap-2">
              <AddToBoard kind="destination" refId={d.id} />
              <FavoriteButton active={favs.has(d.id)} onToggle={() => toggleFav(d.id)} label={favs.has(d.id) ? `Fjern ${d.city} fra lagrede` : `Lagre ${d.city}`} />
            </div>
          </div>
          <div className="max-w-3xl">
            <h1 className="t-display">{d.city}</h1>
            <p className="t-lead mt-3 max-w-xl text-white/85">{d.tagline}</p>
            <p className="mt-4 text-[14px] text-white/75">
              {d.country}
              {regionLabel && regionLabel !== d.country ? ` · ${regionLabel}` : ""}
              {" · "}
              <span className="t-code">{d.iata}</span>
            </p>
          </div>
        </div>
      </section>

      <div className="container-x">
        <div className="mt-8 grid gap-10 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
          <div>
            <h2 className="t-h3">{t("dest.inBrief")}</h2>
            <dl className="mt-3 divide-y divide-border border-y border-border">
              {facts.map((f) => (
                <div key={f.label} className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 py-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <dt className="t-label pt-0.5">{f.label}</dt>
                  <dd>
                    <span className="t-num block text-[15px] font-semibold leading-snug">{f.value}</span>
                    {f.hint && <span className="t-caption block">{f.hint}</span>}
                  </dd>
                </div>
              ))}
            </dl>

            <h2 className="t-h2 mt-12">{t("dest.nextDepartures")}</h2>
            <p className="t-caption mt-2 max-w-xl">Veiledende pris for én voksen, hentet fra vårt eget prissøk. Endelig pris med bagasje og gebyrer ser du i søket.</p>
            <ul className="surface mt-4 divide-y divide-border overflow-hidden">
              {DAY_OFFSETS.map((offset, i) => {
                const date = departDate(offset);
                const amount = prices[i];
                return (
                  <li key={offset}>
                    <Link to={searchHref(d.iata, offset)} className="flex min-h-[56px] items-center justify-between px-4 transition-colors duration-fast hover:bg-muted/60">
                      <span className="flex items-center gap-3 text-[15px] font-medium first-letter:uppercase">
                        <Icon icon={CalendarDays} size={16} className="text-muted-foreground" /> {fmtDay.format(new Date(`${date}T12:00:00`))}
                      </span>
                      {hints.isLoading ? (
                        <span className="h-4 w-16 animate-pulse rounded-full bg-muted" />
                      ) : amount != null ? (
                        <span className="t-num flex items-center gap-2 text-[15px] font-semibold">
                          {cheapest === amount && <span className="rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">Lavest</span>}
                          {fmtNok.format(amount)} kr
                        </span>
                      ) : (
                        <span className="t-caption">Se pris i søk</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Button size="lg" onClick={() => navigate(searchHref(d.iata))} className="mt-5 w-full sm:w-auto">
              <Icon icon={Plane} size={20} /> {t("dest.searchTo", { city: d.city })}
            </Button>
          </div>

          <aside className="space-y-5">
            {VISA_NOTES[d.id] && (
              <div className="rounded-2xl bg-muted/70 p-5">
                <p className="flex items-center gap-2 text-[13px] font-semibold"><VisaStampGlyph size={18} className="text-muted-foreground" /> Innreise</p>
                <p className="mt-2 text-[14px] leading-relaxed text-foreground/85">{VISA_NOTES[d.id]}</p>
                <p className="t-caption mt-2">
                  Generell veiledning for norske pass. Reglene endres; sjekk Utenriksdepartementet og ambassaden før du bestiller.{" "}
                  <Link to="/visum" className="font-semibold text-foreground underline underline-offset-2">Visumguiden</Link>
                </p>
              </div>
            )}
            <div className="rounded-2xl bg-primary-soft p-5">
              <p className="text-[13px] font-semibold text-accent-foreground">Vet du hvor, men ikke når?</p>
              <p className="mt-1 text-[14px] leading-relaxed text-foreground/85">Sett en prisovervåking på Oslo–{d.city}. Vi sjekker ekte priser og sier fra når noe passer.</p>
              <Link to="/profil/prisovervaking" className="mt-3 inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold">
                Start prisovervåking <Icon icon={ArrowRight} size={16} />
              </Link>
            </div>
          </aside>
        </div>

        {articles.length > 0 && (
          <section className="mt-16">
            <div className="flex items-end justify-between gap-4">
              <h2 className="t-h2">{t("dest.fromJournal")}</h2>
              <Link to="/journal" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">
                {t("journal.allArticles")} <Icon icon={ArrowRight} size={16} />
              </Link>
            </div>
            <div className="mt-6 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a, i) => (
                <ArticleCard key={a.slug} a={a} variant={coverVariantAt(i)} forceType={a.hero === d.id} />
              ))}
            </div>
          </section>
        )}

        {neighbours.length > 0 && (
          <section className="mt-16">
            <h2 className="t-h2">{t("dest.moreIn", { region: regionLabel ?? "regionen" })}</h2>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:gap-x-5">
              {neighbours.map((n) => (
                <PlaceCard
                  key={n.id}
                  place={{ id: n.id, city: n.city, country: n.country, iata: n.iata, caption: n.tagline, image: n.image, imageAlt: n.imageAlt }}
                  to={`/reisemal/${n.id}`}
                  favourite={favs.has(n.id)}
                  onToggleFavourite={() => toggleFav(n.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
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
