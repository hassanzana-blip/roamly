# KAYAK Flights API – metasøk i HelloSky

HelloSky kan hente flyresultater fra KAYAK Affiliate Network og sende kunden videre til flyselskapet eller
reisebyrået for bestilling. HelloSky selger da **ikke** billetten, tar **ikke** betaling og legger **ikke** på
servicegebyr. Kilden for alt under er KAYAKs egen dokumentasjon på developers.kayak.com («Getting Started»,
«Flights Search API», «Autocomplete API»).

## Arkitektur

```
Nettleser ──tRPC flights.search──▶ Web (Hono) ──apiKey (kun server)──▶ KAYAK
                                     │ api/lib/flightProviders.ts  (FlightProvider: duffel | travelport | kayak | demo)
                                     │ api/lib/kayak.ts            (KayakFlightProvider: poll-løkke, kartlegging, autocomplete)
Kunden ◀── bookingUrl (KAYAKs klikklenke, urørt) ── tilbudet
```

- Nøkkelen sendes som `apiKey`-spørreparameter fra serveren. Nettleseren ser aldri nøkkelen, og loggene
  redakterer den (`apiKey` er i pino-`redact`, URL-er logges uten spørrestreng, KAYAKs feiltekster renses).
- Søk: `POST /i/api/affiliate/search/flight/v1/poll` starter søket og gir `searchId` + `cluster`; deretter polles
  samme endepunkt med `cluster` (og cookies) til `status` er `complete` (`first-phase` → `second-phase` → `complete`).
  Vi bruker maks ca. 22 s, svarer så snart `second-phase` har vart 9 s, og merker svaret `partial` når vi ga oss.
- Krav fra KAYAK som er innfridd: `userTrackId` (UUID per sluttbruker per økt – lages i nettleseren, se
  `src/lib/kayakSession.ts`), `User-Agent` fra kundens nettleser videresendes, `x-original-client-ip` = kundens IP.
- Passasjerer: `ADT` voksen, `CHD` barn 2–11, `YTH` 12–17 (alderen avgjør), `INL` spedbarn på fanget.
- Kabin: `economy | premiumEconomy | business | first`. Bare direktefly: `resultParameters.maxStops = 0`.
- Valuta: `resultParameters.currency` = kundens valutavalg (standard `KAYAK_DEFAULT_CURRENCY=NOK`), `priceMode=total`.
- Hacker fares (`includeSplit`) bes ikke om – de krever flere separate bestillinger.
- Resultater caches 5 min per normalisert søk på serveren (ikke delvise svar). Autocomplete caches 24 t per søkeord og
  holdes under 80 kall/time (sandbox tillater 100).

## Hva vises

Hvert `regular` bookingalternativ blir ett tilbud (`Offer` med `source: "kayak"` og `booking: { kind: "external" }`):
flyselskap med KAYAK-levert logo, tider, flyplasser, varighet, stopp/mellomlandinger, pris og valuta, leverandør
(«Selges av X · via KAYAK»), bagasje (fra `fees.carryOnBag/checkedBag`, ellers fare family-amenities, ellers «ikke
oppgitt» – aldri gjettet), gebyr for første kolli når oppgitt, ut- og hjemreise med segmenter, samt leverandørens
merkelapper (`freeCancellation` m.fl.) og påkrevd ikke-refunderbar-erklæring. Utslipp vises ikke (KAYAK oppgir det ikke).

CTA sier hvor kunden går: «Bestill hos Norwegian» (flyselskapet selv) eller «Se tilbud hos Kiwi.com» (byrå). Lenken
er `bookingUrl` urørt, `target=_blank`, `rel="noopener noreferrer nofollow sponsored"`. `/bestill` avviser
KAYAK-tilbud (`kyk_`-prefiks) med en forklarende melding.

## Flyselskap direkte vs. reisebyrå

KAYAK dokumenterer **ikke** et eget felt for «flyselskapet direkte». Det dokumenterte eksempelet viser at
flyselskapets eget salg har `providerCode` lik flyselskapets IATA-kode (`B6` = JetBlue) mens byråer har egne koder
(`SKYPICKER` = Kiwi.com). Vi klassifiserer derfor kun ut fra svaret selv (`classifySeller` i `api/lib/kayak.ts`):

- `airline` – leverandørkoden er ett av itinerarets markedsførende flyselskap
- `agency` – annen leverandør med navn i `providers`
- `unknown` – leverandør uten navn

Dette er en kartlegging av dokumenterte felter, ikke en svarteliste. `AIRLINE_DIRECT_MODE=prefer` (standard) setter
flyselskapet først; `only` (eller `AIRLINE_DIRECT_ONLY=true`) skjuler byråer. Kunden har i tillegg filteret
«Kun direkte fra flyselskapet». Vil vi ha en garantert klassifisering, må KAYAK bekrefte semantikken for
`providerCode` eller levere et eget felt – arkitekturen er klar for det (én funksjon å bytte).

## Sandbox vs. produksjon

Sandbox (`https://sandbox-en-us.kayakaffiliates.com`): kun USA-markedet, mockede priser, syntetiske klikksider,
250 flysøk/time, 100 autocomplete/time, nøkkel gyldig 3 måneder. Slike svar merkes alltid `sandbox: true` og vises
med «Testdata fra KAYAK sandbox – prisene er ikke reelle».

Vern mot at testdata blir «ekte»: `APP_ENV=production` nekter å starte med `FLIGHT_PROVIDER=kayak` +
`KAYAK_API_MODE=sandbox` uten `KAYAK_ALLOW_SANDBOX_IN_PRODUCTION=true`. Med `KAYAK_PREVIEW=true` kan et søk be om
KAYAK eksplisitt (`/sok?…&provider=kayak`) uten å endre hva vanlige søk viser.

Slik går vi fra sandbox til produksjon – **kun konfigurasjon**:

1. KAYAK godkjenner HelloSky som affiliat og sender produksjonsnøkkel + produksjonsdomene (base-URL for markedet).
2. Sett `KAYAK_API_KEY`, `KAYAK_BASE_URL`, `KAYAK_API_MODE=production`.
3. Sett `FLIGHT_PROVIDER=kayak` når KAYAK skal være standard (Duffel/Travelport beholdes og kan velges tilbake med
   `FLIGHT_PROVIDER=auto`).

Feiltyper: 401/403 → `SUPPLIER_REJECTED` (konfigurasjon – logges som feil), 429/5xx/nett → `SUPPLIER_UNAVAILABLE`
(kan prøves igjen), timeout → `SUPPLIER_TIMEOUT`, 400 → `SUPPLIER_REJECTED`. Kunden ser alltid HelloSkys egne
tekster, aldri KAYAKs råtekst. Sandkassens `sandbox-api-empty: true`-header kan brukes manuelt for å simulere null treff.

## Tester

`api/lib/kayak.test.ts` kjører mot KAYAKs dokumenterte `PollResponse`-eksempel (forespørsel, kartlegging,
selgerklassifisering, airline-direct, feilkoder, poll-løkke med falsk `fetch`, autocomplete).
`api/lib/flightProviders.test.ts` dekker valget av leverandør.
