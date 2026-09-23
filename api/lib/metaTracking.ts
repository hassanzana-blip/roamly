import { randomUUID } from "node:crypto";
import { getDb } from "../queries/connection";
import { providerClicks, searchEvents } from "../../db/schema";
import { log } from "./logger";

/**
 * Målingen bak metasøket.
 *
 * HelloSky tjener penger når noen klikker seg videre til en leverandør og
 * bestiller der. Fram til nå målte vi ingen av delene. Her skrives de to
 * radene som gjør resten mulig: søket som ble gjort, og klikket som forlot
 * siden.
 *
 * To regler gjelder begge:
 *
 *  1. **Ingen personopplysninger.** Ingen IP, ingen user-agent-streng, ingen
 *     fri tekst fra klienten. Bare rute, datoer, antall reisende, marked og
 *     enhetstype – nok til å drive et selskap, for lite til å peke på noen.
 *  2. **Målingen får aldri velte søket.** En feil her logges og svelges.
 *     Ingen skal miste flysøket sitt fordi en analysetabell er treg.
 */

/** «mobile» | «tablet» | «desktop» – grovt nok til å være nyttig, for grovt til å spore. */
export function deviceFrom(userAgent: string | undefined): string {
  const ua = (userAgent ?? "").toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return "tablet";
  if (/mobi|iphone|android/.test(ua)) return "mobile";
  return ua ? "desktop" : "unknown";
}

/** Landet forespørselen kom fra, når plattformen oppgir det. Ellers null. */
export function marketFrom(headers: { get(name: string): string | null }): string | null {
  const raw = headers.get("cf-ipcountry") ?? headers.get("x-vercel-ip-country") ?? headers.get("x-country");
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export type SearchEventInput = {
  sessionRef?: string | null;
  originIata: string;
  destinationIata: string;
  departDate: string;
  returnDate?: string | null;
  adults: number;
  children: number;
  infants: number;
  cabin: string;
  provider?: string | null;
  resultCount: number;
  lowestPriceMinor?: number | null;
  currency?: string | null;
  durationMs?: number | null;
  errorCode?: string | null;
  device?: string | null;
  market?: string | null;
  sandbox: boolean;
};

/**
 * Ett søk. Skrives etter at svaret er sendt, aldri før – målingen skal ikke
 * legge millisekunder på tiden kunden venter.
 */
export async function recordSearchEvent(input: SearchEventInput): Promise<void> {
  try {
    const db = getDb();
    await db.insert(searchEvents).values({
      sessionRef: input.sessionRef ?? null,
      originIata: input.originIata.toUpperCase().slice(0, 3),
      destinationIata: input.destinationIata.toUpperCase().slice(0, 3),
      departDate: input.departDate.slice(0, 10),
      returnDate: input.returnDate?.slice(0, 10) ?? null,
      adults: input.adults,
      children: input.children,
      infants: input.infants,
      cabin: input.cabin.slice(0, 16),
      provider: input.provider?.slice(0, 32) ?? null,
      resultCount: input.resultCount,
      lowestPriceMinor: input.lowestPriceMinor ?? null,
      currency: input.currency?.slice(0, 3) ?? null,
      durationMs: input.durationMs ?? null,
      errorCode: input.errorCode?.slice(0, 64) ?? null,
      device: input.device?.slice(0, 16) ?? null,
      market: input.market?.slice(0, 8) ?? null,
      sandbox: input.sandbox,
    });
  } catch (err) {
    // Et tapt analysepunkt er en ulempe. Et tapt søk er en mistet kunde.
    log.warn({ err: String(err).slice(0, 200) }, "søkemåling feilet – søket er upåvirket");
  }
}

export type ProviderClickInput = {
  customerId?: number | null;
  sessionRef?: string | null;
  provider: string;
  sellerName?: string | null;
  originIata: string;
  destinationIata: string;
  departDate: string;
  returnDate?: string | null;
  adults: number;
  children: number;
  infants: number;
  cabin: string;
  carrierIata?: string | null;
  stops?: number | null;
  shownPriceMinor?: number | null;
  currency?: string | null;
  device?: string | null;
  market?: string | null;
  sandbox: boolean;
};

/**
 * Ett klikk ut av HelloSky.
 *
 * Returnerer referansen vi lagret. Den er nøkkelen en leverandør senere kan
 * matche en konvertering mot – uten den er provisjonen et tall uten opphav.
 */
export async function recordProviderClick(input: ProviderClickInput): Promise<string | null> {
  const clickRef = randomUUID();
  try {
    const db = getDb();
    await db.insert(providerClicks).values({
      clickRef,
      customerId: input.customerId ?? null,
      sessionRef: input.sessionRef ?? null,
      provider: input.provider.slice(0, 32),
      sellerName: input.sellerName?.slice(0, 120) ?? null,
      originIata: input.originIata.toUpperCase().slice(0, 3),
      destinationIata: input.destinationIata.toUpperCase().slice(0, 3),
      departDate: input.departDate.slice(0, 10),
      returnDate: input.returnDate?.slice(0, 10) ?? null,
      adults: input.adults,
      children: input.children,
      infants: input.infants,
      cabin: input.cabin.slice(0, 16),
      carrierIata: input.carrierIata?.toUpperCase().slice(0, 3) ?? null,
      stops: input.stops ?? null,
      shownPriceMinor: input.shownPriceMinor ?? null,
      currency: input.currency?.slice(0, 3) ?? null,
      device: input.device?.slice(0, 16) ?? null,
      market: input.market?.slice(0, 8) ?? null,
      sandbox: input.sandbox,
    });
    return clickRef;
  } catch (err) {
    log.warn({ err: String(err).slice(0, 200) }, "klikkmåling feilet – utgående lenke er upåvirket");
    return null;
  }
}
