import type { ReactElement } from "react";
import {
  ArrowLeftRight, Ban, BedDouble, Briefcase, BusFront, ChevronsUp, Clock3, Coffee, Cookie, Footprints, Hash, IdCard, Luggage, MapPin,
  QrCode, RotateCcw, ShieldCheck, Sofa, Star, Ticket, TramFront, Usb, Users, Waves, CircleParking, Armchair, type LucideIcon,
} from "lucide-react";
import { CabinBagGlyph, CheckedBagGlyph } from "./Baggage";
import { SeatGlyph } from "./Seats";
import { BoardingPassGlyph, PassportGlyph, VisaStampGlyph, LuggageTagGlyph } from "./Documents";
import type { GlyphProps } from "./Glyph";
import { HsBus, HsCar, HsConfirmation, HsEntertainment, HsMeal, HsPower, HsSecurePayment, HsSupport, HsTaxi, HsTrain, HsWifi } from "./pack";

/**
 * Named icon maps. Official HelloSky pack first, Lucide for the rest. Render only keys that
 * real supplier or product data supports.
 */
type IconLike = LucideIcon | ((p: GlyphProps) => ReactElement);

export const AMENITY_ICONS = {
  wifi: HsWifi,
  usb: Usb,
  power: HsPower,
  meal: HsMeal,
  snack: Cookie,
  entertainment: HsEntertainment,
  lie_flat: Sofa,
  extra_legroom: Armchair,
  lounge: Coffee,
  priority_boarding: ChevronsUp,
  checked_bag: CheckedBagGlyph,
  cabin_bag: CabinBagGlyph,
  seat_selection: SeatGlyph,
  changeable: ArrowLeftRight,
  refundable: RotateCcw,
  non_refundable: Ban,
  carry_on_only: Briefcase,
} satisfies Record<string, IconLike>;
export type AmenityKey = keyof typeof AMENITY_ICONS;

export const TRANSPORT_ICONS = {
  rental_car: HsCar,
  taxi: HsTaxi,
  private_transfer: HsTaxi,
  train: HsTrain,
  bus: HsBus,
  metro: TramFront,
  shuttle: BusFront,
  walk: Footprints,
} satisfies Record<string, IconLike>;
export type TransportKey = keyof typeof TRANSPORT_ICONS;

export const HOTEL_ICONS = {
  bed: BedDouble,
  guests: Users,
  breakfast: Coffee,
  wifi: HsWifi,
  pool: Waves,
  parking: CircleParking,
  shuttle: BusFront,
  distance: MapPin,
  score: Star,
  refundable: RotateCcw,
  pay_later: Clock3,
} satisfies Record<string, IconLike>;

export const TRUST_ICONS = {
  secure_payment: HsSecurePayment,
  confirmation_sent: HsConfirmation,
  support: HsSupport,
  booking_reference: Hash,
  protected_checkout: ShieldCheck,
} satisfies Record<string, IconLike>;

export const DOCUMENT_ICONS = {
  passport: PassportGlyph,
  id: IdCard,
  visa: VisaStampGlyph,
  boarding_pass: BoardingPassGlyph,
  ticket: Ticket,
  qr: QrCode,
  luggage_tag: LuggageTagGlyph,
  luggage: Luggage,
} satisfies Record<string, IconLike>;
