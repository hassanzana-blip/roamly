import { serialize } from "superjson";

/**
 * En falsk server på HTTP-nivå: svarer som tRPC-adapteren (superjson i
 * `result.data` / `error.json`) og husker hver forespørsel, så testene kan
 * sjekke metode, sti, kropp og Authorization-header nøyaktig.
 */
export type Recorded = { method: string; path: string; url: string; headers: Record<string, string>; input: unknown };

type Handler = (req: Recorded) => { status?: number; data?: unknown; error?: { message: string; appCode: string; field?: string } } | Promise<never>;

export function fakeServer(routes: Record<string, Handler>) {
  const calls: Recorded[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const path = u.pathname.replace("/api/mobile/trpc/", "");
    const headers = { ...((init?.headers as Record<string, string>) ?? {}) };
    let input: unknown = undefined;
    if (init?.method === "GET") {
      const raw = u.searchParams.get("input");
      input = raw ? (JSON.parse(raw) as { json: unknown }).json : undefined;
    } else if (typeof init?.body === "string") {
      input = (JSON.parse(init.body) as { json?: unknown }).json;
    }
    const rec: Recorded = { method: init?.method ?? "GET", path, url, headers, input };
    calls.push(rec);
    const handler = routes[path];
    if (!handler) return new Response(JSON.stringify({ error: { json: { message: "No procedure", code: -32004, data: { code: "NOT_FOUND", httpStatus: 404 } } } }), { status: 404 });
    const out = await handler(rec);
    if (out.error) {
      const body = { error: serialize({ message: out.error.message, code: -32001, data: { code: "X", httpStatus: out.status ?? 400, appCode: out.error.appCode, retryable: false, ...(out.error.field ? { details: { field: out.error.field } } : {}) } }) };
      return new Response(JSON.stringify(body), { status: out.status ?? 400, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ result: { data: serialize(out.data) } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}
