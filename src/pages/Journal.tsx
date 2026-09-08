import { useMemo } from "react";
import { useSearchParams } from "react-router";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import SiteFooter from "@/components/layout/SiteFooter";
import ArticleCard from "@/components/journal/ArticleCard";
import { coverVariantAt } from "@/components/journal/coverVariants";
import { Chip } from "@/components/account/AccountRow";
import { articlesByTag, featured, TAG_LABELS, tagsInUse, type JournalTag } from "@/content/journal";
import { PAGE_META, breadcrumbJsonLd, itemListJsonLd, usePageMeta } from "@/lib/seo";

/**
 * HelloSky Journal – nyttig, ikke pent. Én toppsak, to sekundære, så alt
 * annet i et rutenett. Ingen «trending», ingen tellere; rekkefølgen er sist
 * oppdatert først. Artikler uten foto får et typografisk omslag, og naboer
 * får aldri samme variant.
 */
export default function Journal() {
  const [params, setParams] = useSearchParams();
  const tags = tagsInUse();
  const tag = (tags as string[]).includes(params.get("t") ?? "") ? (params.get("t") as JournalTag) : "alle";
  const list = useMemo(() => articlesByTag(tag), [tag]);
  const { lead, secondary, rest } = useMemo(() => {
    const top = tag === "alle" ? featured() : list;
    const lead = top[0];
    const secondary = top.slice(1, 3);
    const used = new Set([lead?.slug, ...secondary.map((a) => a.slug)]);
    return { lead, secondary, rest: list.filter((a) => !used.has(a.slug)) };
  }, [tag, list]);

  usePageMeta({
    ...PAGE_META.journal,
    jsonLd: [
      itemListJsonLd(list.map((a) => ({ name: a.title, url: `/journal/${a.slug}`, description: a.deck }))),
      breadcrumbJsonLd([{ name: "Hjem", path: "/" }, { name: PAGE_META.journal.title, path: PAGE_META.journal.canonicalPath }]),
    ],
  });

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <AppHeader title="Journal" as="h1" />
        <p className="t-lead -mt-2 max-w-2xl text-muted-foreground">
          Det vi faktisk vet om reisen: bagasje, mellomlandinger, barn og rutene hjem. Ingen priser, ingen visumregler som tall. Bare det som holder seg.
        </p>

        <div className="no-scrollbar -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8" role="group" aria-label="Tema">
          <Chip active={tag === "alle"} onClick={() => setParams({}, { replace: true })}>Alle</Chip>
          {tags.map((t) => (
            <Chip key={t} active={tag === t} onClick={() => setParams({ t }, { replace: true })}>{TAG_LABELS[t]}</Chip>
          ))}
        </div>

        {lead && (
          <section className="mt-8 sm:mt-10">
            <ArticleCard a={lead} layout="lead" variant="ink" />
            {secondary.length > 0 && (
              <div className="mt-10 grid gap-6 border-y border-border py-6 md:grid-cols-2 md:gap-8">
                {secondary.map((a, i) => (
                  <ArticleCard key={a.slug} a={a} layout="row" variant={i === 0 ? "lime" : "paper"} />
                ))}
              </div>
            )}
          </section>
        )}

        {rest.length > 0 && (
          <div className="mt-10 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((a, i) => <ArticleCard key={a.slug} a={a} variant={coverVariantAt(i)} />)}
          </div>
        )}

        <p className="t-caption mt-14 max-w-2xl">
          Artiklene skrives og oppdateres av folk hos HelloSky som reiser rutene selv. Hver artikkel viser når den sist ble sett over. Finner du noe som ikke stemmer lenger, si fra til oss, så retter vi det.
        </p>
      </AppShell>
      <div className="mt-16"><SiteFooter /></div>
    </div>
  );
}
