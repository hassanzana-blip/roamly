import { NobleCryptoPlugin, ScureBase32Plugin, generateSecret, generateURI, verify } from "otplib";

// otplib v13 — eksplisitte plugin-instanser (ingen global tilstand)
const crypto = new NobleCryptoPlugin();
const base32 = new ScureBase32Plugin();

export function newTotpSecret(): string {
  return generateSecret({ base32 });
}

export function totpUri(email: string, secret: string): string {
  return generateURI({ issuer: "Roamly", label: email, secret });
}

export async function verifyTotp(secret: string, token: string): Promise<boolean> {
  const clean = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const result = await verify({ token: clean, secret, crypto, base32 });
  return result.valid === true;
}

/** Genererer engangskoder for gjenoppretting (returnerer klartekst én gang). */
export function generateRecoveryCodes(count = 8): string[] {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codes: string[] = [];
  const bytes = new Uint8Array(count * 8);
  (globalThis.crypto ?? require("node:crypto").webcrypto).getRandomValues(bytes);
  for (let i = 0; i < count; i++) {
    let code = "";
    for (let j = 0; j < 8; j++) code += alphabet[bytes[i * 8 + j] % alphabet.length];
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}
