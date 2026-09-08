import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import Icon from "@/components/app/Icon";
import { TypeCover, type CoverVariant } from "@/components/journal/TypeCover";
import { imageSrcSet } from "@/content/discover";
import { readingMinutes, TAG_LABELS, type Article } from "@/content/journal";
import { articlePhoto } from "@/components/journal/articlePhoto";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const fmtDate = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric" });


/** Ett bilde eller én typografisk flate; aldri et tomt grått felt. */
export function ArticleCover({
  a,
  variant = "ink",
  forceType = false,
  size = "md",
  mode = "title",
  className,
  sizes,
}: {
  a: Article;
  variant?: CoverVariant;
  /** Bruk typografisk omslag selv om fotoet finnes, f.eks. når det ville gjentatt heroen over. */
  forceType?: boolean;
  size?: "sm" | "md" | "lg";
  /** Hva den typografiske flaten bærer: tittelen, kategorien (når tittelen står ved siden av) eller ingenting (miniatyr). */
  mode?: "title" | "category" | "none";
  className?: string;
  sizes?: string;
}) {
  const photo = forceType ? undefined : articlePhoto(a);
  if (photo) {
    return (
      <img
        src={photo.src}
        srcSet={imageSrcSet(photo.src)}
        sizes={sizes ?? "(max-width: 640px) 90vw, 400px"}
        alt={photo.alt}
        loading="lazy"
        decoding="async"
        width={1024}
        height={640}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  const category = TAG_LABELS[a.tags[0]];
  return (
    <TypeCover
      variant={variant}
      size={size}
      title={mode === "title" ? a.title : mode === "category" ? category : undefined}
      label={mode === "category" ? "Journal" : undefined}
      className={className}
    />
  );
}

/** «Kategori · 3 min · Oppdatert 7. sep. 2026» – enkle midtprikker, én linje. */
export function ArticleMeta({ a, withCategory = true, className }: { a: Article; withCategory?: boolean; className?: string }) {
  const t = useT();
  const rest = `${t("journal.minutes", { count: readingMinutes(a) })} · ${t("journal.updated", { date: fmtDate.format(new Date(`${a.updated}T12:00:00`)) })}`;
  return (
    <span className={cn("t-caption block", className)}>
      {withCategory ? (
        <>
          <span className="font-semibold text-foreground">{TAG_LABELS[a.tags[0]]}</span>
          {` · ${rest}`}
        </>
      ) : (
        rest
      )}
    </span>
  );
}

export type ArticleCardProps = {
  a: Article;
  className?: string;
  /** Typografisk variant når artikkelen ikke har foto. Gi naboer ulik variant. */
  variant?: CoverVariant;
  /** Bruk typografisk omslag selv om fotoet finnes (unngår at samme foto står to ganger på en side). */
  forceType?: boolean;
  /** stack: omslag over tekst (rutenett). row: miniatyr til venstre (sekundær). lead: omslag ved siden av stor tittel (toppsak). */
  layout?: "stack" | "row" | "lead";
};

const LINK =
  "press img-zoom group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export default function ArticleCard({ a, className, variant = "ink", forceType = false, layout = "stack" }: ArticleCardProps) {
  const t = useT();
  const hasPhoto = !forceType && Boolean(articlePhoto(a));
  const href = `/journal/${a.slug}`;

  if (layout === "lead") {
    return (
      <Link to={href} className={cn(LINK, "grid gap-5 md:grid-cols-2 md:items-center md:gap-8 lg:gap-12", className)}>
        <span className="block aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
          <ArticleCover a={a} variant={variant} forceType={forceType} size="lg" mode="category" sizes="(max-width: 768px) 100vw, 50vw" />
        </span>
        <span className="block md:pr-4">
          <ArticleMeta a={a} />
          <span className="t-h1 mt-3 block">{a.title}</span>
          <span className="t-lead mt-4 block text-muted-foreground">{a.deck}</span>
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold">
            {t("journal.readArticle")} <Icon icon={ArrowRight} size={16} />
          </span>
        </span>
      </Link>
    );
  }

  if (layout === "row") {
    return (
      <Link to={href} className={cn(LINK, "grid grid-cols-[104px_minmax(0,1fr)] gap-4 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-5", className)}>
        <span className="block aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
          <ArticleCover a={a} variant={variant} forceType={forceType} size="sm" mode="none" sizes="144px" />
        </span>
        <span className="block min-w-0">
          <ArticleMeta a={a} />
          <span className="mt-1.5 block font-display text-[19px] leading-[1.2] sm:text-[20px]">{a.title}</span>
          <span className="mt-1 line-clamp-2 block text-[14px] leading-relaxed text-muted-foreground">{a.deck}</span>
        </span>
      </Link>
    );
  }

  return (
    <Link to={href} className={cn(LINK, className)}>
      <span className="block aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
        <ArticleCover a={a} variant={variant} forceType={forceType} mode="title" />
      </span>
      <span className="block px-1 pt-3">
        <ArticleMeta a={a} />
        {hasPhoto && <span className="mt-1.5 block font-display text-[20px] leading-[1.2]">{a.title}</span>}
        <span className="mt-1 line-clamp-2 block text-[14px] leading-relaxed text-muted-foreground">{a.deck}</span>
      </span>
    </Link>
  );
}
