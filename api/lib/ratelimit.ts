import { AppError } from "./errors";

// ─── In-memory sliding-window rate limiter ───────────────────────────────────
// Process-shared (all requests in this Node process share the buckets).
// Good enough for a single-instance deployment; swap for Redis if scaled out.
// Errors are thrown as AppError("RATE_LIMITED") so the tRPC layer maps them to
// TOO_MANY_REQUESTS with `retryAfterSec` in `data` (OTA-102).

const buckets = new Map<string, number[]>();

// Periodically drop stale keys so the map doesn't grow unbounded
setInterval(() => {
  const cutoff = Date.now() - 60 * 60_000;
  for (const [key, hits] of buckets) {
    const fresh = hits.filter((t) => t > cutoff);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}, 60_000).unref();

/**
 * Best-effort client IP behind a trusted reverse proxy (Railway/Nginx/Cloudflare).
 *
 * Why the LAST entry of X-Forwarded-For (OTA-104): every proxy hop appends the
 * address it received the connection from. The first entry is whatever the
 * client chose to send and is trivially spoofable (`X-Forwarded-For: 1.2.3.4`),
 * which would let an attacker pick a fresh "IP" per request and bypass every
 * limiter. The last entry was written by the proxy closest to us, which we
 * trust. With exactly one trusted proxy in front of the app this is the real
 * peer address. If more hops are added, skip that many entries from the end
 * (TRUSTED_PROXY_HOPS) — kept simple here: one hop.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 1);
    const idx = Math.max(0, parts.length - hops);
    const ip = parts[idx];
    if (ip) return ip.slice(0, 45);
  }
  return (req.headers.get("x-real-ip") ?? "local").slice(0, 45);
}

/**
 * Sliding-window limiter. `key` is normally an IP but may be any identifier
 * (e-mail, phone, "global"). Throws AppError RATE_LIMITED with retryAfterSec.
 */
export function assertRateLimit(scope: string, key: string, limit: number, windowMs: number): void {
  const bucketKey = `${scope}:${key}`;
  const now = Date.now();
  const hits = (buckets.get(bucketKey) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));
    throw new AppError("RATE_LIMITED", {
      message: `For mange forespørsler på kort tid. Vent ${retryAfterSec} sekunder og prøv igjen.`,
      data: { retryAfterSec },
    });
  }
  hits.push(now);
  buckets.set(bucketKey, hits);
}

/** Non-throwing variant for callers that want to degrade instead of fail. */
export function checkRateLimit(scope: string, key: string, limit: number, windowMs: number): boolean {
  try {
    assertRateLimit(scope, key, limit, windowMs);
    return true;
  } catch (err) {
    if (err instanceof AppError && err.code === "RATE_LIMITED") return false;
    throw err;
  }
}
