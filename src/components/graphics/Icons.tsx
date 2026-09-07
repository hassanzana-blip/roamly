import type { ReactElement } from "react";
import {
  ArrowLeftRight, Ban, BedDouble, Briefcase, Bus, BusFront, Car, CarTaxiFront, ChevronsUp, Clock3, Coffee, Cookie, Footprints, Hash, Headset, IdCard, Lock, Luggage, MailCheck, MapPin,
  Plug, QrCode, RotateCcw, ShieldCheck, Sofa, Star, Ticket, TrainFront, TramFront, Tv, Usb, Users, Utensils, Waves, Wifi, CircleParking, Armchair, type LucideIcon,
} from "lucide-react";
import { CabinBagGlyph, CheckedBagGlyph } from "./Baggage";
import { SeatGlyph } from "./Seats";
import { BoardingPassGlyph, PassportGlyph, VisaStampGlyph, LuggageTagGlyph } from "./Documents";
import type { GlyphProps } from "./Glyph";

/**
 * Named icon maps. Lucide first; custom glyphs only where Lucide has no
 * travel-specific shape (bags, seats, documents). Render only keys that
 * real supplier or product data supports.
 */
type IconLike = LucideIcon | ((p: GlyphProps) => ReactElement);

export const AMENITY_ICONS = {
  wifi: Wifi,
  usb: Usb,
  power: Plug,
  meal: Utensils,
  snack: Cookie,
  entertainment: Tv,
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
  rental_car: Car,
  taxi: CarTaxiFront,
  private_transfer: CarTaxiFront,
  train: TrainFront,
  bus: Bus,
  metro: TramFront,
  shuttle: BusFront,
  walk: Footprints,
} satisfies Record<string, LucideIcon>;
export type TransportKey = keyof typeof TRANSPORT_ICONS;

export const HOTEL_ICONS = {
  bed: BedDouble,
  guests: Users,
  breakfast: Coffee,
  wifi: Wifi,
  pool: Waves,
  parking: CircleParking,
  shuttle: BusFront,
  distance: MapPin,
  score: Star,
  refundable: RotateCcw,
  pay_later: Clock3,
} satisfies Record<string, LucideIcon>;

export const TRUST_ICONS = {
  secure_payment: Lock,
  confirmation_sent: MailCheck,
  support: Headset,
  booking_reference: Hash,
  protected_checkout: ShieldCheck,
} satisfies Record<string, LucideIcon>;

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
