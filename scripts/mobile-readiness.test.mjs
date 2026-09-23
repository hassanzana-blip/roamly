import assert from "node:assert/strict";
import { test } from "node:test";
import { apiOrigin, checkMobileReadiness } from "./mobile-readiness.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const rpc = value => json({ result: { data: { json: value } } });
const rpcError = (code, status) =>
  json({ error: { json: { data: { code } } } }, status);

function healthy(url) {
  const path = new URL(url).pathname;
  if (path === "/readyz") return json({ ready: true });
  if (path.endsWith("/ping")) return rpc({ ok: true });
  if (path.endsWith("/flights.airports"))
    return rpc([{ iata: "OSL", name: "Oslo Airport" }]);
  if (path.endsWith("/mobileAuth.me")) return rpc(null);
  return rpcError("NOT_FOUND", 404);
}

test("accepts valid origins and rejects credentials, paths and insecure remote hosts", () => {
  assert.equal(apiOrigin("https://hellosky.no/"), "https://hellosky.no");
  assert.equal(apiOrigin("http://localhost:3000"), "http://localhost:3000");
  for (const url of [
    "http://hellosky.no",
    "https://user:secret@hellosky.no",
    "https://hellosky.no/api",
    "https://hellosky.no/?key=secret",
    "https://hellosky.no/#secret",
  ]) {
    assert.throws(() => apiOrigin(url));
  }
});

test("checks the public contracts without sending auth or following redirects", async () => {
  const seen = [];
  const report = await checkMobileReadiness("https://example.test", {
    fetchImpl: async (url, init) => {
      seen.push(url);
      assert.equal(init.method, "GET");
      assert.equal(init.redirect, "manual");
      assert.deepEqual(init.headers, { accept: "application/json" });
      return healthy(url);
    },
  });
  assert.equal(report.ok, true);
  assert.equal(seen.length, 6);
  assert.match(report.scope, /not proof of live fares/);
});

test("an HTTP 200 SPA fallback does not count as a working mobile API", async () => {
  const report = await checkMobileReadiness("https://example.test", {
    fetchImpl: async () =>
      new Response("<html>app</html>", {
        headers: { "content-type": "text/html" },
      }),
  });
  assert.equal(report.ok, false);
  assert.ok(report.checks.every(c => !c.ok));
});

test("missing deployment, invalid airport data and exposed staff routes fail closed", async () => {
  for (const broken of [
    "mobile-api",
    "mobile-airports",
    "anonymous-customer-is-empty",
    "staff-api-not-exposed",
  ]) {
    const report = await checkMobileReadiness("https://example.test", {
      fetchImpl: async url => {
        if (broken === "mobile-api" && url.endsWith("/api/mobile/trpc/ping"))
          return rpcError("NOT_FOUND", 404);
        if (broken === "mobile-airports" && url.includes("flights.airports"))
          return rpc([]);
        if (
          broken === "anonymous-customer-is-empty" &&
          url.endsWith("mobileAuth.me")
        )
          return rpc({ email: "DO-NOT-LOG" });
        if (
          broken === "staff-api-not-exposed" &&
          url.endsWith("adminOwner.summary")
        )
          return rpc({ revenue: "DO-NOT-LOG" });
        return healthy(url);
      },
    });
    assert.equal(report.ok, false);
    assert.equal(report.checks.find(c => c.check === broken).ok, false);
    assert.ok(!JSON.stringify(report).includes("DO-NOT-LOG"));
  }
});

test("network failures are bounded/redacted and do not hide later check results", async () => {
  let count = 0;
  const report = await checkMobileReadiness("https://example.test", {
    fetchImpl: async url => {
      if (++count === 1) throw new Error("secret diagnostic contents");
      return healthy(url);
    },
  });
  assert.equal(report.ok, false);
  assert.equal(report.checks.length, 6);
  assert.ok(report.checks.slice(1).every(c => c.ok));
  assert.ok(!JSON.stringify(report).includes("secret"));
});
