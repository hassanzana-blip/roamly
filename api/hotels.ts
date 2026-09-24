import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { AppError } from "./lib/errors";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { kayakConfig } from "./lib/kayak";
import { kayakHotelDetail, kayakHotelPlaces, kayakHotelSearch, kayakHotelsConfig } from "./lib/kayakHotels";
import type { HotelsStatus } from "../contracts/hotels";
import type { TrpcContext } from "./context";

/**
 * Hotellsøk (metasøk). Alle data kommer fra KAYAK Hotels API og bestillingen
 * skjer hos leverandøren. Er KAYAK-hotell ikke slått på, svarer `status`
 * `enabled: false` og frontend viser forespørselsflyten (ingen falske data).
 */

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const roomSchema = z.object({ adults: z.number().int().min(1).max(8), childAges: z.array(z.number().int().min(0).max(17)).max(6).optional() });
const currencySchema = z.string().regex(/^[A-Z]{3}$/).optional();

function assertStay(checkin: string, checkout: string) {
  // Tidligste «i dag» i noen tidssone (UTC−12): klientens dato er lokal.
  const today = new Date(Date.now() - 12 * 60 * 60_000).toISOString().slice(0, 10);
  if (checkin < today) throw new AppError("VALIDATION", { message: "Innsjekk kan ikke være i fortiden.", data: { field: "checkin" } });
  if (checkout <= checkin) throw new AppError("VALIDATION", { message: "Utsjekk må være etter innsjekk.", data: { field: "checkout" } });
  if ((Date.parse(checkout) - Date.parse(checkin)) / 86_400_000 > 30) throw new AppError("VALIDATION", { message: "Maks 30 netter per søk.", data: { field: "checkout" } });
}

export function hotelsStatus(): HotelsStatus {
  return { enabled: kayakHotelsConfig.enabled, mode: kayakConfig.mode, externalBooking: true };
}

/** Stedsøk (KAYAK-steder). Deles med appen (api/mobileHotels.ts). */
export const hotelPlacesSchema = z.object({ query: z.string().trim().min(2).max(60) });
export async function runHotelPlaces(input: z.infer<typeof hotelPlacesSchema>, ctx: TrpcContext) {
  assertRateLimit("hotel-places", clientIp(ctx.req), 40, 60_000);
  return kayakHotelPlaces(input.query, { userAgent: ctx.req.headers.get("user-agent") ?? undefined, clientIp: clientIp(ctx.req) });
}

export const hotelSearchSchema = z.object({
  destination: z.string().min(6).max(220),
  checkin: dateSchema,
  checkout: dateSchema,
  rooms: z.array(roomSchema).min(1).max(4),
  currency: currencySchema,
  language: z.string().regex(/^[a-zA-Z]{2}$/).optional(),
  sort: z.enum(["popularity", "minRate", "rating", "distance", "consumerRating"]).optional(),
  sessionId: z.string().uuid().optional(),
});
/** Samme validering, rategrenser og leverandørkall for nettet og appen. */
export async function runHotelSearch(input: z.infer<typeof hotelSearchSchema>, ctx: TrpcContext) {
  assertRateLimit("hotel-search", clientIp(ctx.req), 20, 60_000);
  assertRateLimit("hotel-search-hourly", clientIp(ctx.req), 120, 60 * 60_000);
  assertStay(input.checkin, input.checkout);
  return kayakHotelSearch(
    { destination: input.destination, checkin: input.checkin, checkout: input.checkout, rooms: input.rooms, currency: input.currency, language: input.language, sort: input.sort },
    { userTrackId: input.sessionId, userAgent: ctx.req.headers.get("user-agent") ?? undefined, clientIp: clientIp(ctx.req) },
  );
}

export const hotelDetailSchema = z.object({
  hotelKey: z.string().regex(/^khotel:\d{1,12}$/),
  checkin: dateSchema,
  checkout: dateSchema,
  rooms: z.array(roomSchema).min(1).max(4),
  currency: currencySchema,
  language: z.string().regex(/^[a-zA-Z]{2}$/).optional(),
  sessionId: z.string().uuid().optional(),
});
export async function runHotelDetail(input: z.infer<typeof hotelDetailSchema>, ctx: TrpcContext) {
  assertRateLimit("hotel-detail", clientIp(ctx.req), 30, 60_000);
  assertStay(input.checkin, input.checkout);
  return kayakHotelDetail(
    { hotelKey: input.hotelKey, checkin: input.checkin, checkout: input.checkout, rooms: input.rooms, currency: input.currency, language: input.language },
    { userTrackId: input.sessionId, userAgent: ctx.req.headers.get("user-agent") ?? undefined, clientIp: clientIp(ctx.req) },
  );
}

export const hotelsRouter = createRouter({
  status: publicQuery.query(() => hotelsStatus()),
  places: publicQuery.input(hotelPlacesSchema).query(({ input, ctx }) => runHotelPlaces(input, ctx)),
  search: publicQuery.input(hotelSearchSchema).query(({ input, ctx }) => runHotelSearch(input, ctx)),
  detail: publicQuery.input(hotelDetailSchema).query(({ input, ctx }) => runHotelDetail(input, ctx)),
});
