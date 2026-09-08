/**
 * Delingslenker for ReiseMatch og reisetavler.
 *
 * Tokenet i lenken og nøkkelen som identifiserer en deltaker lages av
 * `randomToken()` (base64url). Klienten og serveren har hver hatt sitt eget
 * regulære uttrykk for formatet, og da de to kom i utakt ble hver eneste
 * delingslenke laget riktig og avvist ved åpning. Formatet defineres derfor
 * her, ett sted, og utledes fra antallet byte generatoren faktisk bruker.
 */

export const SHARE_TOKEN_BYTES = 12;
export const SHARE_KEY_BYTES = 16;

/** Antall tegn base64url gir for n byte (uten utfylling). */
function base64urlLength(bytes: number): number {
  return Math.ceil((bytes * 4) / 3);
}

const ALPHABET = "[A-Za-z0-9_-]";

export const SHARE_TOKEN_RE = new RegExp(`^${ALPHABET}{${base64urlLength(SHARE_TOKEN_BYTES)}}$`);
export const SHARE_KEY_RE = new RegExp(`^${ALPHABET}{${base64urlLength(SHARE_KEY_BYTES)}}$`);

export function isShareToken(value: string): boolean {
  return SHARE_TOKEN_RE.test(value);
}
