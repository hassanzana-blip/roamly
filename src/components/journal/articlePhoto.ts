import { destinationById } from "@/content/discover";
import type { Article } from "@/content/journal";

/** Det verifiserte fotoet artikkelen peker på, om det finnes. */
export function articlePhoto(a: Article): { src: string; alt: string } | undefined {
  const dest = a.hero ? destinationById(a.hero) : undefined;
  return dest?.image ? { src: dest.image, alt: a.heroAlt ?? dest.imageAlt } : undefined;
}
