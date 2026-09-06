import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { resolveSession, type StaffIdentity } from "./lib/sessions";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  staff: StaffIdentity | null;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  let staff: StaffIdentity | null = null;
  try {
    staff = await resolveSession(opts.req);
  } catch {
    staff = null; // DB utilgjengelig → behandle som utlogget, ikke 500
  }
  return { req: opts.req, resHeaders: opts.resHeaders, staff };
}
