import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { hasPermission, type Permission } from "./lib/rbac";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

/** Krever innlogget staff-bruker med bekreftet MFA. */
export const staffProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.staff) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Du må være logget inn." });
  }
  if (ctx.staff.mfaEnabled && !ctx.staff.mfaVerified) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "MFA må bekreftes." });
  }
  return next({ ctx: { ...ctx, staff: ctx.staff } });
});

/** Krever en spesifikk tillatelse — håndheves alltid på serveren. */
export function requirePermission(permission: Permission) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.staff) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Du må være logget inn." });
    }
    if (ctx.staff.mfaEnabled && !ctx.staff.mfaVerified) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "MFA må bekreftes." });
    }
    if (!hasPermission(ctx.staff.role, permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Du har ikke tilgang til denne handlingen.",
      });
    }
    return next({ ctx: { ...ctx, staff: ctx.staff } });
  });
}

export const permittedProcedure = (permission: Permission) =>
  t.procedure.use(requirePermission(permission));
