import { Link, useParams } from "react-router";
import { ArrowLeft, Plane } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import Icon from "@/components/app/Icon";
import SiteFooter from "@/components/layout/SiteFooter";
import ArticleCard, { ArticleCover, ArticleMeta } from "@/components/journal/ArticleCard";
import { articlePhoto } from "@/components/journal/articlePhoto";
import { coverVariantAt } from "@/components/journal/coverVariants";
import AddToBoard from "@/components/account/AddToBoard";
import PlaceCard from "@/components/travel/PlaceCard";
import { EmptyState } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { ALL_DESTINATIONS, destinationById, searchHref } from "@/content/discover";
import { articleBySlug, TAG_LABELS, type Article, type Block } from "@/content/journal";
import { useT } from "@/lib/i18n";
import { articleJsonLd, breadcrumbJsonLd, usePageMeta } from "@/lib/seo";

const fmtDate = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", year: "numeric" });

/** Brødtekst 16/1.6 i et mål på 65–75 tegn; serif-mellomtitler; tips og sitater på paletten. */
function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "p":
            return <p key={i} className="t-body mt-5 text-foreground/90">{b.text}</p>;
          case "h2":
            return <h2 key={i} id={b.id} className="t-h2 mt-10 scroll-mt-24">{b.text}</h2>;
          case "ul":
            return (
              <ul key={i} className="mt-5 space-y-3">
                {b.items.map((it, j) => (
                  <li key={j} className="t-body flex gap-3 text-foreground/90">
                    <span className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            );
          case "tip":
            return (
              <aside key={i} className="mt-7 rounded-2xl bg-primary-soft p-5 sm:p-6">
                {b.title && <p className="text-[12px] font-semibold text-accent-foreground">{b.title}</p>}
                <p className="t-body mt-1 text-foreground/90">{b.text}</p>
              </aside>
            );
          case "quote":
            return (
              <blockquote key={i} className="mt-8">
                <span className="block h-1 w-10 rounded-full bg-primary" aria-hidden="true" />
                <p className="font-display mt-4 text-[24px] italic leading-[1.3] sm:text-[28px]">{b.text}</p>
                {b.by && <footer className="t-caption mt-3">{b.by}</footer>}
              </blockquote>
            );
          case "steps":
            return (
              <ol key={i} className="mt-6 space-y-4">
                {b.items.map((s, j) => (
                  <li key={j} className="flex gap-4">
                    <span className="t-num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[13px] font-bold text-background">{j + 1}</span>
                    <span>
                      <span className="t-h3 block">{s.title}</span>
                      <span className="t-body mt-1 block text-foreground/85">{s.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            );
        }
      })}
    </>
  );
}

function ArticleView({ a }: { a: Article }) {
  const t = useT();
  usePageMeta({
    title: a.title,
    description: a.deck,
    canonicalPath: `/journal/${a.slug}`,
    type: "article",
    image: a.hero ? destinationById(a.hero)?.image : undefined,
    jsonLd: [
      articleJsonLd({ headline: a.title, description: a.deck, path: `/journal/${a.slug}`, dateModified: a.updated }),
      breadcrumbJsonLd([{ name: "Hjem", path: "/" }, { name: "Journal", path: "/journal" }, { name: a.title, path: `/journal/${a.slug}` }]),
    ],
  });
  const photo = articlePhoto(a);
  const searchDest = a.searchIata ? ALL_DESTINATIONS.find((d) => d.iata === a.searchIata) : undefined;
  const headings = a.blocks.filter((b): b is Extract<Block, { t: "h2" }> => b.t === "h2");
  const related = a.relatedArticles.map(articleBySlug).filter((x): x is Article => Boolean(x));
  const places = a.relatedDestinations.map(destinationById).filter((d): d is NonNullable<typeof d> => Boolean(d));

  return (
    <>
      <div className="container-x pt-3 lg:pt-5">
        <Link to="/journal" className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground">
          <Icon icon={ArrowLeft} size={16} /> Journal
        </Link>
      </div>

      <article className="container-x">
        {/* Header, photo and body share one grid so the measure lines up with the table of contents. */}
        <div className="mx-auto max-w-[72ch] lg:grid lg:max-w-[calc(72ch+16rem)] lg:grid-cols-[minmax(0,72ch)_200px] lg:gap-x-16">
          <header className="pt-2 lg:col-start-1 lg:pt-4">
            <div className="flex flex-wrap gap-2">
              {a.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/journal?t=${tag}`}
                  className="inline-flex min-h-9 items-center rounded-lg border border-border bg-card px-3 text-[13px] font-semibold transition-colors duration-fast hover:border-foreground/40"
                >
                  {TAG_LABELS[tag]}
                </Link>
              ))}
            </div>
            <h1 className="t-h1 mt-5">{a.title}</h1>
            <p className="t-lead mt-4 text-muted-foreground">{a.deck}</p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <ArticleMeta a={a} withCategory={false} />
              <AddToBoard kind="article" refId={a.slug} payload={{ title: a.title }} />
            </div>
          </header>

          {photo && (
            <figure className="mt-8 lg:col-span-2">
              <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-muted sm:aspect-[21/9]">
                <ArticleCover a={a} sizes="(max-width: 1024px) 100vw, 1024px" />
              </div>
              <figcaption className="t-caption mt-2 px-1">{photo.alt}</figcaption>
            </figure>
          )}

          <div className="mt-6 lg:col-start-1 lg:mt-8">
            <Blocks blocks={a.blocks} />

            {searchDest && (
              <div className="surface mt-10 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="t-h3">{t("dest.searchTo", { city: searchDest.city })}</p>
                  <p className="t-caption mt-1">Ekte priser fra Oslo, med bagasje og gebyrer regnet inn.</p>
                </div>
                <Button asChild size="lg" className="shrink-0">
                  <Link to={searchHref(searchDest.iata)}><Icon icon={Plane} size={20} /> Søk fly</Link>
                </Button>
              </div>
            )}

            <p className="t-caption mt-10 border-t border-border pt-5">
              Sist sett over {fmtDate.format(new Date(`${a.updated}T12:00:00`))}. Vi oppgir ikke priser, visumregler eller bagasjegrenser som tall, fordi de endres uten at vi får beskjed. Sjekk alltid kilden som bestemmer: flyselskapet, Utenriksdepartementet og ambassaden.
            </p>
          </div>

          {headings.length > 1 && (
            <nav className="hidden lg:col-start-2 lg:mt-8 lg:block" aria-label={t("journal.inThisArticle")}>
              <div className="sticky top-24 border-t border-border pt-4">
                <p className="t-label">{t("journal.inThisArticle")}</p>
                <ol className="mt-3 space-y-2.5">
                  {headings.map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`} className="block text-[14px] leading-snug text-muted-foreground transition-colors duration-fast hover:text-foreground">{h.text}</a>
                    </li>
                  ))}
                </ol>
              </div>
            </nav>
          )}
        </div>
      </article>

      {places.length > 0 && (
        <section className="container-x mt-16">
          <h2 className="t-h2">{t("journal.placesInArticle")}</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
            {places.map((d) => (
              <PlaceCard
                key={d.id}
                place={{ id: d.id, city: d.city, country: d.country, iata: d.iata, caption: d.tagline, image: d.image, imageAlt: d.imageAlt }}
                to={`/reisemal/${d.id}`}
              />
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="container-x mt-16">
          <h2 className="t-h2">{t("journal.readAlso")}</h2>
          <div className="mt-6 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r, i) => <ArticleCard key={r.slug} a={r} variant={coverVariantAt(i)} />)}
          </div>
        </section>
      )}
    </>
  );
}

export default function JournalArticle() {
  const { slug = "" } = useParams();
  const a = articleBySlug(slug);
  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell bleed>
        {a ? (
          <ArticleView a={a} />
        ) : (
          <div className="container-x pt-10">
            <EmptyState title="Fant ikke artikkelen" body="Den kan være flyttet eller fjernet." action={<Link to="/journal" className="inline-flex min-h-11 items-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background">Til journalen</Link>} />
          </div>
        )}
      </AppShell>
      <div className="mt-16"><SiteFooter /></div>
    </div>
  );
}
