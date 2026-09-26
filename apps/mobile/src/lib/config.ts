/**
 * Appens eneste konfigurasjon: adressen til HelloSkys server.
 *
 * EXPO_PUBLIC_-variabler bygges inn i appen og er offentlige. Her står aldri
 * nøkler eller hemmeligheter – leverandørnøkler finnes bare på serveren.
 */

export type ApiBase = { ok: true; url: string } | { ok: false; message: string };

const LOCAL_HOST = /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/i;
const HTTPS_ORIGIN = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i;

export function resolveApiBase(raw: string | undefined, isDev: boolean): ApiBase {
  const value = (raw ?? "").trim().replace(/\/+$/, "");
  if (!value) return { ok: false, message: "Appen mangler serveradresse (EXPO_PUBLIC_API_BASE_URL)." };
  if (HTTPS_ORIGIN.test(value)) return { ok: true, url: value };
  if (isDev && LOCAL_HOST.test(value)) return { ok: true, url: value };
  return { ok: false, message: "Serveradressen må være https (http er bare lov mot en lokal server under utvikling)." };
}

// Må leses som `process.env.EXPO_PUBLIC_API_BASE_URL` direkte – Expo bytter ut akkurat dette uttrykket ved bygging.
export const API_BASE: ApiBase = resolveApiBase(process.env.EXPO_PUBLIC_API_BASE_URL, typeof __DEV__ !== "undefined" && __DEV__);

/**
 * HelloSkys offentlige nettsider (hjelp og kontakt, personvern, vilkår, om
 * oss). Faste, offentlige adresser – ikke konfigurasjon. Kontaktkanalene står
 * på hjelpesiden, så appen dikter aldri opp et nummer eller en adresse.
 *
 * Kundens egne sider på nettet (reiser, lagrede reisende, prisvarsler og
 * sikkerhet) finnes bare der; Min side lenker til dem i stedet for å vise
 * noe appen ikke har. Nettet ber om innlogging første gang.
 */
export const WEB_BASE = "https://hellosky.no";
export const WEB_PAGES = {
  help: `${WEB_BASE}/hjelp`,
  privacy: `${WEB_BASE}/personvern`,
  terms: `${WEB_BASE}/vilkar`,
  about: `${WEB_BASE}/om-oss`,
  trips: `${WEB_BASE}/reiser`,
  travellers: `${WEB_BASE}/profil/reisende`,
  priceAlerts: `${WEB_BASE}/profil/prisvarsler`,
  /** Prisovervåking (kontoens price_watches) – det mobileAccount.hub teller som aktive prisvarsler. */
  priceWatches: `${WEB_BASE}/profil/prisovervaking`,
  notifications: `${WEB_BASE}/profil/varsler`,
  /** E-post- og varselvalg for kontoen. */
  notificationSettings: `${WEB_BASE}/profil/innstillinger`,
  security: `${WEB_BASE}/profil/sikkerhet`,
} as const;
