/**
 * Feilmeldinger per kode. Serverens koder (api/lib/errors.ts) er stabile og
 * ment for oversettelse i klienten; appens egne er NETWORK, TIMEOUT og
 * BAD_RESPONSE. Ukjente koder får den generelle meldingen.
 */
const en = {
  NETWORK: "Couldn't reach HelloSky. Check your connection and try again.",
  TIMEOUT: "That took too long. Try again.",
  BAD_RESPONSE: "Something went wrong on our side. Try again in a moment.",
  INTERNAL: "Something went wrong on our side. Try again in a moment.",
  RATE_LIMITED: "Too many requests in a short time. Wait a moment and try again.",
  UNAUTHORIZED: "Your session has ended. Log in again.",
  FORBIDDEN: "You don't have access to this.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  VALIDATION: "Some of the details are not valid.",
  CONFLICT: "This clashes with another change. Try again.",
  EMAIL_NOT_VERIFIED: "Confirm your e-mail address to continue.",
  OFFER_EXPIRED: "This offer has expired. Search again for current prices.",
  OFFER_NOT_FOUND: "This offer is no longer available. Search again.",
  SUPPLIER_UNAVAILABLE: "The flight providers aren't answering right now. Try again in a moment.",
  SUPPLIER_TIMEOUT: "The flight providers took too long to answer. Try again.",
  PREVIEW: "Not available in this preview.",
  generic: "Something went wrong on our side. Try again in a moment.",
};

const nb: typeof en = {
  NETWORK: "Fikk ikke kontakt med HelloSky. Sjekk nettforbindelsen og prøv igjen.",
  TIMEOUT: "Det tok for lang tid å få svar. Prøv igjen.",
  BAD_RESPONSE: "Noe gikk galt hos oss. Prøv igjen om litt.",
  INTERNAL: "Noe gikk galt hos oss. Prøv igjen om litt.",
  RATE_LIMITED: "For mange forespørsler på kort tid. Vent litt og prøv igjen.",
  UNAUTHORIZED: "Økten din er avsluttet. Logg inn på nytt.",
  FORBIDDEN: "Du har ikke tilgang til dette.",
  NOT_FOUND: "Fant ikke det du lette etter.",
  VALIDATION: "Noen av opplysningene er ugyldige.",
  CONFLICT: "Handlingen kolliderer med en annen endring. Prøv igjen.",
  EMAIL_NOT_VERIFIED: "Bekreft e-postadressen din for å fortsette.",
  OFFER_EXPIRED: "Tilbudet er utløpt. Søk på nytt for å se oppdaterte priser.",
  OFFER_NOT_FOUND: "Vi finner ikke dette tilbudet lenger. Søk på nytt.",
  SUPPLIER_UNAVAILABLE: "Flyleverandørene svarer ikke akkurat nå. Prøv igjen om et øyeblikk.",
  SUPPLIER_TIMEOUT: "Det tok for lang tid å få svar fra flyleverandørene. Prøv igjen.",
  PREVIEW: "Finnes ikke i forhåndsvisningen.",
  generic: "Noe gikk galt hos oss. Prøv igjen om litt.",
};

export type ErrorKey = keyof typeof en;

export const errors = { en, nb };
