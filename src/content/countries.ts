/** ISO 3166-1 alpha-2 landkoder for pass-utstederland (norske navn). Norden først. */
export { COUNTRY_NB, countryName } from "@contracts/countries";
import { COUNTRY_NB } from "@contracts/countries";

/** Samme liste, som par – nedtrekket i kassen trenger rekkefølge og navn. */
export const COUNTRIES: { code: string; name: string }[] = Object.entries(COUNTRY_NB).map(([code, name]) => ({ code, name }));
export const PHONE_CODES: { code: string; label: string }[] = [
  { code: "+47", label: "Norge (+47)" },
  { code: "+46", label: "Sverige (+46)" },
  { code: "+45", label: "Danmark (+45)" },
  { code: "+358", label: "Finland (+358)" },
  { code: "+354", label: "Island (+354)" },
  { code: "+44", label: "Storbritannia (+44)" },
  { code: "+49", label: "Tyskland (+49)" },
  { code: "+48", label: "Polen (+48)" },
  { code: "+31", label: "Nederland (+31)" },
  { code: "+33", label: "Frankrike (+33)" },
  { code: "+34", label: "Spania (+34)" },
  { code: "+39", label: "Italia (+39)" },
  { code: "+90", label: "Tyrkia (+90)" },
  { code: "+964", label: "Irak (+964)" },
  { code: "+98", label: "Iran (+98)" },
  { code: "+1", label: "USA/Canada (+1)" },
  { code: "+971", label: "Emiratene (+971)" },
  { code: "+92", label: "Pakistan (+92)" },
  { code: "+91", label: "India (+91)" },
  { code: "+66", label: "Thailand (+66)" },
];
