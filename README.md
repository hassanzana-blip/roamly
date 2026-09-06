# Roamly

Norsk flybestillingstjeneste bygget på Duffel API (v2). React + TypeScript + Tailwind i front,
tRPC + Hono + Drizzle/MySQL i back. Alt kundevendt innhold er på norsk bokmål.

## Funksjoner

- **Flysøk** — tur/retur, én vei og multicity (inntil 3 etapper), opptil 9 reisende med
  alder per barn/baby, fire kabinklasser, norsk datovelger, flyplassforslag med norske navn
- **Resultater** — redigerbart søk på resultatsiden, prisvisning ±3 dager, beste/billigste/
  raskeste-valg, sortering og filtrering, utvidbare flydetaljer med mellomlandinger
- **Bestilling** — passasjerdata i henhold til Duffels krav (tittel, kjønn, fødselsdato,
  spedbarn knyttet til ansvarlig voksen, valgfritt pass), tilvalg for ekstra bagasje og
  setevalg med setekart, kortbetaling, gjenoppretting ved utløpt tilbud
- **Bekreftelse og «Min reise»** — bookingreferanse, reiserute med tilvalg, oppslag med
  referanse + e-post, bekreftelse på e-post (når SMTP er konfigurert)
- **Flystatus** — sanntidsvisning med tidslinje, gate, forsinkelser og flytype
- **Kundeservice** — FAQ, kontaktskjema med saksreferanse, «Dine saker»-historikk per
  e-post, selvbetjente endrings-/kanselleringsforespørsler fra «Min reise»
- **Teknisk** — rate limiting på alle endepunkter, databaseindekser på oppslagsfelt,
  WebGL-globus med statisk fallback og støtte for redusert bevegelse, OG/Twitter-metatagger

## Konfigurasjon (`.env`)

| Variabel | Beskrivelse |
|---|---|
| `DUFFEL_API_KEY` | Nøkkel fra app.duffel.com (`duffel_test_…` eller `duffel_live_…`). **Tom = demomodus** med realistiske data i Duffels format. |
| `DUFFEL_PAYMENT_TYPE` | `balance` (standard; ubegrenset saldo i Duffels testmodus) eller `card` (krever aktivert Duffel Payments + 3DS-komponent). |
| `SMTP_URL` | Full SMTP-URL (`smtp://bruker:pass@vertsnavn:587`) for utsendelse av bestillings- og saksbekreftelser. Alternativt enkeltfelt under. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | Enkeltfelt for SMTP dersom `SMTP_URL` ikke brukes. |
| `MAIL_FROM` | Avsenderadresse, f.eks. `Roamly <hei@roamly.no>` (standard). Uten SMTP logges e-poster i stedet for å sendes. |

### Gjenstående for drift

1. **Duffel-nøkkel**: Lim inn hele nøkkelen i `DUFFEL_API_KEY`. Alt annet er klart — søk,
   tilbud og ordreoppretting går direkte mot `api.duffel.com` så snart nøkkelen er satt.
2. **Kortbetaling fra kunder (valgfritt)**: For å belaste kundens kort (i stedet for
   Duffel-saldo) må teamet aktiveres for Duffel Payments hos Duffel (KYC), og checkout må
   kobles til Duffels 3DS-komponent (`createThreeDSecureSession` fra
   assets.duffel.com/components) slik at `three_d_secure_session_id` sendes med ordren.
3. **Live flystatus**: Statusmotoren er isolert i `api/lib/demo.ts` (`demoFlightStatus`) og
   kan erstattes med en sanntidskilde (f.eks. Aviationstack/FlightAware) uten endringer i
   frontend eller kontrakter.

## Utvikling

```bash
npm run dev       # http://localhost:3000
npm run check     # typekontroll
npm run test      # enhetstester (demo-motor, formatering, ratebegrenser)
npm run build     # produksjonsbygg (dist/)
npm start         # produksjonsserver
npm run db:push   # synkroniser databaseskjema
```

## Arkitektur

- `contracts/` — delte typer som speiler Duffel v2 (tilbud, slices, segmenter, ordre)
- `api/lib/duffel.ts` — Duffel-klient med mapping til kontraktstyper
- `api/lib/demo.ts` — demomotor (samme datamodell) når nøkkel ikke er satt
- `api/flights.ts` — tRPC-router: search, getOffer, createOrder, getOrder, findBooking,
  flightStatus, sendSupportMessage
- `db/schema.ts` — `bookings` (ordre-JSON, aldri kortdata) og `support_messages`
