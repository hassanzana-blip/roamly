import { Link } from "react-router";
import SkyMark from "@/components/brand/SkyMark";
import { destinationById, imageSrcSet } from "@/content/discover";
import { readingMinutes, TAG_LABELS, type Article } from "@/content/journal";
import { cn } from "@/lib/utils";

const fmtDate = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric" });

/** Ett bilde eller én typografisk flate; aldri et tomt grått felt. */
export function ArticleCover({ a, className, sizes }: { a: Article; className?: string; sizes?: string }) {
  const dest = a.hero ? destinationById(a.hero) : undefined;
  if (dest?.image) {
    return (
      <img
        src={dest.image}
        srcSet={imageSrcSet(dest.image)}
        sizes={sizes ?? "(max-width: 640px) 90vw, 400px"}
        alt={a.heroAlt ?? dest.imageAlt}
        loading="lazy"
        decoding="async"
        width={1024}
        height={640}
        className={cn("h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]", className)}
      />
    );
  }
  return (
    <span className={cn("relative flex h-full w-full flex-col justify-end overflow-hidden bg-night p-5 text-white", className)} aria-hidden="true">
      <SkyMark className="absolute -right-8 -top-10 h-[140%] w-auto text-primary opacity-[0.18]" />
      <span className="relative font-display text-[22px] leading-tight sm:text-[24px]">{a.title}</span>
    </span>
  );
}

export function ArticleMeta({ a, className }: { a: Article; className?: string }) {
  return (
    <span className={cn("flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground", className)}>
      <span className="font-semibold text-foreground">{TAG_LABELS[a.tags[0]]}</span>
      <span aria-hidden="true">·</span>
      <span>{readingMinutes(a)} min</span>
      <span aria-hidden="true">·</span>
      <span>Oppdatert {fmtDate.format(new Date(`${a.updated}T12:00:00`))}</span>
    </span>
  );
}

export default function ArticleCard({ a, className, wide = false }: { a: Article; className?: string; wide?: boolean }) {
  const dest = a.hero ? destinationById(a.hero) : undefined;
  const hasPhoto = Boolean(dest?.image);
  return (
    <Link to={`/journal/${a.slug}`} className={cn("press group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}>
      <span className={cn("relative block overflow-hidden rounded-xl bg-muted", wide ? "aspect-[16/9]" : "aspect-[4/3]")}>
        <ArticleCover a={a} sizes={wide ? "(max-width: 1024px) 100vw, 1024px" : undefined} />
      </span>
      <span className="block px-1 pt-3">
        <ArticleMeta a={a} />
        {hasPhoto && <span className={cn("mt-1.5 block font-display leading-tight", wide ? "text-[26px] sm:text-[34px]" : "text-[20px]")}>{a.title}</span>}
        <span className={cn("mt-1 block text-[14px] leading-relaxed text-muted-foreground", !wide && "line-clamp-2")}>{a.deck}</span>
      </span>
    </Link>
  );
}
