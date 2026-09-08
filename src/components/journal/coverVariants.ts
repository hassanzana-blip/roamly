import type { CoverVariant } from "@/components/journal/TypeCover";

export const COVER_VARIANTS: CoverVariant[] = ["ink", "lime", "paper"];

/** Variant for kort nr. i i et rutenett: naboer til venstre/høyre og over/under (tre kolonner) får alltid ulik variant. */
export function coverVariantAt(i: number): CoverVariant {
  return COVER_VARIANTS[(i + Math.floor(i / 3)) % 3];
}
