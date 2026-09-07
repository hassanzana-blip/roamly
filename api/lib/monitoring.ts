import { env } from "./env";
import { log } from "./logger";

// ─── Valgfri feilrapportering (Sentry) ───────────────────────────────────────
// Aktiveres KUN når SENTRY_DSN er satt. SDK-en lastes dynamisk slik at
// prosesser uten DSN (tester, lokal utvikling) aldri initialiserer den.
// Rapporterer: interne tRPC-feil, jobbfeil i worker, unhandled rejections /
// uncaught exceptions. Aldri PII i `extra` — kun ID-er og koder.

type SentryLike = {
  init(opts: Record<string, unknown>): void;
  captureException(err: unknown, hint?: { tags?: Record<string, string>; extra?: Record<string, unknown> }): string;
  flush(timeoutMs?: number): Promise<boolean>;
};

let sentry: SentryLike | null = null;
let initPromise: Promise<void> | null = null;
let processHandlersInstalled = false;

export function monitoringEnabled(): boolean {
  return Boolean(env.SENTRY_DSN);
}

/** Initialiser Sentry (idempotent). Feil ved lasting logges og deaktiverer rapportering. */
export function initMonitoring(service: "web" | "worker"): Promise<void> {
  if (!monitoringEnabled()) return Promise.resolve();
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const mod = (await import("@sentry/node")) as unknown as SentryLike;
      mod.init({
        dsn: env.SENTRY_DSN,
        environment: env.APP_ENV,
        release: process.env.APP_RELEASE || process.env.GIT_SHA || undefined,
        tracesSampleRate: 0,
        sendDefaultPii: false,
        initialScope: { tags: { service } },
        beforeSend(event: { request?: { cookies?: unknown; headers?: Record<string, string> } }) {
          // Aldri cookies/autorisasjon til Sentry
          if (event.request) {
            delete event.request.cookies;
            if (event.request.headers) {
              delete event.request.headers.cookie;
              delete event.request.headers.authorization;
            }
          }
          return event;
        },
      });
      sentry = mod;
      log.info({ service }, "Sentry aktivert");
    } catch (err) {
      log.warn({ err }, "Kunne ikke laste @sentry/node — feilrapportering deaktivert");
      sentry = null;
    }
  })();
  return initPromise;
}

/** Rapporter en feil (no-op uten DSN). Trygt å kalle fra hvor som helst. */
export function captureException(err: unknown, ctx: { tags?: Record<string, string>; extra?: Record<string, unknown> } = {}): void {
  if (!sentry) return;
  try {
    sentry.captureException(err, { tags: ctx.tags, extra: ctx.extra });
  } catch (inner) {
    log.debug({ err: inner }, "Sentry captureException feilet");
  }
}

/** Fang unhandledRejection/uncaughtException prosessvidt (idempotent). Logger alltid, rapporterer når aktivert. */
export function installProcessHandlers(service: "web" | "worker"): void {
  if (processHandlersInstalled) return;
  processHandlersInstalled = true;
  process.on("unhandledRejection", (reason) => {
    log.error({ err: reason, service }, "unhandledRejection");
    captureException(reason, { tags: { source: "unhandledRejection", service } });
  });
  process.on("uncaughtException", (err) => {
    log.fatal({ err, service }, "uncaughtException");
    captureException(err, { tags: { source: "uncaughtException", service } });
  });
}

/** Tøm køen før avslutning (maks 2 s). */
export async function flushMonitoring(): Promise<void> {
  if (!sentry) return;
  try {
    await sentry.flush(2000);
  } catch {
    /* ignorer */
  }
}
