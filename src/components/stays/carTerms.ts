import type { CarOffer } from "@contracts/cars";
import type { I18nKey } from "@/lib/i18n";

const FUEL_KEYS: Record<string, I18nKey> = { fullToFull: "cr.fuel.fullToFull", sameToSame: "cr.fuel.sameToSame", prepaid: "cr.fuel.prepaid", fullToEmpty: "cr.fuel.prepaid" };
const BADGE_KEYS: Record<string, I18nKey> = { payAtPickup: "cr.badge.payAtPickup", payLater: "cr.badge.payAtPickup", payNow: "cr.badge.payNow" };
const FEATURE_KEYS: Record<string, I18nKey> = { ac: "cr.feature.ac", gps: "cr.feature.gps", navigation: "cr.feature.gps", bluetooth: "cr.feature.bluetooth", fourWheelDrive: "cr.feature.fourWheelDrive", awd: "cr.feature.fourWheelDrive", electric: "cr.feature.electric", hybrid: "cr.feature.hybrid" };
export const LOCATION_KEYS: Record<string, I18nKey> = { inTerminal: "cr.loc.inTerminal", shuttle: "cr.loc.shuttle", meetAndGreet: "cr.loc.meetAndGreet", offAirport: "cr.loc.offAirport" };

/**
 * Vilkår på kundens språk. Leverandøren sender koder med engelsk tekst; vi
 * oversetter kodene vi kjenner og utelater resten (reklamemerker som «Great
 * Deal» hører ikke hjemme her). Fullstendige vilkår står hos utleieren.
 */
export function carTerms(car: CarOffer, t: (key: I18nKey, params?: Record<string, string | number>) => string): string[] {
  const out: string[] = [];
  if (car.mileage?.code === "unlimited") out.push(t("cr.mileage.unlimited"));
  else if (car.mileage?.code === "limited" && car.mileage.limit) out.push(t("cr.mileage.limited", { limit: car.mileage.limit, unit: t(car.mileage.unit === "km" ? "cr.unit.km" : "cr.unit.mi") }));
  if (car.freeCancellation) out.push(car.cancellationLimitHours ? t("cr.cancel.until", { hours: car.cancellationLimitHours }) : t("cr.cancel.free"));
  const fuelKey = car.fuelPolicy ? FUEL_KEYS[car.fuelPolicy.code] : undefined;
  if (fuelKey) out.push(t(fuelKey));
  for (const b of car.badges) {
    const k = BADGE_KEYS[b.code];
    if (k) out.push(t(k));
  }
  for (const f of car.features) {
    const k = FEATURE_KEYS[f.code];
    if (k) out.push(t(k));
  }
  return Array.from(new Set(out));
}

