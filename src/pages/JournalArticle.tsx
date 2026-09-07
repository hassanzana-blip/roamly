import { Link, useParams } from "react-router";
import { ArrowLeft, ArrowRight, Plane } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import Icon from "@/components/app/Icon";
import SiteFooter from "@/components/layout/SiteFooter";
import ArticleCard, { ArticleCover, ArticleMeta } from "@/components/journal/ArticleCard";
import AddToBoard from "@/components/account/AddToBoard";
import { EmptyState } from "@/components/app/primitives";
import { ALL_DESTINATIONS, destinationById, searchHref } from "@/content/discover";
import { articleBySlug, TAG_LABELS, type Article, type Block } from "@/content/journal";
import { articleJsonLd, breadcrumbJsonLd, usePageMeta } from "@/lib/seo";

const fmtDate = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", year: "numeric" });

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "p":
            return <p key={i} className="mt-5 text-[17px] leading-[1.65] text-foreground/90">{b.text}</p>;
          case "h2":
            return <h2 key={i} id={b.id} className="mt-10 scroll-mt-24 font-display text-[26px] leading-tight sm:text-[30px]">{b.text}</h2>;
          case "ul":
            return (
              <ul key={i} className="mt-5 space-y-3">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3 text-[17px] leading-[1.6] text-foreground/90">
                    <span className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            );
          case "tip":
            return (
              <aside key={i} className="mt-7 rounded-xl bg-primary-soft p-5 sm:p-6">
                {b.title && <p className="text-[13px] font-semibold text-accent-foreground">{b.title}</p>}
                <p className="mt-1 text-[16px] leading-relaxed text-foreground/90">{b.text}</p>
              </aside>
            );
          case "quote":
            return (
              <blockquote key={i} className="mt-7 border-l-2 border-primary pl-5 font-display text-[22px] leading-snug">
                {b.text}
                {b.by && <footer className="mt-2 font-sans text-[13px] text-muted-foreground">{b.by}</footer>}
              </blockquote>
            );
          case "steps":
            return (
              <ol key={i} className="mt-6 space-y-4">
                {b.items.map((s, j) => (
                  <li key={j} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[13px] font-bold text-background">{j + 1}</span>
                    <span>
                      <span className="block text-[17px] font-semibold leading-tight">{s.title}</span>
                      <span className="mt-1 block text-[16px] leading-relaxed text-foreground/85">{s.text}</span>
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
  const dest = a.hero ? destinationById(a.hero) : undefined;
  const searchDest = a.searchIata ? ALL_DESTINATIONS.find((d) => d.iata === a.searchIata) : undefined;
  const headings = a.blocks.filter((b): b is Extract<Block, { t: "h2" }> => b.t === "h2");
  const related = a.relatedArticles.map(articleBySlug).filter((x): x is Article => Boolean(x));
  const places = a.relatedDestinations.map(destinationById).filter((d): d is NonNullable<typeof d> => Boolean(d));

  return (
    <>
      <div className="container-x pt-4 lg:pt-6">
        <Link to="/journal" className="inline-flex min-h-10 items-center gap-1.5 text-[14px] font-medium text-muted-foreground hover:text-foreground"><Icon icon={ArrowLeft} size={16} /> Journal</Link>
      </div>
      <article className="container-x">
        <header className="mx-auto max-w-3xl pt-4">
          <ArticleMeta a={a} />
          <h1 className="mt-3 font-display text-[36px] leading-[1.04] sm:text-[52px]">{a.title}</h1>
          <p className="mt-4 text-[18px] leading-relaxed text-muted-foreground sm:text-[20px]">{a.deck}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {a.tags.map((t) => <Link key={t} to={`/journal?t=${t}`} className="inline-flex min-h-8 items-center rounded-md bg-muted px-2.5 text-[12px] font-semibold text-foreground hover:bg-secondary">{TAG_LABELS[t]}</Link>)}
            <AddToBoard kind="article" refId={a.slug} payload={{ title: a.title }} className="ml-auto" />
          </div>
        </header>

        {dest?.image && (
          <figure className="mx-auto mt-8 max-w-5xl">
            <div className="group aspect-[16/9] overflow-hidden rounded-2xl bg-muted sm:aspect-[21/9]">
              <ArticleCover a={a} sizes="(max-width: 1024px) 100vw, 1024px" className="group-hover:scale-100" />
            </div>
            <figcaption className="mt-2 px-1 text-[12px] text-muted-foreground">{a.heroAlt ?? dest.imageAlt}</figcaption>
          </figure>
        )}

        <div className="mx-auto mt-6 max-w-3xl lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-14">
          <div className="max-w-3xl">
            <Blocks blocks={a.blocks} />

            {searchDest && (
              <Link to={searchHref(searchDest.iata)} className="press mt-10 flex items-center justify-between gap-4 rounded-2xl bg-night p-5 text-white sm:p-6">
                <span>
                  <span className="block font-display text-[24px] leading-tight">Søk fly til {searchDest.city}</span>
                  <span className="mt-1 block text-[14px] text-white/70">Ekte priser fra Oslo, med bagasje og gebyrer regnet inn.</span>
                </span>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Icon icon={Plane} size={20} /></span>
              </Link>
            )}

            <p className="mt-10 border-t border-border pt-5 text-[13px] leading-relaxed text-muted-foreground">
              Sist sett over {fmtDate.format(new Date(`${a.updated}T12:00:00`))}. Vi oppgir ikke priser, visumregler eller bagasjegrenser som tall, fordi de endres uten at vi får beskjed. Sjekk alltid kilden som bestemmer: flyselskapet, Utenriksdepartementet og ambassaden.
            </p>
          </div>

          {headings.length > 1 && (
            <nav className="hidden lg:block" aria-label="Innhold">
              <div className="sticky top-24">
                <p className="text-[12px] font-semibold text-muted-foreground">I denne artikkelen</p>
                <ol className="mt-3 space-y-2 border-l border-border">
                  {headings.map((h) => (
                    <li key={h.id}><a href={`#${h.id}`} className="-ml-px block border-l border-transparent pl-4 text-[14px] leading-snug text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">{h.text}</a></li>
                  ))}
                </ol>
              </div>
            </nav>
          )}
        </div>
      </article>

      {places.length > 0 && (
        <section className="container-x mt-14">
          <h2 className="font-display text-[24px]">Reisemål i artikkelen</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {places.map((d) => (
              <Link key={d.id} to={`/reisemal/${d.id}`} className="press inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-[14px] font-semibold transition-colors hover:border-foreground/30">
                {d.city} <Icon icon={ArrowRight} size={14} className="text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="container-x mt-14">
          <h2 className="font-display text-[24px]">Les også</h2>
          <div className="mt-5 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => <ArticleCard key={r.slug} a={r} />)}
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
