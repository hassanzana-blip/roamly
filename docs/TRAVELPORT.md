# Travelport (Flights API v11, GDS) — status og funn

Sist oppdatert: 2026-09-07.

## Kort status

Adapteret er skrevet, enhetstestet og **avslått**. Det står klart til å slås på
den dagen kontoen faktisk får tilgang. Ingenting i appen bruker det nå.

| Ting | Status |
| --- | --- |
| OAuth-innlogging | ✅ virker (`auth.pp.travelport.net`, form-encoded) |
| Riktig API-vert | ✅ `api.pp.travelport.net` — `.com` avviser tokenet i gatewayen |
| Tokenet godtas av API-et | ✅ |
| Søk (`catalogproductofferings`) | ❌ `401 · AUTHORIZATION ERROR (2500)` — tilgangsgruppa |
| Kartlegging av svar | ✅ rettet mot DevKit-en og testet mot et ekte 200-svar |
| Booking | ❌ ikke bygget (Duffel gjør fortsatt alle bestillinger) |

## Hva vi vet sikkert

Innlogging mot `https://auth.pp.travelport.net/oauth/token` med
`grant_type=password` og **form-encoding** virker. Vi får en `Bearer`-token med
24 timers levetid. Claims: `iss = https://auth.pp.travelport.net/`,
`aud = https://traefik-pp.edge-dev.tvptcloud.io/`, ingen `scope`.

**Verten er avgjørende.** Hurtigstartsiden i MyTravelport oppgir
`api.pp.travelport.com`. Den verten kaster tokenet i gatewayen med
`1012116 - Invalid token`, uansett headere. `api.pp.travelport.net` — samme
domene som innloggingen — godtar tokenet, leser forespørselen og svarer med en
ekte `CatalogProductOfferingsResponse`.

Dette førte meg først på villspor: fordi alle header-varianter feilet likt mot
`.com`, konkluderte jeg feilaktig med at kontoen ikke var provisjonert. Den
konklusjonen var basert på feil vert.

På riktig vert står det igjen én ting — tilgangsgruppa:

| Variant | Svar fra API-et |
| --- | --- |
| `XAUTH_TRAVELPORT_ACCESSGROUP: 7K99_1G` | `AUTHORIZATION ERROR` (2500) |
| `XAUTH_TRAVELPORT_ACCESSGROUP: 7K99` | `AUTHORIZATION ERROR` (2500) |
| **uten** headeren | `AUTHORIZATION IS NOT CONFIGURED` |
| med `TVP-PCC-Core` i tillegg | `AUTHORIZATION ERROR` (2500) |

At svaret endrer seg når headeren fjernes beviser at den leses og kreves.
Verdien vi sender er altså ikke en tilgangsgruppe kontoen har rett på.

## Konklusjon

Tilgangsgruppa er ikke det samme som PCC-en. Vi mangler den verdien.

**Neste steg:** spør Travelport (eller finn i MyTravelport) hvilken verdi
`XAUTH_TRAVELPORT_ACCESSGROUP` skal ha for PCC `7K99_1G`, bruker `TP52731717`,
Flights API v11 GDS i pre-production. Oppgi at tokenet godtas av
`api.pp.travelport.net`, og at API-et svarer `AUTHORIZATION ERROR` kode 2500
med PCC-en som tilgangsgruppe, og `AUTHORIZATION IS NOT CONFIGURED` uten
headeren.

## Når tilgangen er på plass

1. Sett `TRAVELPORT_ACCESS_GROUP` (eller `TRAVELPORT_PCC`) til tilgangsgruppa
   Travelport oppgir, og `TRAVELPORT_SEARCH_ENABLED=true` i Railway.
2. Sett `TRAVELPORT_PROBE_ON_BOOT=true` — da kjører ett testsøk ved oppstart og
   logger resultatet, uten at noen må søke manuelt.
3. Les loggen. `Travelport: søkesvar kartlagt` viser hvor mange tilbud som ble
   kartlagt. Er tallet 0, logges strukturen på svaret slik at feltnavnene i
   `mapSearchResponse` kan rettes.
4. Når søk virker: bygg booking (Travelport har ingen bookingkode ennå), og
   først deretter kan Duffel fjernes.
5. Rydd bort `travelportProbeVariants` og oppstartssonden i `api/boot.ts` — de
   er midlertidig feilsøking.

## Sikkerhetsvalg som står

* Travelport-tilbud får id-prefikset `tp_` og avvises eksplisitt i
  `resolveOffer`, slik at en tilbuds-id fra én leverandør aldri kan sendes til
  en annen.
* Kartleggingen hopper over tilbud uten pris, valuta eller segmenter i stedet
  for å gjette. Bagasje rapporteres som «ikke oppgitt», aldri antatt.
* Ingen legitimasjon logges. Ved avvist innlogging logges kun statuskode og
  OAuth-feilkode, aldri kroppen vi sendte.
