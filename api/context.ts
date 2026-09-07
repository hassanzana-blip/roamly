import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { resolveSession, type StaffIdentity } from "./lib/sessions";
import { resolveCustomerSession, type CustomerIdentity } from "./lib/customerSessions";
import { currentRequestId, log, newRequestId } from "./lib/logger";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  /** Korrelasjons-ID (fra x-request-id eller generert i boot.ts). */
  requestId: string;
  staff: StaffIdentity | null;
  customer: CustomerIdentity | null;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  // boot.ts kjører handleren inne i withContext({ requestId }), så AsyncLocalStorage
  // har den allerede; header-fallback dekker direkte kall (tester, CLI).
  const requestId = currentRequestId() ?? newRequestId(opts.req.headers.get("x-request-id"));
  opts.resHeaders.set("x-request-id", requestId);

  let staff: StaffIdentity | null = null;
  try {
    staff = await resolveSession(opts.req);
  } catch (err) {
    log.warn({ err: String(err) }, "staff-sesjon kunne ikke løses opp (behandles som utlogget)");
    staff = null; // DB utilgjengelig → behandle som utlogget, ikke 500
  }
  let customer: CustomerIdentity | null = null;
  try {
    customer = await resolveCustomerSession(opts.req);
  } catch (err) {
    log.warn({ err: String(err) }, "kundesesjon kunne ikke løses opp (behandles som utlogget)");
    customer = null;
  }
  return { req: opts.req, resHeaders: opts.resHeaders, requestId, staff, customer };
}
