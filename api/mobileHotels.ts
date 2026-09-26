import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { hotelDetailSchema, hotelPlacesSchema, hotelSearchSchema, hotelsStatus, runHotelDetail, runHotelPlaces, runHotelSearch } from "./hotels";

// ─── Appens hotellsøk ───────────────────────────────────────────────────────
// Nøyaktig nettets hotellsøk (api/hotels.ts: validering, rategrenser, KAYAK
// Hotels-kallet), men bare det kunden trenger: status, stedsøk, søk og
// detaljer. Appen kan ikke velge valuta – KAYAK bes alltid om NOK – og kan
// bare be om norsk eller engelsk tekst. Bestilling skjer alltid hos
// leverandøren via KAYAKs egen bestillingslenke (bookUrl, kun https). Er
// hotellsøk slått av, svarer status `enabled: false`, og search/detail
// feiler slik nettet gjør – ingen reservedata.

const language = z.enum(["nb", "en"]).optional();

export const mobileHotelSearchSchema = hotelSearchSchema.omit({ currency: true, language: true }).extend({ language });
export const mobileHotelDetailSchema = hotelDetailSchema.omit({ currency: true, language: true }).extend({ language });

export const mobileHotelsRouter = createRouter({
  status: publicQuery.query(() => hotelsStatus()),
  places: publicQuery.input(hotelPlacesSchema).query(({ input, ctx }) => runHotelPlaces(input, ctx)),
  search: publicQuery.input(mobileHotelSearchSchema).query(({ input, ctx }) => runHotelSearch({ ...input, currency: "NOK" }, ctx)),
  detail: publicQuery.input(mobileHotelDetailSchema).query(({ input, ctx }) => runHotelDetail({ ...input, currency: "NOK" }, ctx)),
});
