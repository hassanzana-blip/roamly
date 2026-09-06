import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Kryptografisk sterkt token (base64url, 32 byte entropi). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 hex — slik lagres aldri råtokens i databasen. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Tidsikker sammenligning av hex-strenger. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Kort lesbar referanse, f.eks. til tilbud og saker (unngår forvekslings-tegn). */
export function humanReference(prefix: string, length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${prefix}-${out}`;
}
