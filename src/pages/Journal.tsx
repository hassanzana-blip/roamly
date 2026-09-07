import { useMemo } from "react";
import { useSearchParams } from "react-router";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import SiteFooter from "@/components/layout/SiteFooter";
import ArticleCard from "@/components/journal/ArticleCard";
import { Chip } from "@/components/account/AccountRow";
import { articlesByTag, featured, TAG_LABELS, tagsInUse, type JournalTag } from "@/content/journal";
import { PAGE_META, breadcrumbJsonLd, itemListJsonLd, usePageMeta } from "@/lib/seo";

/**
 * HelloSky Journal – nyttig, ikke pent. Én stor sak øverst, så alt annet.
 * Ingen «trending», ingen tellere; rekkefølgen er sist oppdatert først.
 */
export default function Journal() {
  const [params, setParams] = useSearchParams();
  const tags = tagsInUse();
  const tag = (tags as string[]).includes(params.get("t") ?? "") ? (params.get("t") as JournalTag) : "alle";
  const list = useMemo(() => articlesByTag(tag), [tag]);
  const lead = tag === "alle" ? featured()[0] : list[0];
  const rest = list.filter((a) => a.slug !== lead?.slug);

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
        <p className="-mt-2 max-w-2xl text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
          Det vi faktisk vet om reisen: bagasje, mellomlandinger, barn og rutene hjem. Ingen priser, ingen visumregler som tall. Bare det som holder seg.
        </p>

        <div className="no-scrollbar -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8" role="group" aria-label="Tema">
          <Chip active={tag === "alle"} onClick={() => setParams({}, { replace: true })}>Alle</Chip>
          {tags.map((t) => (
            <Chip key={t} active={tag === t} onClick={() => setParams({ t }, { replace: true })}>{TAG_LABELS[t]}</Chip>
          ))}
        </div>

        {lead && (
          <div className="mt-8">
            <ArticleCard a={lead} wide />
          </div>
        )}

        <div className="mt-10 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((a) => <ArticleCard key={a.slug} a={a} />)}
        </div>

        <p className="mt-12 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Artiklene skrives og oppdateres av folk hos HelloSky som reiser rutene selv. Hver artikkel viser når den sist ble sett over. Finner du noe som ikke stemmer lenger, si fra til oss, så retter vi det.
        </p>
      </AppShell>
      <div className="mt-16"><SiteFooter /></div>
    </div>
  );
}
