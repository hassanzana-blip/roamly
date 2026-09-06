import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { quotes } from "../db/schema";
import { sha256Hex } from "./lib/tokens";
import { assertRateLimit, clientIp } from "./lib/ratelimit";

/**
 * Offentlig tilbuds-visning via sikker engangslenkе (checkout-lenke).
 * Token er 256-bit tilfeldig og lagres kun som hash — kan ikke gjettes.
 */
export const quotesPublicRouter = createRouter({
  getByToken: publicQuery
    .input(z.object({ token: z.string().min(32).max(128) }))
    .query(async ({ input, ctx }) => {
      assertRateLimit("quote-view", clientIp(ctx.req), 30, 60_000);
      const rows = await getDb()
        .select()
        .from(quotes)
        .where(eq(quotes.checkoutTokenHash, sha256Hex(input.token)))
        .limit(1);
      const quote = rows[0];
      if (!quote) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lenken er ugyldig eller erstattet av en nyere." });
      }
      const expired = quote.expiresAt < new Date();
      const offer = JSON.parse(quote.offerSnapshot);
      return {
        reference: quote.reference,
        customerName: quote.customerName.split(" ")[0], // kun fornavn i offentlig visning
        status: expired && ["draft", "sent"].includes(quote.status) ? "expired" : quote.status,
        expiresAt: quote.expiresAt,
        route: offer.slices?.map((s: { origin: { city: string }; destination: { city: string } }) =>
          `${s.origin.city} → ${s.destination.city}`).join(" · ") ?? "",
        slices: offer.slices ?? [],
        cabinClass: offer.cabinClass,
        offerAmount: offer.totalAmount,
        serviceFeeAmount: quote.serviceFeeAmount,
        totalAmount: quote.totalAmount,
        currency: quote.currency,
        passengers: quote.passengersJson ? JSON.parse(quote.passengersJson).length : 1,
      };
    }),
});
