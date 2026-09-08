import { webcrypto } from "node:crypto";
import { NobleCryptoPlugin, ScureBase32Plugin, generate, generateSecret, generateURI, verify } from "otplib";

// otplib v13 — eksplisitte plugin-instanser (ingen global tilstand)
const crypto = new NobleCryptoPlugin();
const base32 = new ScureBase32Plugin();

export function newTotpSecret(): string {
  return generateSecret({ base32 });
}

export function totpUri(email: string, secret: string): string {
  return generateURI({ issuer: "HelloSky", label: email, secret });
}

/**
 * Koden en autentikator-app ville vist akkurat nå.
 *
 * Finnes for at testene skal kunne bevise at porten holder, uten å måtte
 * gjette seks siffer. Brukes aldri av produktet selv.
 */
export async function currentTotp(secret: string): Promise<string> {
  const result = await generate({ secret, crypto, base32 });
  return typeof result === "string" ? result : String((result as { token?: string }).token ?? result);
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
  webcrypto.getRandomValues(bytes);
  for (let i = 0; i < count; i++) {
    let code = "";
    for (let j = 0; j < 8; j++) code += alphabet[bytes[i * 8 + j] % alphabet.length];
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}
