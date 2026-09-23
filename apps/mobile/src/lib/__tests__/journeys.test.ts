import { groupJourneys, itinerarySignature, journeyOf } from "../journeys";
import { NOK_OFFER, SAME_TRIP_OTHER_SELLER, SEARCH_RESULT, SEK_OFFER, THB_OFFER } from "../../test/fixtures";

describe("én reise, flere tilbydere (samme gruppering som nettet)", () => {
  it("signaturen er flynumre, flyplasser og tider – ikke tilbudets id eller selger", () => {
    expect(itinerarySignature(SEK_OFFER.offer)).toBe(itinerarySignature(SAME_TRIP_OTHER_SELLER.offer));
    expect(itinerarySignature(SEK_OFFER.offer)).not.toBe(itinerarySignature(NOK_OFFER.offer));
    expect(itinerarySignature(SEK_OFFER.offer)).toContain("SK1455:OSL>CPH:2026-10-23T07:05:00>2026-10-23T08:15:00");
  });

  it("gruppen står der dens første tilbud sto; den billigste i kroner representerer den", () => {
    const groups = groupJourneys([SEK_OFFER, NOK_OFFER, SAME_TRIP_OTHER_SELLER]);
    expect(groups.map((g) => g.best.offer.id)).toEqual(["gtg_1", "nok_1"]);
    expect(groups[0]!.sellers.map((s) => [s.item.offer.id, s.nokMinor])).toEqual([
      ["gtg_1", 139000],
      ["sek_1", 144200],
    ]);
  });

  it("uten kronepris står sist blant selgerne og blir aldri «fra»-prisen", () => {
    const noNok = { ...THB_OFFER, offer: { ...SEK_OFFER.offer, id: "thb_same" } };
    const [g] = groupJourneys([noNok, SEK_OFFER]);
    expect(g!.best.offer.id).toBe("sek_1");
    expect(g!.sellers.at(-1)!.nokMinor).toBeNull();
  });

  it("journeyOf finner reisen til et tilbud blant de gitte", () => {
    expect(journeyOf([...SEARCH_RESULT.offers, SAME_TRIP_OTHER_SELLER], "sek_1")!.sellers).toHaveLength(2);
    expect(journeyOf(SEARCH_RESULT.offers, "finnes-ikke")).toBeNull();
  });
});
