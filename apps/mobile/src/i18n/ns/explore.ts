/** Utforsk og reisemålskortene. Ingen «fra»-priser: vi har ingen verifisert pris uten datoer og reisende. */
const en = {
  title: "Explore destinations",
  fromSummary: (city: string, iata: string, dates: string, travellers: string) => `From ${city} (${iata}) · ${dates} · ${travellers}`,
  chooseOrigin: "Choose where you're flying from on the home screen.",
  seeFlights: "See flights",
  seeFlightsTo: (city: string, airport: string) => `See flights to ${city}, ${airport}`,
  countryCode: (country: string, iata: string) => `${country} · ${iata}`,
  viewList: "List",
  viewMap: "Map",
  mapLabel: "World map with HelloSky's destinations",
  mapNote: "Pins are destinations, not prices. You see prices after you search.",
  pinLabel: (city: string, iata: string) => `${city}, ${iata}, destination`,
  pinHint: "Shows the destination",
  destination: "Destination",
  airportLine: (airport: string, iata: string) => `${airport} (${iata})`,
  noPrice: "No price shown before you search with your dates and travellers.",
  close: "Close",
  webOnly: "The map is shown in the iPhone app. Choose a destination here instead.",
};

const nb: typeof en = {
  title: "Utforsk reisemål",
  fromSummary: (city, iata, dates, travellers) => `Fra ${city} (${iata}) · ${dates} · ${travellers}`,
  chooseOrigin: "Velg hvor du reiser fra på forsiden.",
  seeFlights: "Se flyreiser",
  seeFlightsTo: (city, airport) => `Se flyreiser til ${city}, ${airport}`,
  countryCode: (country, iata) => `${country} · ${iata}`,
  viewList: "Liste",
  viewMap: "Kart",
  mapLabel: "Verdenskart med HelloSkys reisemål",
  mapNote: "Nålene er reisemål, ikke priser. Prisene ser du etter at du har søkt.",
  pinLabel: (city, iata) => `${city}, ${iata}, reisemål`,
  pinHint: "Viser reisemålet",
  destination: "Reisemål",
  airportLine: (airport, iata) => `${airport} (${iata})`,
  noPrice: "Ingen pris før du søker med dine datoer og reisende.",
  close: "Lukk",
  webOnly: "Kartet vises i iPhone-appen. Velg et reisemål her i stedet.",
};

export const explore = { en, nb };
