/**
 * Flyselskapene kunden kan velge i reisepreferansene: de appen kjenner navnet på. Samme liste som nettets flystatus
 * (contracts/carriers.ts, TRACKABLE_CARRIERS) – skrevet av her fordi appen bare henter typer fra contracts (Metro
 * bygger aldri rotens moduler inn). En test holder de to listene like.
 */
export const PREF_AIRLINES: readonly { iata: string; name: string }[] = [
  { iata: "DY", name: "Norwegian" },
  { iata: "SK", name: "SAS" },
  { iata: "WF", name: "Widerøe" },
  { iata: "KL", name: "KLM" },
  { iata: "LH", name: "Lufthansa" },
  { iata: "BA", name: "British Airways" },
  { iata: "AF", name: "Air France" },
  { iata: "AY", name: "Finnair" },
  { iata: "FI", name: "Icelandair" },
  { iata: "TK", name: "Turkish Airlines" },
  { iata: "EK", name: "Emirates" },
  { iata: "QR", name: "Qatar Airways" },
  { iata: "SQ", name: "Singapore Airlines" },
  { iata: "FR", name: "Ryanair" },
  { iata: "U2", name: "easyJet" },
  { iata: "DL", name: "Delta Air Lines" },
  { iata: "UA", name: "United Airlines" },
];
