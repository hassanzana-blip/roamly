import { cheapestRate, handoffBlock, hotelInquiryUrl, hotelTotalNok, nightsOf, nokMinor, ratesByTotal, splitRooms, stayError, stayFromParams, stayParams, type HotelStay } from "../hotels";
import { HOTEL_A, HOTEL_B, STATUS_LIVE, STATUS_OFF, STATUS_SANDBOX } from "../../test/hotelFixtures";

const TODAY = "2026-09-24";
const STAY: HotelStay = { placeKey: "kplace:58075", placeName: "London", checkin: "2026-10-23", checkout: "2026-10-26", adults: 2, childAges: [], rooms: 1 };

describe("hotellopphold: samme regler som serveren", () => {
  it("netter og gyldige opphold", () => {
    expect(nightsOf("2026-10-23", "2026-10-26")).toBe(3);
    // Over sommertidsskiftet (25. okt.) er det fortsatt hele døgn.
    expect(nightsOf("2026-10-24", "2026-10-26")).toBe(2);
    expect(stayError(STAY, TODAY)).toBeNull();
    expect(stayError({ ...STAY, checkin: TODAY, checkout: "2026-09-25" }, TODAY)).toBeNull();
  });

  it("feil i fast rekkefølge: sted, fortid, rekkefølge, lengde (høyst 30 netter), rom", () => {
    expect(stayError({ ...STAY, placeKey: "" }, TODAY)).toBe("place");
    expect(stayError({ ...STAY, placeKey: "London" }, TODAY)).toBe("place");
    expect(stayError({ ...STAY, checkin: "2026-09-23" }, TODAY)).toBe("checkin_past");
    expect(stayError({ ...STAY, checkout: STAY.checkin }, TODAY)).toBe("checkout_order");
    expect(stayError({ ...STAY, checkout: "2026-10-22" }, TODAY)).toBe("checkout_order");
    expect(stayError({ ...STAY, checkout: "2026-11-22" }, TODAY)).toBeNull(); // 30 netter
    expect(stayError({ ...STAY, checkout: "2026-11-23" }, TODAY)).toBe("too_long"); // 31 netter
    expect(stayError({ ...STAY, rooms: 3, adults: 2 }, TODAY)).toBe("rooms_adults");
    expect(stayError({ ...STAY, rooms: 5, adults: 8 }, TODAY)).toBe("rooms_adults");
    expect(stayError({ ...STAY, adults: 9 }, TODAY)).toBe("rooms_adults");
    expect(stayError({ ...STAY, rooms: 0 }, TODAY)).toBe("rooms_adults");
  });

  it("gjestene fordeles på rom som nettet: jevnt, minst én voksen per rom, barna etter tur", () => {
    expect(splitRooms(2, [], 1)).toEqual([{ adults: 2 }]);
    expect(splitRooms(3, [], 2)).toEqual([{ adults: 2 }, { adults: 1 }]);
    expect(splitRooms(5, [4, 9, 12], 3)).toEqual([
      { adults: 2, childAges: [4] },
      { adults: 2, childAges: [9] },
      { adults: 1, childAges: [12] },
    ]);
    expect(splitRooms(1, [3, 5], 1)).toEqual([{ adults: 1, childAges: [3, 5] }]);
  });

  it("ruteparametere tur-retur, og ugyldige avvises (da søkes det ikke)", () => {
    const stay = { ...STAY, adults: 3, childAges: [0, 17], rooms: 2 };
    expect(stayFromParams(stayParams(stay))).toEqual(stay);
    const p = stayParams(STAY);
    expect(stayFromParams({ ...p, sted: "Oslo" })).toBeNull();
    expect(stayFromParams({ ...p, inn: "23.10.2026" })).toBeNull();
    expect(stayFromParams({ ...p, voksne: "0" })).toBeNull();
    expect(stayFromParams({ ...p, voksne: "9" })).toBeNull();
    expect(stayFromParams({ ...p, rom: "3" })).toBeNull();
    expect(stayFromParams({ ...p, barn: "18" })).toBeNull();
    expect(stayFromParams({ ...p, barn: "1,2,3,4,5,6,7" })).toBeNull();
    expect(stayFromParams({ ...p, barn: "a" })).toBeNull();
  });
});

describe("priser og videresending", () => {
  it("bare NOK blir et kronebeløp; annen valuta, negative og ugyldige beløp gir ingen pris", () => {
    expect(nokMinor(3639, "NOK")).toBe(363900);
    expect(nokMinor(4119.5, "nok")).toBe(411950);
    expect(nokMinor(1213.11, "NOK")).toBe(121311);
    expect(nokMinor(3639, "EUR")).toBeNull();
    expect(nokMinor(-1, "NOK")).toBeNull();
    expect(nokMinor(Number.NaN, "NOK")).toBeNull();
    expect(nokMinor(null, "NOK")).toBeNull();
  });

  it("billigste rom: laveste NOK-totalpris, uansett serverens rekkefølge; rom i annen valuta sist", () => {
    const [hilton, booking] = HOTEL_A.rates;
    expect(cheapestRate(HOTEL_A)).toBe(booking);
    expect(hotelTotalNok(HOTEL_A)).toBe(363900);
    expect(hotelTotalNok(HOTEL_B)).toBeNull();
    const eur = { ...booking!, totalAmount: 10, currency: "EUR" };
    expect(ratesByTotal([eur, hilton!, booking!])).toEqual([booking, hilton, eur]);
    expect(cheapestRate({ rates: [eur] })).toBe(eur);
    expect(hotelTotalNok({ rates: [eur] })).toBeNull();
  });

  it("«Gå til» bare i produksjon, med ekte data og KAYAKs https-lenke", () => {
    const url = "https://www.kayak.no/in?a=1";
    expect(handoffBlock(STATUS_LIVE, false, url)).toBeNull();
    expect(handoffBlock(STATUS_LIVE, true, url)).toBe("sandbox");
    expect(handoffBlock(STATUS_SANDBOX, false, url)).toBe("sandbox");
    expect(handoffBlock(STATUS_OFF, false, url)).toBe("disabled");
    expect(handoffBlock(null, false, url)).toBe("unverified");
    expect(handoffBlock(STATUS_LIVE, false, "http://www.kayak.no/in")).toBe("invalid_link");
    expect(handoffBlock(STATUS_LIVE, false, "javascript:alert(1)")).toBe("invalid_link");
    expect(handoffBlock(STATUS_LIVE, false, "not a url")).toBe("invalid_link");
  });

  it("hotellforespørselen på nettet, med stedet når det er valgt", () => {
    expect(hotelInquiryUrl()).toBe("https://hellosky.no/hotell-bil?fane=hotell");
    expect(hotelInquiryUrl("  ")).toBe("https://hellosky.no/hotell-bil?fane=hotell");
    expect(hotelInquiryUrl("Oslo & Akershus")).toBe("https://hellosky.no/hotell-bil?fane=hotell&sted=Oslo%20%26%20Akershus");
  });
});
