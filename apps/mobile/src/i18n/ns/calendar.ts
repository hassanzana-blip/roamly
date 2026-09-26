/** Kalenderen for avreise og retur (ett ark for begge datoene). */
const en = {
  title: "Dates",
  titleOneWay: "Departure date",
  depart: "Departure",
  return: "Return",
  /** Hva neste trykk velger. */
  pickDepart: "Choose your departure date",
  pickReturn: "Now choose your return date",
  /** Mandag først. */
  weekdays: ["M", "T", "W", "T", "F", "S", "S"],
  weekdaysSpoken: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  nights: (n: number) => (n === 0 ? "Same day" : `${n} ${n === 1 ? "night" : "nights"}`),
  done: "Done",
  today: "today",
  roles: { depart: "departure", return: "return", same: "departure and return", inside: "during the trip" },
  hintDepart: "Sets the departure date",
  hintReturn: "Sets the return date",
  past: "unavailable, in the past",
  summarySpoken: (depart: string, ret: string | null, nights: string | null) => (ret ? `Departure ${depart}, return ${ret}, ${nights}` : `Departure ${depart}`),
};

const nb: typeof en = {
  title: "Datoer",
  titleOneWay: "Avreisedato",
  depart: "Avreise",
  return: "Retur",
  pickDepart: "Velg avreisedato",
  pickReturn: "Velg returdato",
  weekdays: ["M", "T", "O", "T", "F", "L", "S"],
  weekdaysSpoken: ["mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"],
  nights: (n) => (n === 0 ? "Samme dag" : `${n} ${n === 1 ? "natt" : "netter"}`),
  done: "Ferdig",
  today: "i dag",
  roles: { depart: "avreise", return: "retur", same: "avreise og retur", inside: "mellom avreise og retur" },
  hintDepart: "Velger avreisedato",
  hintReturn: "Velger returdato",
  past: "kan ikke velges, har passert",
  summarySpoken: (depart, ret, nights) => (ret ? `Avreise ${depart}, retur ${ret}, ${nights}` : `Avreise ${depart}`),
};

export const calendar = { en, nb };
