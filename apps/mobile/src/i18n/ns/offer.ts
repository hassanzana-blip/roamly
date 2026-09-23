/** Fakta om et tilbud: bagasje, vilkår, hva prisen gjelder, hvem som selger. */
export type TripKind = "roundtrip" | "oneway" | "multi";
export type SellerKind = "airline" | "agency" | "unknown";

const en = {
  bags: {
    carryOn: "Cabin bag",
    checked: "Checked bag",
    included: "Included",
    includedCount: (n: number) => `${n} included`,
    notIncluded: "Not included",
    unknown: "Not stated",
    shortIncluded: (label: string) => `${label} included`,
    shortNotIncluded: (label: string) => `No ${label.toLowerCase()}`,
    shortUnknown: (label: string) => `${label}: not stated`,
  },
  conditions: {
    refund: "Refund before departure",
    change: "Change before departure",
    allowed: "Allowed according to the provider",
    allowedFee: "Allowed for a fee, according to the provider",
    notAllowed: "Not allowed",
  },
  tripKinds: { roundtrip: "Return", oneway: "One way", multi: "Multi-city" } satisfies Record<TripKind, string>,
  adults: (n: number) => `${n} ${n === 1 ? "adult" : "adults"}`,
  children: (n: number) => `${n} ${n === 1 ? "child" : "children"}`,
  infants: (n: number) => `${n} ${n === 1 ? "infant" : "infants"}`,
  priceBasis: (travellers: string, trip: string) => `Total for ${travellers} · ${trip}`,
  sellerKinds: { airline: "Airline", agency: "Travel agency", unknown: "Provider" } satisfies Record<SellerKind, string>,
  handoff: (provider: string) => `View offer at ${provider}`,
  soldByHelloSky: "HelloSky",
};

const nb: typeof en = {
  bags: {
    carryOn: "Håndbagasje",
    checked: "Innsjekket bagasje",
    included: "Inkludert",
    includedCount: (n) => `${n} stk. inkludert`,
    notIncluded: "Ikke inkludert",
    unknown: "Ikke oppgitt",
    shortIncluded: (label) => `${label} inkludert`,
    shortNotIncluded: (label) => `Uten ${label.toLowerCase()}`,
    shortUnknown: (label) => `${label}: ikke oppgitt`,
  },
  conditions: {
    refund: "Refusjon før avreise",
    change: "Endring før avreise",
    allowed: "Tillatt ifølge tilbyderen",
    allowedFee: "Tillatt mot gebyr ifølge tilbyderen",
    notAllowed: "Ikke tillatt",
  },
  tripKinds: { roundtrip: "Tur-retur", oneway: "Én vei", multi: "Flere strekninger" },
  adults: (n) => `${n} ${n === 1 ? "voksen" : "voksne"}`,
  children: (n) => `${n} barn`,
  infants: (n) => `${n} spedbarn`,
  priceBasis: (travellers, trip) => `Totalt for ${travellers} · ${trip}`,
  sellerKinds: { airline: "Flyselskap", agency: "Reisebyrå", unknown: "Tilbyder" },
  handoff: (provider) => `Se tilbud hos ${provider}`,
  soldByHelloSky: "HelloSky",
};

export const offer = { en, nb };
