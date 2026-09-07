/**
 * Selskapsinformasjon fra miljøvariabler med fornuftige standarder.
 * Brukes i footer, innholdssider (vilkår/personvern) og kontaktinfo.
 *
 *  VITE_ORG_NUMBER       – organisasjonsnummer (9 siffer)
 *  VITE_COMPANY_ADDRESS  – forretningsadresse
 *  VITE_SUPPORT_PHONE    – telefon, vises som skrevet
 *  VITE_SUPPORT_EMAIL    – e-post til kundeservice
 */
const env = import.meta.env as Record<string, string | undefined>;

const orgNumber = env.VITE_ORG_NUMBER?.trim() || "[JURIST: org.nr]";
const supportPhone = env.VITE_SUPPORT_PHONE?.trim() || "22 41 00 00";

export const COMPANY = {
  legalName: "HelloSky AS",
  brand: "HelloSky",
  orgNumber,
  orgNumberLabel: `Org.nr ${orgNumber}`,
  address: env.VITE_COMPANY_ADDRESS?.trim() || "Oslo, Norge",
  supportPhone,
  /** tel:-format (kun sifre, +47 hvis ikke angitt). */
  supportPhoneTel: supportPhone.startsWith("+") ? supportPhone.replace(/\s+/g, "") : `+47${supportPhone.replace(/\D/g, "")}`,
  supportEmail: env.VITE_SUPPORT_EMAIL?.trim() || "hei@hellosky.no",
  privacyEmail: env.VITE_SUPPORT_EMAIL?.trim() || "hei@hellosky.no",
  openingHours: "06–24 alle dager",
  /** Servicegebyr — speiler api/lib/pricing.ts (8 % + 250 kr). */
  serviceFeePercent: 8,
  serviceFeeFlatNok: 250,
} as const;
