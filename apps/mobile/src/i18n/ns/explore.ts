/** Utforsk og reisemålskortene. Ingen «fra»-priser: vi har ingen verifisert pris uten datoer og reisende. */
const en = {
  title: "Explore destinations",
  fromSummary: (city: string, iata: string, dates: string, travellers: string) => `From ${city} (${iata}) · ${dates} · ${travellers}`,
  chooseOrigin: "Choose where you're flying from on the home screen.",
  seeFlights: "See flights",
  seeFlightsTo: (city: string, airport: string) => `See flights to ${city}, ${airport}`,
  countryCode: (country: string, iata: string) => `${country} · ${iata}`,
};

const nb: typeof en = {
  title: "Utforsk reisemål",
  fromSummary: (city, iata, dates, travellers) => `Fra ${city} (${iata}) · ${dates} · ${travellers}`,
  chooseOrigin: "Velg hvor du reiser fra på forsiden.",
  seeFlights: "Se flyreiser",
  seeFlightsTo: (city, airport) => `Se flyreiser til ${city}, ${airport}`,
  countryCode: (country, iata) => `${country} · ${iata}`,
};

export const explore = { en, nb };
