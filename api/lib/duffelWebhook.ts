import { createHmac, timingSafeEqual } from "node:crypto";

/** Maks alder på en webhook-hendelse (replay-beskyttelse). */
export const REPLAY_WINDOW_SEC = 300;

export type SignatureCheck =
  | { ok: true; timestamp: string }
  | { ok: false; reason: "missing" | "expired" | "invalid" };

/** Parse Duffel-signaturheaderen "t=...,v1=..." til nøkkel/verdi-par. */
export function parseSignatureHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

/** Lag en gyldig signatur — brukt av tester og verktøy. */
export function signPayload(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

/**
 * Verifiser X-Duffel-Signature mot rå body.
 * HMAC-SHA256 over "{timestamp}.{body}", konstant-tid sammenligning,
 * og replay-vindu på 5 minutter.
 */
export function verifyDuffelSignature(
  secret: string,
  signatureHeader: string,
  rawBody: string,
  nowMs = Date.now(),
): SignatureCheck {
  const parts = parseSignatureHeader(signatureHeader);
  const timestamp = parts.t;
  const received = parts.v1;
  if (!timestamp || !received) return { ok: false, reason: "missing" };

  const ageSec = Math.abs(nowMs / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > REPLAY_WINDOW_SEC) {
    return { ok: false, reason: "expired" };
  }

  const expected = signPayload(secret, timestamp, rawBody);
  const valid =
    expected.length === received.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  return valid ? { ok: true, timestamp } : { ok: false, reason: "invalid" };
}
