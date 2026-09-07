import pino from "pino";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { env } from "./env";

// ─── Strukturert logging med request-/korrelasjons-ID ────────────────────────
// Bruk: log.info({ bookingId }, "melding"). Aldri logg tokens, koder, kortdata,
// passnummer eller fulle payloads. `redact` fjerner de vanligste feltene.

export type LogContext = { requestId: string; bookingId?: number; attemptId?: number; staffId?: number; customerId?: number };
export const logContext = new AsyncLocalStorage<LogContext>();

const base = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "password", "*.password", "token", "*.token", "code", "otp", "authorization",
      "*.uniqueIdentifier", "*.identifierCiphertext", "card", "*.card", "cookie", "*.cookie",
      "req.headers.cookie", "req.headers.authorization",
    ],
    censor: "[redacted]",
  },
  mixin() {
    const ctx = logContext.getStore();
    return ctx ? { ...ctx } : {};
  },
  // pino-pretty kun i ubundlet dev (transport-worker kan ikke lastes fra esbuild-bundle)
  ...(!env.isProduction && process.env.BUNDLED !== "true"
    ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } }
    : {}),
});

export const log = base;

export function newRequestId(header?: string | null): string {
  if (header && /^[A-Za-z0-9._-]{8,64}$/.test(header)) return header;
  return randomUUID();
}

export function withContext<T>(ctx: LogContext, fn: () => Promise<T>): Promise<T> {
  return logContext.run(ctx, fn);
}

export function currentRequestId(): string | undefined {
  return logContext.getStore()?.requestId;
}
