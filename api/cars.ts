import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { AppError } from "./lib/errors";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { kayakConfig } from "./lib/kayak";
import { kayakCarPlaces, kayakCarSearch, kayakCarsConfig } from "./lib/kayakCars";
import type { CarsStatus } from "../contracts/cars";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const locationSchema = z.object({ type: z.enum(["airport", "city"]), value: z.string().trim().min(1).max(80) });

export function carsStatus(): CarsStatus {
  return { enabled: kayakCarsConfig.enabled, mode: kayakConfig.mode, externalBooking: true };
}

/** Leiebilsøk (metasøk via KAYAK). Bestillingen skjer hos utleier/formidler. */
export const carsRouter = createRouter({
  status: publicQuery.query(() => carsStatus()),

  places: publicQuery.input(z.object({ query: z.string().trim().min(2).max(60) })).query(async ({ input, ctx }) => {
    assertRateLimit("car-places", clientIp(ctx.req), 40, 60_000);
    return kayakCarPlaces(input.query, { userAgent: ctx.req.headers.get("user-agent") ?? undefined, clientIp: clientIp(ctx.req) });
  }),

  search: publicQuery
    .input(
      z.object({
        pickup: locationSchema,
        dropoff: locationSchema.optional(),
        pickupDate: dateSchema,
        dropoffDate: dateSchema,
        pickupHour: z.number().int().min(0).max(23).optional(),
        dropoffHour: z.number().int().min(0).max(23).optional(),
        currency: z.string().regex(/^[A-Z]{3}$/).optional(),
        sessionId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      assertRateLimit("car-search", clientIp(ctx.req), 20, 60_000);
      assertRateLimit("car-search-hourly", clientIp(ctx.req), 120, 60 * 60_000);
      const today = new Date().toISOString().slice(0, 10);
      if (input.pickupDate < today) throw new AppError("VALIDATION", { message: "Hentedato kan ikke være i fortiden.", data: { field: "pickupDate" } });
      if (input.dropoffDate < input.pickupDate) throw new AppError("VALIDATION", { message: "Leveringsdato må være etter hentedato.", data: { field: "dropoffDate" } });
      return kayakCarSearch(input, { userTrackId: input.sessionId, userAgent: ctx.req.headers.get("user-agent") ?? undefined, clientIp: clientIp(ctx.req) });
    }),
});
