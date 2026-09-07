#!/usr/bin/env node
/**
 * Travelport-sonde — kjøres LOKALT, ikke i produksjon.
 *
 * Henter en token og gjør ett søk mot pre-production, og lagrer rå-svaret til
 * fil slik at kartleggingen i api/lib/travelport.ts kan verifiseres mot noe
 * ekte. Utviklingssandkassen har ikke nettverkstilgang til travelport.com, så
 * dette steget må gjøres fra en maskin som har det.
 *
 * Legitimasjon leses fra miljøet og skrives aldri til skjerm eller fil:
 *   TRAVELPORT_CLIENT_ID, TRAVELPORT_CLIENT_SECRET, TRAVELPORT_USERNAME,
 *   TRAVELPORT_PASSWORD, TRAVELPORT_PCC
 *
 * Bruk:
 *   node scripts/travelport-probe.mjs OSL LHR 2026-10-15
 */

import { writeFile } from "node:fs/promises";

const AUTH_URL = process.env.TRAVELPORT_AUTH_URL ?? "https://auth.pp.travelport.com/oauth/token";
const BASE_URL = (process.env.TRAVELPORT_BASE_URL ?? "https://api.pp.travelport.com").replace(/\/$/, "");
const PCC = process.env.TRAVELPORT_PCC ?? "";

const required = ["TRAVELPORT_CLIENT_ID", "TRAVELPORT_CLIENT_SECRET", "TRAVELPORT_USERNAME", "TRAVELPORT_PASSWORD", "TRAVELPORT_PCC"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Mangler miljøvariabler: ${missing.join(", ")}`);
  process.exit(1);
}

const [from = "OSL", to = "LHR", date = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)] = process.argv.slice(2);

async function token() {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.TRAVELPORT_CLIENT_ID,
      client_secret: process.env.TRAVELPORT_CLIENT_SECRET,
      username: process.env.TRAVELPORT_USERNAME,
      password: process.env.TRAVELPORT_PASSWORD,
      grant_type: "password",
    }),
  });
  if (!res.ok) {
    console.error(`Token avvist: HTTP ${res.status}`);
    process.exit(1);
  }
  const body = await res.json();
  console.log(`✓ token hentet (utløper om ${body.expires_in ?? "?"} s)`);
  return body.access_token;
}

async function search(jwt) {
  const body = {
    CatalogProductOfferingsQueryRequest: {
      CatalogProductOfferingsRequestAir: {
        "@type": "CatalogProductOfferingsRequestAir",
        maxNumberOfUpsellsToReturn: 4,
        contentSourceList: ["GDS"],
        PassengerCriteria: [{ "@type": "PassengerCriteria", number: 1, passengerTypeCode: "ADT" }],
        SearchCriteriaFlight: [
          { "@type": "SearchCriteriaFlight", departureDate: date, From: { value: from.toUpperCase() }, To: { value: to.toUpperCase() } },
        ],
      },
    },
  };

  const res = await fetch(`${BASE_URL}/11/air/catalog/search/catalogproductofferings`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${jwt}`,
      "content-type": "application/json",
      accept: "application/json",
      "Accept-Version": "11",
      XAUTH_TRAVELPORT_ACCESSGROUP: PCC,
      "TVP-PCC-Core": PCC,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log(`søk: HTTP ${res.status} (${text.length} tegn)`);
  const out = "travelport-response.json";
  await writeFile(out, text);
  console.log(`rå-svar lagret i ${out} — del gjerne denne filen, den inneholder ingen legitimasjon`);

  if (!res.ok) process.exit(1);

  try {
    const json = JSON.parse(text);
    const offerings = json?.CatalogProductOfferingsResponse?.CatalogProductOfferings?.CatalogProductOffering ?? [];
    const refs = json?.CatalogProductOfferingsResponse?.ReferenceList ?? [];
    const flights = refs.flatMap((r) => r.Flight ?? []);
    console.log(`  ${offerings.length} tilbud, ${flights.length} flygninger i referanselisten`);
    const first = offerings[0]?.ProductBrandOptions?.[0]?.ProductBrandOffering?.[0];
    if (first) console.log(`  første pris: ${JSON.stringify(first.Price)}`);
  } catch {
    console.log("  (kunne ikke tolke svaret som JSON)");
  }
}

await search(await token());
