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

function validAuthProviders(value) {
  if (value?.password !== true || !Array.isArray(value.social)) return false;
  if (value.social.length !== 2) return false;
  const names = value.social.map(item => item?.provider);
  if (
    new Set(names).size !== 2 ||
    !names.includes("google") ||
    !names.includes("apple")
  )
    return false;
  for (const item of value.social) {
    if (typeof item.available !== "boolean") return false;
    if (
      item.available
        ? item.reason !== null
        : !["not_configured", "native_not_ready"].includes(item.reason)
    )
      return false;
  }
  const anyAvailable = value.social.some(item => item.available);
  return anyAvailable
    ? typeof value.clerkPublishableKey === "string" &&
        /^pk_(test|live)_/.test(value.clerkPublishableKey)
    : value.clerkPublishableKey === null;
}

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
      name: "customer-auth-providers",
      path: "/api/mobile/trpc/mobileAuth.providers",
      valid: (s, b) => s === 200 && validAuthProviders(payload(b)),
    },
    {
      name: "staff-api-not-exposed",
      path: "/api/mobile/trpc/adminOwner.summary",
      valid: (s, b) => s === 404 && errorCode(b) === "NOT_FOUND",
    },
    {
      name: "staff-session-api-not-exposed",
      path: "/api/mobile/trpc/staffAuth.me",
      // Even an anonymous null response means the staff router was mounted.
      valid: (s, b) => s === 404 && errorCode(b) === "NOT_FOUND",
    },
    {
      name: "admin-dashboard-not-exposed",
      path: "/api/mobile/trpc/admin.dashboard",
      // 401/403 is not enough: the procedure must be absent from mobile.
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
      const ok = isJson && check.valid(response.status, body);
      const failure = ok
        ? undefined
        : response.status >= 300 && response.status < 400
          ? "REDIRECT"
          : !isJson
            ? "NON_JSON_RESPONSE"
            : response.status === 404 && errorCode(body) === "NOT_FOUND"
              ? "ROUTE_NOT_FOUND"
              : "CONTRACT_MISMATCH";
      results.push({
        check: check.name,
        ok,
        status: response.status,
        durationMs: Math.round(performance.now() - started),
        json: isJson,
        ...(failure ? { error: failure } : {}),
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
            : error instanceof SyntaxError
              ? "INVALID_JSON"
              : "NETWORK_ERROR",
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
