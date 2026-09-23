// Lokal KAYAK-stub: serverer dokumentert PollResponse-form for OSL-ruter,
// med first-phase → complete, 429/500/tom-simulering via headere/query.
import http from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 4599);
const KEY = process.env.STUB_KEY ?? "stub-key";
const searches = new Map();

const AIRLINES = {
  DY: { displayName: "Norwegian", logoUrl: "http://127.0.0.1:" + PORT + "/logo/DY.png" },
  SK: { displayName: "SAS Scandinavian Airlines", logoUrl: "http://127.0.0.1:" + PORT + "/logo/SK.png" },
  BA: { displayName: "British Airways", logoUrl: "http://127.0.0.1:" + PORT + "/logo/BA.png" },
  LH: { displayName: "Lufthansa", logoUrl: "http://127.0.0.1:" + PORT + "/logo/LH.png" },
  KL: { displayName: "KLM Royal Dutch Airlines", logoUrl: "http://127.0.0.1:" + PORT + "/logo/KL.png" },
};
const PROVIDERS = {
  DY: { displayName: "Norwegian", logoUrls: { imageUrl: AIRLINES.DY.logoUrl } },
  SK: { displayName: "SAS Scandinavian Airlines", logoUrls: { imageUrl: AIRLINES.SK.logoUrl } },
  BA: { displayName: "British Airways", logoUrls: { imageUrl: AIRLINES.BA.logoUrl } },
  LH: { displayName: "Lufthansa", logoUrls: { imageUrl: AIRLINES.LH.logoUrl } },
  SKYPICKER: { displayName: "Kiwi.com", logoUrls: { imageUrl: "http://127.0.0.1:" + PORT + "/logo/KIWI.png" } },
  GOTOGATE: { displayName: "Gotogate", logoUrls: { imageUrl: "http://127.0.0.1:" + PORT + "/logo/GTG.png" } },
  MYTRIP: { displayName: "Mytrip", logoUrls: {} },
};
const AIRPORTS = {
  OSL: { displayName: "Oslo Gardermoen", cityName: "Oslo" },
  LHR: { displayName: "London Heathrow", cityName: "London" },
  BCN: { displayName: "Barcelona-El Prat", cityName: "Barcelona" },
  ARN: { displayName: "Stockholm Arlanda", cityName: "Stockholm" },
  CPH: { displayName: "Copenhagen Kastrup", cityName: "Copenhagen" },
  JFK: { displayName: "New York John F Kennedy Intl", cityName: "New York" },
  AMS: { displayName: "Amsterdam Schiphol", cityName: "Amsterdam" },
  FRA: { displayName: "Frankfurt am Main", cityName: "Frankfurt" },
  LIS: { displayName: "Lisbon Humberto Delgado", cityName: "Lisbon" },
};

function price(n, cur) { return { price: n, displayPrice: `${cur} ${n}` }; }

function buildResponse(start, currency, complete) {
  const legsReq = start.legs;
  const cabin = start.cabin;
  const legs = {}, segments = {}, results = [];
  const mk = (li, idx, airline, via, dep, dur1, lay, dur2) => {
    const L = legsReq[li];
    const o = L.origin.airports[0], d = L.destination.airports[0];
    const date = L.date;
    const t = (h, m) => `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    const addMin = (h, m, add) => { const tot = h * 60 + m + add; return [Math.floor(tot / 60) % 24, tot % 60]; };
    const [a1h, a1m] = addMin(dep, 0, dur1);
    const segIds = [];
    if (via) {
      const s1 = `${date}${airline}1${li}${idx}`; const s2 = `${date}${airline}2${li}${idx}`;
      const [d2h, d2m] = addMin(a1h, a1m, lay); const [a2h, a2m] = addMin(d2h, d2m, dur2);
      segments[s1] = { airline, flightNumber: `${1000 + idx * 7 + li}`, origin: o, destination: via, departureTime: t(dep, 0), arrivalTime: t(a1h, a1m), equipmentTypeName: "Boeing 737-800", duration: dur1, type: "flight" };
      segments[s2] = { airline, flightNumber: `${2000 + idx * 7 + li}`, origin: via, destination: d, departureTime: t(d2h, d2m), arrivalTime: t(a2h, a2m), equipmentTypeName: "Airbus A320neo", duration: dur2, type: "flight" };
      segIds.push({ id: s1, layover: { duration: lay } }, { id: s2 });
      const legId = `${o}${d}${date}${airline}${idx}`;
      legs[legId] = { duration: dur1 + lay + dur2, segments: segIds, departureTime: t(dep, 0), arrivalTime: t(a2h, a2m) };
      return legId;
    }
    const s1 = `${date}${airline}0${li}${idx}`;
    segments[s1] = { airline, flightNumber: `${1000 + idx * 7 + li}`, origin: o, destination: d, departureTime: t(dep, 0), arrivalTime: t(a1h, a1m), equipmentTypeName: "Boeing 737 MAX 8", duration: dur1, type: "flight" };
    const legId = `${o}${d}${date}${airline}${idx}`;
    legs[legId] = { duration: dur1, segments: [{ id: s1 }], departureTime: t(dep, 0), arrivalTime: t(a1h, a1m) };
    return legId;
  };
  const combos = [
    { airline: "DY", direct: true, dep: 7, base: 1290, providers: ["DY", "SKYPICKER"] },
    { airline: "SK", direct: true, dep: 9, base: 1890, providers: ["SK", "GOTOGATE"] },
    { airline: "BA", direct: true, dep: 12, base: 2140, providers: ["BA"] },
    { airline: "KL", direct: false, via: "AMS", dep: 6, base: 1590, providers: ["MYTRIP", "SKYPICKER"] },
    { airline: "LH", direct: false, via: "FRA", dep: 15, base: 1750, providers: ["LH"] },
  ];
  const pax = start.passengers.length;
  combos.forEach((c, idx) => {
    if (start.maxStops === 0 && !c.direct) return;
    if (!complete && idx >= 2) return;
    const legIds = legsReq.map((_, li) => mk(li, idx, c.airline, c.direct ? null : c.via, c.dep + li, c.direct ? 135 : 95, 75, 110));
    const total = Math.round(c.base * pax * legsReq.length * (cabin === "business" ? 3.2 : cabin === "premiumEconomy" ? 1.6 : cabin === "first" ? 5 : 1));
    const bookingOptions = c.providers.map((p, pi) => ({
      type: "regular",
      bookingUrl: `http://127.0.0.1:${PORT}/in?url=%2Fbook%2Fflight%3Fcode%3D${idx}.${pi}&provider=${p}`,
      providerCode: p,
      displayPrice: price(total + pi * 40, currency),
      segmentFares: legIds.flatMap((lid) => legs[lid].segments.map((s) => ({ segmentId: s.id, cabin: { code: cabin, displayName: cabin } }))),
      fareFamilies: [{ id: "STD", displayName: "Standard", amenities: [
        { code: "carryOnBag", restriction: "included", displayName: "Carry-on bag included" },
        { code: "checkedBag", restriction: pi === 0 && c.airline !== "DY" ? "included" : "fee", displayName: "Checked bag" },
        { code: "change", restriction: pi === 0 ? "included" : "fee", displayName: "Change" },
        { code: "refundable", restriction: c.airline === "BA" ? "included" : "unavailable", displayName: "Refunds" },
      ] }],
      badges: [...(c.direct ? [{ code: "direct", displayName: "Direct flight" }] : []), ...(c.airline === "BA" ? [{ code: "freeCancellation", displayName: "Free cancellation" }] : [])],
      fees: {
        basePrice: price(Math.round((total + pi * 40) * 0.85), currency),
        totalPrice: price(total + pi * 40, currency),
        carryOnBag: [{ bagNumber: "first", restriction: "included", displayPrice: price(0, currency) }],
        checkedBag: [{ bagNumber: "first", restriction: pi === 0 && c.airline !== "DY" ? "included" : "fee", displayPrice: price(pi === 0 && c.airline !== "DY" ? 0 : 450, currency) }],
        ...(pi > 0 ? { nonRefundableDisclosure: "Denne billetten kan ikke refunderes." } : {}),
      },
    }));
    results.push({ id: `r${idx}${legsReq[0].date.replace(/-/g, "")}`, bookingOptions, legs: legIds.map((id) => ({ id })) });
  });
  return { status: complete ? "complete" : "first-phase", pageSize: 60, totalCount: results.length, sort: { key: "price", direction: "asc" }, currency, priceMode: "total",
    passengers: { adults: pax, children: 0, infants: 0, infantsInSeat: 0, seniors: 0, students: 0, youth: 0 }, results, legs, segments, airlines: AIRLINES, airports: AIRPORTS, providers: PROVIDERS };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const json = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  if (url.pathname.startsWith("/logo/")) { res.writeHead(200, { "content-type": "image/svg+xml" }); return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="8" fill="#123"/><text x="20" y="26" font-size="14" text-anchor="middle" fill="#fff">${url.pathname.slice(6, 8)}</text></svg>`); }
  if (url.pathname.startsWith("/img/")) { res.writeHead(200, { "content-type": "image/svg+xml" }); const n = url.pathname.slice(5, 7); return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="920" height="460"><rect width="920" height="460" fill="#${(parseInt(n,36)*997%0xffffff).toString(16).padStart(6,'0')}"/><text x="460" y="240" font-size="40" text-anchor="middle" fill="#fff">Hotel photo ${url.pathname.slice(5)}</text></svg>`); }
  if (url.pathname === "/in") { res.writeHead(200, { "content-type": "text/html" }); return res.end(`<html><body><h1>KAYAK synthetic click page</h1><p>provider=${url.searchParams.get("provider")}</p></body></html>`); }
  if (url.searchParams.get("apiKey") !== KEY) return json(401, { status: 401, errorCode: "INVALID_API_KEY", errorMessage: "Invalid API key: " + url.searchParams.get("apiKey") });
  if (url.pathname === "/api/affiliate/autocomplete/v1/flights") {
    const term = (url.searchParams.get("searchTerm") ?? "").toLowerCase();
    const all = [
      { placeId: 1, primaryPlaceType: "airport", name: "Tbilisi Intl", fullName: "Tbilisi Intl, Georgia (TBS)", countryName: "Georgia", cityName: "Tbilisi", iataCode: "TBS", isMetro: false },
      { placeId: 2, primaryPlaceType: "city", name: "Zanzibar", fullName: "Zanzibar, Tanzania (ZNZ)", countryName: "Tanzania", cityName: "Zanzibar", iataCode: "ZNZ", isMetro: false },
    ];
    return json(200, { results: all.filter((a) => a.fullName.toLowerCase().includes(term)) });
  }
  // ── Hotels (KAYAK Hotels Search API 3.0, dokumentert form) ──
  const img = (id, i) => `http://127.0.0.1:${PORT}/img/${id}-${i}.svg`;
  if (url.pathname === "/api/affiliate/autocomplete/v1/hotels") {
    const term = (url.searchParams.get("searchTerm") ?? "").toLowerCase();
    const all = [
      { placeId: 58075, primaryPlaceType: "city", name: "Lisboa", fullName: "Lisboa, Portugal", countryName: "Portugal", cityName: "Lisboa", countryCode: "PT" },
      { placeId: 2674868, primaryPlaceType: "neighborhood", name: "Les Halles", fullName: "Les Halles, Paris, France", countryName: "France", cityName: "Paris", countryCode: "FR" },
      { placeId: 25588, primaryPlaceType: "city", name: "Boston", fullName: "Boston, MA, United States", countryName: "United States", cityName: "Boston", countryCode: "US" },
    ];
    return json(200, { results: all.filter((a) => a.fullName.toLowerCase().includes(term)) });
  }
  if (url.pathname === "/api/affiliate/autocomplete/v1/cars") {
    const term = (url.searchParams.get("searchTerm") ?? "").toLowerCase();
    const all = [
      { placeId: 25588, primaryPlaceType: "city", name: "Boston", fullName: "Boston, MA, United States", countryName: "United States", cityName: "Boston", countryCode: "US" },
      { placeId: 9, primaryPlaceType: "airport", name: "Boston Logan Intl", fullName: "Boston Logan Intl (BOS), United States", countryName: "United States", cityName: "Boston", iataCode: "BOS", countryCode: "US" },
      { placeId: 10, primaryPlaceType: "airport", name: "Oslo Gardermoen", fullName: "Oslo Gardermoen (OSL), Norway", countryName: "Norway", cityName: "Oslo", iataCode: "OSL", countryCode: "NO" },
    ];
    return json(200, { results: all.filter((a) => a.fullName.toLowerCase().includes(term)) });
  }
  const HPROV = [{ code: "BOOKINGDOTCOM", name: "Booking.com", logo: `http://127.0.0.1:${PORT}/logo/BK.png`, isDirect: false, isLanguageSupported: true }, { code: "HILTON", name: "Hilton", logo: `http://127.0.0.1:${PORT}/logo/HI.png`, isDirect: true, isLanguageSupported: true }, { code: "EXPEDIA", name: "Expedia", logo: `http://127.0.0.1:${PORT}/logo/EX.png`, isDirect: false, isLanguageSupported: true }];
  const hotel = (i, withImg, cur) => ({ id: 2589300 + i, key: `khotel:${2589300 + i}`, name: ["citizenM Tower of London", "Hotel Lisboa Plaza", "Grand Harbour Hotel", "Riverside Inn", "Old Town Boutique", "Skyline Suites"][i % 6] + (i > 5 ? ` ${i}` : ""), address: `${10 + i} Trinity Square`, hotelCountryCode: "PT", latitude: 38.72 + i / 100, longitude: -9.14, starRating: 3 + (i % 3), isSelfRated: false, lowestRate: 1200 + i * 137, href: "", distance: 0.6 + i * 0.4, isWithinBoundary: false, isGreatValue: i % 4 === 0, propertyType: 0, numberOfProviders: 3, numberOfRates: 5, guestRating: i % 5 === 4 ? -1 : 7.2 + (i % 4) * 0.6, numberOfReviews: 120 + i * 311, guestRatingSentiment: i % 5 === 4 ? undefined : "Veldig bra, 8.4", reviewQuotes: ["friendly staff", "great location"], description: i % 3 === 0 ? "Beskrivelse fra leverandøren: sentralt hotell med frokost og takterrasse." : undefined, policies: [{ code: "checkin", name: "Check-in", description: "From 2:00 pm" }, { code: "checkout", name: "Check-out", description: "Prior to 12:00 pm" }], featureSummary: [{ name: "Policy", description: "Pets allowed on request." }], images: withImg ? [{ large: img(i, 1), small: img(i, 1) }, { large: img(i, 2), small: img(i, 2) }, { large: img(i, 3) }] : [], rates: [0, 1, 2].map((p) => ({ roomName: ["Standard dobbeltrom", "Superior rom", "Suite"][p], totalRate: (1200 + i * 137 + p * 260) * 3, isCheapestRate: p === 0, hasFreeCancellation: p !== 1, canPayLater: p === 2, isBundledRate: false, inclusions: p === 0 ? [0] : [], availableRooms: 2 + p, providerIndex: p, isDeprioritisedForExcludedCharges: false, bookUri: `http://127.0.0.1:${PORT}/in?provider=${HPROV[p].code}&hotel=${2589300 + i}` })) });
  if (url.pathname === "/api/3.0/hotels") {
    if (!url.searchParams.get("userTrackId")) return json(400, { status: 400, errorCode: "MISSING_USER_TRACK_ID", errorMessage: "userTrackId required" });
    const cur = url.searchParams.get("currencyCode") ?? "USD";
    const results = Array.from({ length: 9 }, (_, i) => hotel(i, i !== 2, cur));
    return json(200, { isComplete: true, searchTime: 1200, totalResults: 9, totalAvailableResults: 9, totalFilteredResults: 9, currencyCode: cur, languageCode: "EN", lowestTotalRate: 3600, highestTotalRate: 9000, results, providers: HPROV, destination: { key: url.searchParams.get("destination"), name: "Lisboa", fullName: "Lisboa, Portugal", placeCountryCode: "PT" } });
  }
  if (url.pathname === "/api/3.0/hotel") {
    const key = url.searchParams.get("hotel") ?? ""; const i = Math.max(0, Number(key.split(":")[1]) - 2589300);
    // Dokumentert SingleHotelSearchResponse: hotellet på toppnivå, priser i `results`, omtaler i `reviews`.
    const { rates, guestRating, numberOfReviews, guestRatingSentiment, reviewQuotes, ...top } = hotel(i, i !== 2, "NOK");
    return json(200, { ...top, isComplete: true, searchTime: 900, totalResults: rates.length, currencyCode: url.searchParams.get("currencyCode") ?? "USD", languageCode: "EN", countryCode: "NO", providers: HPROV, results: rates, reviews: { numberOfReviews, sentiment: guestRatingSentiment, quotes: reviewQuotes.map((text) => ({ text, polarity: 1 })), aspects: [], reviewerTypes: [], guestRatings: { OVERALL: guestRating } } });
  }
  // ── Cars (KAYAK Cars Search API, dokumentert form) ──
  if (url.pathname === "/i/api/affiliate/search/car/v1/poll" && req.method === "POST") {
    let cb = ""; req.on("data", (c) => (cb += c)); req.on("end", () => {
      const parsed = JSON.parse(cb || "{}");
      const cars = [["Fiat 500", "economy", "Economy", "automatic", 4, 1, 42], ["Nissan Versa", "compact", "Compact", "manual", 5, 2, 48], ["Toyota Corolla", "intermediate", "Intermediate", "automatic", 5, 2, 55], ["Volvo XC60", "standardSuv", "Standard SUV", "automatic", 5, 3, 91], ["VW Multivan", "minivan", "Minivan", "manual", 7, 4, 120]];
      const results = cars.map((c, i) => ({ id: `car${i}`, bookingOptions: [{ providerCode: i % 2 ? "IPRICELINECAR" : "IAIRPORTRENTALCARS", agencyCode: i === 3 ? "sixt" : "hertz", bookingUrl: `http://127.0.0.1:${PORT}/in?provider=car${i}`, pickupLocationId: "28634", policy: { cancellation: i === 1 ? { isUnlimited: false, limitHours: 24 } : { isUnlimited: true }, mileage: i % 2 ? { code: "limited", limit: 100, displayName: "100 mi" } : { code: "unlimited", displayName: "Unlimited mileage" }, fuel: { code: "fullToFull", displayName: "Full-to-full", description: "Pick up and drop off the car with a full tank" } }, car: { image: i === 4 ? undefined : `http://127.0.0.1:${PORT}/logo/C${i}.png`, type: { code: c[1], displayName: c[2], groups: ["small"] }, brand: c[0], bags: c[5], passengers: c[4], doors: "doors4", transmission: c[3], fuel: "petrol", features: [{ code: "ac", displayName: "Air conditioning" }] }, price: { price: c[6] * 3, displayPrice: `$${c[6] * 3}` }, paymentType: "prepay", badges: i === 0 ? [{ code: "freeCancellation", displayName: "Free Cancellation" }, { code: "greatDeal", displayName: "Great Deal" }] : [] }] }));
      return json(200, { searchId: "car-search-1", cluster: "4", status: parsed.searchId ? "complete" : "first-phase", results, agencies: { hertz: { code: "hertz", displayName: "Hertz", logoUrls: { horizontalUrl: `http://127.0.0.1:${PORT}/logo/HZ.png` }, type: "regular" }, sixt: { code: "sixt", displayName: "Sixt", logoUrls: { horizontalUrl: `http://127.0.0.1:${PORT}/logo/SX.png` }, type: "regular" } }, providers: { IPRICELINECAR: { code: "IPRICELINECAR", displayName: "PricelineCar", logoUrls: { horizontalUrl: `http://127.0.0.1:${PORT}/logo/PL.png` } }, IAIRPORTRENTALCARS: { code: "IAIRPORTRENTALCARS", displayName: "AirportRentals", logoUrls: { horizontalUrl: `http://127.0.0.1:${PORT}/logo/AR.png` } } }, carLocations: { "28634": { locationId: "28634", locationType: "inTerminal", coordinates: { latitude: 42.36, longitude: -71.0 }, address: "15 Transportation Way", cityName: "Boston", countryCode: "US", displayDistance: "1.1 mi", airport: { code: "BOS", displayName: "Boston Logan Intl", terminalName: "Terminal B" } } }, pageSize: 500, totalCount: results.length, currency: parsed.resultParameters?.currency ?? "USD", priceMode: "total", sort: { key: "price" }, days: 3 });
    });
    return;
  }
  if (url.pathname !== "/i/api/affiliate/search/flight/v1/poll" || req.method !== "POST") return json(404, { status: 404, errorCode: "NOT_FOUND", errorMessage: "nope" });
  if (!url.searchParams.get("userTrackId")) return json(400, { status: 400, errorCode: "MISSING_USER_TRACK_ID", errorMessage: "userTrackId required" });
  let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
    const parsed = JSON.parse(body || "{}");
    const mode = process.env.STUB_MODE ?? "ok";
    if (mode === "429") return json(429, { status: 429, errorCode: "RATE_LIMIT_EXCEEDED", errorMessage: "Too many requests" });
    if (mode === "500") return json(500, { status: 500, errorCode: "INTERNAL", errorMessage: "boom" });
    if (mode === "slow") { return; } // aldri svar → timeout
    if (req.headers["sandbox-api-empty"] === "true" || mode === "empty") return json(200, { searchId: "empty1", cluster: "1", status: "complete", results: [], legs: {}, segments: {}, airlines: {}, airports: {}, providers: {}, currency: "NOK", priceMode: "total", totalCount: 0, passengers: {} });
    if (parsed.searchStartParameters) {
      const start = parsed.searchStartParameters;
      // Feilsimulering styrt av avreiseflyplass (så én stub-instans dekker alle tilfeller)
      const o0 = start.legs[0]?.origin?.airports?.[0];
      if (o0 === "TOS") return json(429, { status: 429, errorCode: "RATE_LIMIT_EXCEEDED", errorMessage: "Too many requests" });
      if (o0 === "TRD") return json(500, { status: 500, errorCode: "INTERNAL", errorMessage: "boom" });
      if (o0 === "BGO") return; // aldri svar → timeout
      if (o0 === "SVG") return json(200, { searchId: "empty1", cluster: "1", status: "complete", results: [], legs: {}, segments: {}, airlines: {}, airports: {}, providers: {}, currency: "NOK", priceMode: "total", totalCount: 0, passengers: {} });
      if (o0 === "KRS") { res.writeHead(200, { "content-type": "text/html" }); return res.end("<html>garbage</html>"); }
      if (start.legs.some((l) => !AIRPORTS[l.origin.airports[0]] || !AIRPORTS[l.destination.airports[0]])) return json(400, { url: "/poll", errors: [{ code: "UNRECOGNIZED_LOCATION", description: "unknown", localizedDescription: "Unknown location" }] });
      const id = Math.random().toString(36).slice(2, 12);
      const currency = parsed.resultParameters?.currency ?? "USD";
      searches.set(id, { start: { ...start, maxStops: parsed.resultParameters?.maxStops }, currency, polls: 0 });
      res.setHeader("set-cookie", "cluster=7; Path=/; HttpOnly");
      return json(200, { searchId: id, cluster: "7", ...buildResponse(searches.get(id).start, currency, false) });
    }
    const s = searches.get(parsed.searchId);
    if (!s) return json(400, { url: "/poll", errors: [{ code: "UNKNOWN_SEARCH", description: "unknown search", localizedDescription: "Unknown search" }] });
    s.polls += 1;
    return json(200, { searchId: parsed.searchId, cluster: "7", ...buildResponse(s.start, s.currency, s.polls >= 1) });
  });
});
server.listen(PORT, "127.0.0.1", () => console.log(`kayak stub on http://127.0.0.1:${PORT} (mode=${process.env.STUB_MODE ?? "ok"})`));
