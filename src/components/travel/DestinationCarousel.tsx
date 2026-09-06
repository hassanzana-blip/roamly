import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { MotionConfig, motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { DiscoverDestination } from "@/content/discover";
import DestinationCard from "@/components/travel/DestinationCard";
import { useFavourites } from "@/lib/favourites";

/**
 * Roamly destination carousel.
 *
 * Pattern adapted from the Kokonut UI carousel-cards concept (MIT,
 * kokonutui.com) — image-led cards with horizontal browsing, favourites
 * and compact supporting details — rebuilt for Roamly on native CSS
 * scroll-snap: no carousel dependency, natural touch/trackpad behaviour
 * and no vertical-scroll trapping.
 *
 * Accessibility: the strip is a labelled region, arrow controls are
 * 44 px touch targets that reflect real scroll boundaries, cards are
 * links while favourites are separate buttons with aria-pressed, and
 * scrolling honours prefers-reduced-motion.
 */

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  destinations: DiscoverDestination[];
  /** Real destination for “Se alle” — never a hardcoded “#” */
  viewAllHref: string;
  /** Optional controlled favourites (falls back to localStorage hook) */
  favourites?: Set<string>;
  onToggleFavourite?: (id: string) => void;
};

export default function DestinationCarousel({
  eyebrow,
  title,
  description,
  destinations,
  viewAllHref,
  favourites,
  onToggleFavourite,
}: Props) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const [internalFavs, internalToggle] = useFavourites();
  const favs = favourites ?? internalFavs;
  const toggle = onToggleFavourite ?? internalToggle;

  const updateBounds = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  /* Recalculate boundaries on mount, resize and when the data changes */
  useEffect(() => {
    updateBounds();
    const el = stripRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(updateBounds);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateBounds, destinations.length]);

  const scrollByPage = useCallback((dir: 1 | -1) => {
    const el = stripRef.current;
    if (!el) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* Scroll distance follows the actual viewport of the strip */
    el.scrollBy({
      left: dir * Math.max(el.clientWidth * 0.85, 240),
      behavior: reduced ? "auto" : "smooth",
    });
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollByPage(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollByPage(-1);
    }
  };

  /* Empty data renders sensibly — nothing, rather than broken controls */
  if (destinations.length === 0) return null;
  const showControls = destinations.length > 1;

  return (
    <section aria-label={title} className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="max-w-xl">
          {eyebrow && (
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              {eyebrow}
            </p>
          )}
          <h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            {title}
          </h2>
          {description && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={viewAllHref}
            className="whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Se alle
          </Link>
          {showControls && (
            <div className="hidden gap-2 sm:flex">
              <button
                type="button"
                onClick={() => scrollByPage(-1)}
                disabled={!canPrev}
                aria-label="Bla til venstre"
                className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-foreground transition-all enabled:hover:border-primary enabled:hover:text-primary disabled:opacity-30"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollByPage(1)}
                disabled={!canNext}
                aria-label="Bla til høyre"
                className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-foreground transition-all enabled:hover:border-primary enabled:hover:text-primary disabled:opacity-30"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={stripRef}
        onScroll={updateBounds}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="region"
        aria-label={`${title} — bla i ${destinations.length} reisemål`}
        className="snap-row no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 pt-1 outline-none [overscroll-behavior-x:contain] [touch-action:pan-x_pan-y] focus-visible:ring-2 focus-visible:ring-ring sm:-mx-6 sm:px-6"
      >
        {/* Brief entrance stagger; MotionConfig honours prefers-reduced-motion */}
        <MotionConfig reducedMotion="user">
          {destinations.map((d, i) => (
            <motion.div
              key={d.id}
              className="shrink-0"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -32px 0px" }}
              transition={{
                duration: 0.38,
                delay: Math.min(i * 0.05, 0.3),
                ease: "easeOut",
              }}
            >
              <DestinationCard
                destination={d}
                isFavourite={favs.has(d.id)}
                onToggleFavourite={toggle}
              />
            </motion.div>
          ))}
        </MotionConfig>
      </div>
    </section>
  );
}
