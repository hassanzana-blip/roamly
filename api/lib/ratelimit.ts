// Simple in-memory sliding-window rate limiter.
// Good enough for a single-instance deployment; swap for Redis if scaled out.

const buckets = new Map<string, number[]>();

// Periodically drop stale keys so the map doesn't grow unbounded
setInterval(() => {
  const cutoff = Date.now() - 10 * 60_000;
  for (const [key, hits] of buckets) {
    const fresh = hits.filter((t) => t > cutoff);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}, 60_000).unref();

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

export function assertRateLimit(scope: string, ip: string, limit: number, windowMs: number): void {
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const retryInSec = Math.ceil((hits[0] + windowMs - now) / 1000);
    throw new Error(
      `For mange forespørsler på kort tid. Vent ${retryInSec} sekunder og prøv igjen.`,
    );
  }
  hits.push(now);
  buckets.set(key, hits);
}
