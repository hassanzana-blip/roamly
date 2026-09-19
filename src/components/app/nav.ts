import { Compass, Heart, Luggage, UserRound, type LucideIcon } from "lucide-react";
import type { I18nKey } from "@/lib/i18n";

/**
 * The four destinations of the product: discover and search, what you have
 * saved, your trips, and you. Shared by the phone tab bar and the desktop
 * navigation rail so the two never disagree.
 */
export type NavItem = { id: "explore" | "saved" | "trips" | "profile"; to: string; label: I18nKey; icon: LucideIcon; match: RegExp };

export const PRIMARY_NAV: NavItem[] = [
  { id: "explore", to: "/", label: "nav.explore", icon: Compass, match: /^$/ },
  { id: "saved", to: "/lagret", label: "nav.saved", icon: Heart, match: /^\/(lagret|tavler)(\/|$)/ },
  { id: "trips", to: "/reiser", label: "nav.trips", icon: Luggage, match: /^\/(reiser|reise|bekreftelse|kvittering|flystatus)(\/|$)/ },
  { id: "profile", to: "/profil", label: "nav.profile", icon: UserRound, match: /^\/(profil|logg-inn|velkommen|tilbakestill-passord|bekreft-epost)(\/|$)/ },
];

/** «Utforsk» owns every route the other three do not claim: search, hotels, cars, journal, destinations. */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.id !== "explore") return item.match.test(pathname);
  return !PRIMARY_NAV.some((o) => o.id !== "explore" && o.match.test(pathname));
}

/** Screens with their own sticky action (checkout, quote) and the admin tree hide the navigation. */
export const NAV_HIDDEN = [/^\/admin/, /^\/bestill/, /^\/bekreftelse/, /^\/tilbud/, /^\/velkommen/];
/** The phone tab bar also steps aside where a price bar owns the bottom edge (hotel detail). */
export const TABBAR_HIDDEN = [...NAV_HIDDEN, /^\/hotell\/./];
