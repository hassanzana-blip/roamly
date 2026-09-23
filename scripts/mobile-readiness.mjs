#!/usr/bin/env node
// Read-only deployment smoke check. No credentials, customer data, provider calls or mutations.
import { pathToFileURL } from "node:url";

export function apiOrigin(value) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    throw new Error("Use HTTPS (HTTP is allowed only for localhost).");
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "Supply an origin only, without credentials, path, query or fragment."
    );
  return url.origin;
}

const payload = body => body?.result?.data?.json;
const errorCode = body => body?.error?.json?.data?.code;

export async function checkMobileReadiness(
  base,
  { fetchImpl = fetch, timeoutMs = 15000 } = {}
) {
  const origin = apiOrigin(base);
  const airportsQuery = encodeURIComponent(
    JSON.stringify({ json: { query: "OSL", limit: 5 } })
  );
  const checks = [
    {
      name: "database-ready",
      path: "/readyz",
      valid: (s, b) => s === 200 && b?.ready === true,
    },
    {
      name: "web-api",
      path: "/api/trpc/ping",
      valid: (s, b) => s === 200 && payload(b)?.ok === true,
    },
    {
      name: "mobile-api",
      path: "/api/mobile/trpc/ping",
      valid: (s, b) => s === 200 && payload(b)?.ok === true,
    },
    {
      name: "mobile-airports",
      path: `/api/mobile/trpc/flights.airports?input=${airportsQuery}`,
      valid: (s, b) =>
        s === 200 &&
        Array.isArray(payload(b)) &&
        payload(b).some(
          a =>
            a.iata === "OSL" && typeof a.name === "string" && a.name.length > 0
        ),
    },
    {
      name: "anonymous-customer-is-empty",
      path: "/api/mobile/trpc/mobileAuth.me",
      valid: (s, b) => s === 200 && payload(b) === null,
    },
    {
      name: "staff-api-not-exposed",
      path: "/api/mobile/trpc/adminOwner.summary",
      valid: (s, b) => s === 404 && errorCode(b) === "NOT_FOUND",
    },
  ];
  const results = [];
  // Sequential, bounded probes avoid a burst against sleeping staging environments.
  for (const check of checks) {
    const started = performance.now();
    try {
      const response = await fetchImpl(origin + check.path, {
        method: "GET",
        headers: { accept: "application/json" },
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
      const isJson = /application\/json/i.test(
        response.headers.get("content-type") ?? ""
      );
      const body = isJson ? await response.json() : null;
      results.push({
        check: check.name,
        ok: isJson && check.valid(response.status, body),
        status: response.status,
        durationMs: Math.round(performance.now() - started),
        json: isJson,
      });
    } catch (error) {
      // Do not echo response bodies, exception messages or URLs that could contain secrets.
      results.push({
        check: check.name,
        ok: false,
        status: null,
        durationMs: Math.round(performance.now() - started),
        error:
          error?.name === "TimeoutError" || error?.name === "AbortError"
            ? "TIMEOUT"
            : "NETWORK_OR_INVALID_JSON",
      });
    }
  }
  return {
    origin,
    checkedAt: new Date().toISOString(),
    ok: results.every(r => r.ok),
    scope:
      "Public API reachability and unauthenticated boundary only; not proof of live fares, shared customer accounts, provider handoff or native-device behavior.",
    checks: results,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv.length !== 3)
      throw new Error(
        "Usage: node scripts/mobile-readiness.mjs https://your-api-host"
      );
    const report = await checkMobileReadiness(process.argv[2]);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
