/** Flyplassøket. Vi søker bare fra og til den valgte flyplassen. */
const en = {
  title: "Choose airport",
  close: "Close",
  from: "Where are you flying from?",
  to: "Where are you going?",
  placeholder: "City, airport or code",
  exactOnly: "We only search from and to the airport you choose – never other airports in the same city.",
  searching: "Searching …",
  error: "Couldn't search for airports.",
  emptyTitle: "Find the airport",
  emptyBody: "Type at least two letters: a city, airport or code, for example Barcelona or BCN.",
  noneTitle: "No airport found",
  noneBody: "No matches. Try another name or an airport code.",
  rowLabel: (city: string, name: string, country: string, iata: string) => `${city}, ${name}, ${country}, code ${iata}`,
};

const nb: typeof en = {
  title: "Velg flyplass",
  close: "Lukk",
  from: "Hvor reiser du fra?",
  to: "Hvor skal du?",
  placeholder: "By, flyplass eller kode",
  exactOnly: "Vi søker bare fra og til flyplassen du velger – aldri andre flyplasser i samme by.",
  searching: "Søker …",
  error: "Kunne ikke søke etter flyplasser.",
  emptyTitle: "Finn flyplassen",
  emptyBody: "Skriv minst to bokstaver: by, flyplass eller kode, for eksempel Barcelona eller BCN.",
  noneTitle: "Fant ingen flyplass",
  noneBody: "Ingen treff. Prøv et annet navn eller en flyplasskode.",
  rowLabel: (city, name, country, iata) => `${city}, ${name}, ${country}, kode ${iata}`,
};

export const airport = { en, nb };
