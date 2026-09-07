import { env } from "./env";

/**
 * Origin-kontroll for muterende kall (CSRF-forsvar i dybden, OTA-076).
 *
 * Cookies er SameSite, men Origin-sjekken stopper også eldre nettlesere og
 * subdomene-angrep. To ting slipper gjennom:
 *
 *  1. Samme opprinnelse: Origin-verten er den verten nettleseren faktisk kalte.
 *     Da virker alle domenene appen serveres på (apex, www, Railway-domenet,
 *     forhåndsvisninger) uten at APP_BASE_URL må liste dem opp. En angriper
 *     kan ikke forfalske dette: nettleseren setter Origin til angriperens eget
 *     domene, og verts-headeren kan ikke overstyres på tvers av opprinnelser.
 *  2. Eksplisitt tillatte opprinnelser: APP_BASE_URL, pluss lokale utviklings-
 *     verter utenfor produksjon.
 *
 * Kall uten Origin (samme-opphav GET, curl, serverkall) slipper gjennom —
 * nettlesere sender alltid Origin på muterende forespørsler.
 */

const configured = new Set<string>([new URL(env.baseUrl).origin]);
if (!env.isProduction) {
  for (const o of ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"]) {
    configured.add(o);
  }
}

/** Verten (host[:port]) i en opprinnelse, eller null hvis den ikke kan tolkes. */
function hostOfOrigin(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Verten nettleseren faktisk adresserte, sett bak Railways proxy. */
function selfHost(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  return (forwarded || headers.get("host") || "").toLowerCase();
}

export function isAllowedOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;
  if (configured.has(origin)) return true;
  const originHost = hostOfOrigin(origin);
  if (!originHost) return false;
  const host = selfHost(headers);
  return host !== "" && originHost === host;
}

/** Kun for logging — aldri hele headeren, aldri videre til klienten. */
export function shortOrigin(headers: Headers): string {
  return (headers.get("origin") ?? "").slice(0, 120);
}
