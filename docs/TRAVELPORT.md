# Travelport (Flights API v11, NDC) — status og funn

Sist oppdatert: 2026-09-07.

## Kort status

Søk mot Travelport **virker** i pre-production. Verifisert ende til ende:
JFK–LAX ga 1 «offering» som ble kartlagt til 122 tilbud, første pris
180.10 GBP. Adapteret er likevel **avslått på nettstedet** — se hvorfor under.

| Ting | Status |
| --- | --- |
| OAuth-innlogging (`auth.pp.travelport.com`, JSON) | ✅ |
| API-vert `api.pp.travelport.net` | ✅ (`.com` avviser tokenet i gatewayen) |
| Innholdstype `NDC` | ✅ (kontoen har ikke rett på `GDS`) |
| Søk og kartlegging | ✅ testet mot ekte svar, både GDS- og NDC-form |
| Booking | ❌ ikke bygget — Duffel gjør fortsatt alle bestillinger |

## Hvorfor det ikke er slått på for besøkende

Testinnholdet dekker bare noen få selskaper og ruter. JFK–LAX og LHR–JFK gir
treff; OSL–LHR gir null. HelloSkys faktiske ruter finnes ikke i testdataene, så
et påslått Travelport-søk ville vist «ingen fly» for nesten alle ekte søk.
Duffel dekker søket inntil produksjonstilgang er på plass.

## Fem feil vi gikk gjennom for å komme hit

Hver av dem ga samme symptom — et søk som ikke virket — men helt ulike årsaker:

1. **Feil vert.** Hurtigstarten oppgir `api.pp.travelport.com`. Den kaster
   tokenet i gatewayen med `1012116 - Invalid token`. Riktig vert er
   `api.pp.travelport.net`, samme domene som innloggingen.
2. **Feil nøsting.** Kroppen skal ha `@type` på toppnivå og forespørselen under
   `CatalogProductOfferingsRequest`, ikke `CatalogProductOfferingsRequestAir`.
3. **Feil headere.** Kontoen bruker `TVP-PCC-Core` med PCC-en. Ingen
   `XAUTH_TRAVELPORT_ACCESSGROUP` (den hører til GDS-DevKit-en).
4. **Feil innhold.** `contentSourceList` må være `["NDC"]`. Med `["GDS"]` svarer
   API-et `AUTHORIZATION ERROR (2500)` — kontoen har ikke rett på GDS-innhold.
   Dette var årsaken til at alle header-varianter feilet likt.
5. **Feil kartlegging.** NDC-tilbud har ingen `flightRefs`. Flygningene finnes
   bare via produktets `FlightSegment`, sortert på `sequence`.

## Slik står oppsettet nå

| Variabel | Verdi |
| --- | --- |
| `TRAVELPORT_AUTH_URL` | `https://auth.pp.travelport.com/oauth/token` |
| `TRAVELPORT_BASE_URL` | `https://api.pp.travelport.net` |
| `TRAVELPORT_CONTENT_SOURCE` | `NDC` |
| `TRAVELPORT_SEARCH_ENABLED` | `false` |
| `TRAVELPORT_PROBE_ON_BOOT` | `false` |

## Neste steg

1. **Booking.** Travelport har ingen bookingkode ennå. Uten den kan et
   Travelport-tilbud ikke selges; `resolveOffer` avviser `tp_`-tilbud med vilje.
2. **Produksjonstilgang.** Er bedt om via MyTravelport. Krever IATA-lisens for
   billettering, alternativt en IATA-akkreditert konsolidator.
3. **Når produksjon er på plass:** bytt vertene til produksjonsverdiene, sett
   `TRAVELPORT_SEARCH_ENABLED=true`, og sett `TRAVELPORT_PROBE_ON_BOOT=true` for
   ett testsøk ved oppstart.
4. **Rydd bort** `travelportProbeVariants` og oppstartssonden i `api/boot.ts`
   når integrasjonen er ferdig — de er midlertidig feilsøking.
5. **Merkevarenivåer.** Ett NDC-«offering» ble til 122 tilbud (ett per
   merkenivå per produkt). Vurder å slå sammen merkenivåer per reise i
   resultatlista før dette vises for kunder.

## Sikkerhetsvalg som står

* Travelport-tilbud får id-prefikset `tp_` og avvises eksplisitt i
  `resolveOffer`, slik at en tilbuds-id fra én leverandør aldri kan sendes til
  en annen.
* Kartleggingen hopper over tilbud uten pris, valuta eller segmenter i stedet
  for å gjette. Bagasje rapporteres som «ikke oppgitt», aldri antatt.
* Ingen legitimasjon logges — kun statuskoder og feilkoder fra API-et.
