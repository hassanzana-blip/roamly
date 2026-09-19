import { BedDouble, CarFront, Plane, Ship, type LucideIcon } from "lucide-react";
import type { I18nKey } from "@/lib/i18n";

/** The four services: Fly · Hotell · Leiebil · Cruise. */
export type ServiceId = "fly" | "hotell" | "bil" | "cruise";

export const SERVICES: { id: ServiceId; label: I18nKey; icon: LucideIcon; to: string }[] = [
  { id: "fly", label: "nav.flights", icon: Plane, to: "/" },
  { id: "hotell", label: "nav.hotels", icon: BedDouble, to: "/hotell" },
  { id: "bil", label: "nav.cars", icon: CarFront, to: "/leiebil" },
  { id: "cruise", label: "nav.cruise", icon: Ship, to: "/cruise" },
];
