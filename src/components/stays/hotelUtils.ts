import type { useT } from "@/lib/i18n";

/** KAYAK InclusionType → tekst. Ukjente koder vises ikke. */
export function inclusionLabel(code: number, t: ReturnType<typeof useT>): string | null {
  switch (code) {
    case 0: return t("ht.incl.breakfast");
    case 1: return t("ht.incl.lunch");
    case 2: return t("ht.incl.dinner");
    case 3: return t("ht.incl.meals");
    case 4: return t("ht.incl.allinclusive");
    default: return null;
  }
}

