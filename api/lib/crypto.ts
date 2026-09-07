import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { env } from "./env";

// ─── Feltkryptering for PII (AES-256-GCM) ────────────────────────────────────
// Format: base64url(iv[12]) . base64url(tag[16]) . base64url(ciphertext)
// Nøkkel: PII_ENCRYPTION_KEY (32 byte base64). I dev/test uten nøkkel brukes
// en deterministisk utledet nøkkel og det logges en advarsel — ALDRI i prod
// (assertProductionSafety krever nøkkelen).

function key(): Buffer {
  if (env.PII_ENCRYPTION_KEY) {
    const k = Buffer.from(env.PII_ENCRYPTION_KEY, "base64");
    if (k.length !== 32) throw new Error("PII_ENCRYPTION_KEY må være 32 byte base64");
    return k;
  }
  if (env.isProdEnv) throw new Error("PII_ENCRYPTION_KEY mangler");
  return createHash("sha256").update("hellosky-dev-only-key").digest();
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

export function decryptField(payload: string): string {
  const [iv, tag, ct] = payload.split(".");
  if (!iv || !tag || !ct) throw new Error("Ugyldig kryptert felt");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

export function last4(value: string): string {
  return value.slice(-4).padStart(Math.min(4, value.length), "*");
}

export function maskIdentifier(value: string): string {
  if (value.length <= 4) return "****";
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}
