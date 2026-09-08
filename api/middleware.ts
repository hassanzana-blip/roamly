import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { hasPermission, REAUTH_ACTIONS, type Permission } from "./lib/rbac";
import { AppError, toTRPCError } from "./lib/errors";
import { sessionIsFresh } from "./lib/sessions";
import { log } from "./lib/logger";
import { isAllowedOrigin, shortOrigin } from "./lib/origin";
import { captureException } from "./lib/monitoring";

// ─── tRPC-oppsett ────────────────────────────────────────────────────────────
// errorFormatter eksponerer stabil `appCode` + `retryable` i `shape.data` slik
// at klienten kan oversette/reagere uten å parse meldinger (OTA-100/101).

type ErrorCause = { appCode?: string; retryable?: boolean } & Record<string, unknown>;

/**
 * Zod-feil er også kundefeil.
 *
 * Uten appCode faller klienten tilbake på «noe gikk galt hos oss» – for et
 * skjema der kunden bare har skrevet samme flyplass to ganger. Vi løfter derfor
 * zod-feil til VALIDATION med feltet, og bruker den håndskrevne meldingen når
 * regelen har en (`custom`); zods egne meldinger er engelske og tekniske, og
 * har ingenting å gjøre i et norsk skjema.
 */
function zodAppError(err: unknown): AppError | null {
  if (!(err instanceof ZodError) || err.issues.length === 0) return null;
  const issue = err.issues.find((i) => i.code === "custom") ?? err.issues[0];
  const field = issue.path.filter((p) => typeof p === "string" || typeof p === "number").join(".");
  return new AppError("VALIDATION", {
    // Zods egne meldinger er engelske og tekniske; bare håndskrevne regler
    // (`custom`) har tekst som kan stå i et norsk skjema.
    message: issue.code === "custom" && issue.message ? issue.message : "Sjekk feltene som er merket, og prøv igjen.",
    ...(field ? { data: { field } } : {}),
    cause: err,
  });
}

function causeOf(err: TRPCError): ErrorCause | null {
  const c = err.cause;
  if (c instanceof AppError) return { appCode: c.code, retryable: c.retryable, ...(c.data ?? {}) };
  const zod = zodAppError(c);
  if (zod) return { appCode: zod.code, retryable: zod.retryable, ...(zod.data ?? {}) };
  if (c && typeof c === "object" && "appCode" in c) return c as ErrorCause;
  return null;
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error, ctx }) {
    const cause = causeOf(error);
    const { appCode, retryable, ...rest } = cause ?? {};
    // Interne feil skal aldri lekke stack/DB-detaljer til klienten
    const isInternal = error.code === "INTERNAL_SERVER_ERROR";
    if (isInternal) {
      log.error({ err: error.cause ?? error, path: shape.data?.path }, "uventet feil i tRPC");
      captureException(error.cause ?? error, { tags: { source: "trpc", path: shape.data?.path ?? "unknown" }, extra: { requestId: ctx?.requestId } });
    }
    const safeData = { ...shape.data, stack: undefined }; // aldri stack til klient
    delete safeData.stack;
    return {
      ...shape,
      message: isInternal && !appCode ? "Noe gikk galt hos oss. Prøv igjen, eller kontakt oss hvis det fortsetter." : shape.message,
      data: {
        ...safeData,
        appCode: appCode ?? (isInternal ? "INTERNAL" : undefined),
        retryable: retryable ?? false,
        requestId: ctx?.requestId,
        ...(Object.keys(rest).length ? { details: rest } : {}),
      },
    };
  },
});

export const createRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const mergeRouters = t.mergeRouters;

/** Fanger AppError (og alt annet) og oversetter til TRPCError med appCode i cause. */
const errorBoundary = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok) {
    const err = result.error;
    const cause = err.cause;
    if (cause instanceof AppError) {
      // tRPC har allerede pakket AppError inn i en TRPCError(INTERNAL) — pakk ut riktig kode
      throw toTRPCError(cause);
    }
    // Inputvalidering er også en kundefeil: uten appCode faller klienten tilbake
    // på «noe gikk galt hos oss» for et skjema kunden selv kan rette.
    const zod = zodAppError(cause);
    if (zod) throw toTRPCError(zod);
    throw err;
  }
  return result;
});

/**
 * CSRF-forsvar i dybden (OTA-076): muterende kall må komme fra appens egen
 * opprinnelse. Sjekken ligger her, ikke i Hono, slik at avvisningen går ut som
 * en ekte tRPC-feil — et rått JSON-svar kan ikke tolkes av klientens
 * superjson-transformer og gir «Unable to transform response from server».
 */
const originGuard = t.middleware(({ ctx, type, next }) => {
  if (type === "mutation" && ctx.req && !isAllowedOrigin(ctx.req.headers)) {
    log.warn({ origin: shortOrigin(ctx.req.headers), requestId: ctx.requestId }, "avvist: ukjent Origin");
    const message = "Forespørselen kom fra en ukjent opprinnelse.";
    throw new TRPCError({ code: "FORBIDDEN", message, cause: new AppError("FORBIDDEN", { message }) });
  }
  return next();
});

/** Basisprosedyre — alle prosedyrer bruker denne (feilhåndtering inkludert). */
export const publicQuery = t.procedure.use(errorBoundary).use(originGuard);
export const baseProcedure = publicQuery;

const unauthorized = (message = "Du må være logget inn.") => new TRPCError({ code: "UNAUTHORIZED", message, cause: new AppError("UNAUTHORIZED", { message }) });

/** Krever innlogget kunde. */
export const customerProcedure = publicQuery.use(({ ctx, next }) => {
  if (!ctx.customer) throw unauthorized();
  return next({ ctx: { ...ctx, customer: ctx.customer } });
});

/** Krever innlogget kunde MED bekreftet e-post (OTA-060: reiser/saker på e-post). */
export const verifiedCustomerProcedure = publicQuery.use(({ ctx, next }) => {
  if (!ctx.customer) throw unauthorized();
  if (!ctx.customer.emailVerified) {
    throw new AppError("EMAIL_NOT_VERIFIED").toTRPC();
  }
  return next({ ctx: { ...ctx, customer: ctx.customer } });
});

/**
 * Staff-pålogging er e-post + passord. Tofaktor er avslått etter eiers
 * beslutning; kolonnene i databasen er beholdt slik at det kan slås på igjen
 * uten migrering.
 */
function assertStaff(ctx: TrpcContext) {
  if (!ctx.staff) throw unauthorized();
  return ctx.staff;
}

/** Krever innlogget staff-bruker. */
export const staffProcedure = publicQuery.use(({ ctx, next }) => {
  const staff = assertStaff(ctx);
  return next({ ctx: { ...ctx, staff } });
});

/** Krever en spesifikk tillatelse — håndheves alltid på serveren. */
export function requirePermission(permission: Permission) {
  return t.middleware(({ ctx, next }) => {
    const staff = assertStaff(ctx);
    if (!hasPermission(staff.role, permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Du har ikke tilgang til denne handlingen.",
        cause: new AppError("FORBIDDEN"),
      });
    }
    return next({ ctx: { ...ctx, staff } });
  });
}

export const permittedProcedure = (permission: Permission) =>
  publicQuery.use(requirePermission(permission));

/**
 * Kritiske handlinger (REAUTH_ACTIONS) krever i tillegg fersk sesjon (< 15 min).
 * For andre tillatelser er dette identisk med permittedProcedure.
 */
export const freshSessionProcedure = (permission: Permission) =>
  permittedProcedure(permission).use(({ ctx, next }) => {
    if (!REAUTH_ACTIONS.has(permission)) return next({ ctx });
    if (!sessionIsFresh(ctx.staff)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Krever nylig innlogging. Logg inn igjen og prøv på nytt.",
        cause: new AppError("FORBIDDEN", { message: "Krever nylig innlogging.", data: { reason: "reauth_required" } }),
      });
    }
    // Sesjonen bærer allerede `mfaVerified`; uten denne sjekken betyr feltet
    // ingenting, og en sesjon som ikke har fullført totrinn kan godkjenne en
    // refusjon. Innlogging setter det i dag, så dette endrer ingen arbeidsflyt
    // – det gjør at porten faktisk holder den dagen totrinn slås på.
    if (!ctx.staff.mfaVerified) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Bekreft totrinnspålogging før du gjør dette.",
        cause: new AppError("FORBIDDEN", { message: "Krever bekreftet totrinnspålogging.", data: { reason: "mfa_required" } }),
      });
    }
    return next({ ctx });
  });
