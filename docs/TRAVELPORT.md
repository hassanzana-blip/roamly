# Travelport (Flights API v11, GDS) — status og funn

Sist oppdatert: 2026-09-07.

## Kort status

Adapteret er skrevet, enhetstestet og **avslått**. Det står klart til å slås på
den dagen kontoen faktisk får tilgang. Ingenting i appen bruker det nå.

| Ting | Status |
| --- | --- |
| OAuth-innlogging | ✅ virker |
| Søk (`catalogproductofferings`) | ❌ `401 · 1012116 – Invalid token` |
| Kartlegging av svar | ⚠️ uverifisert — skrevet mot skjema, aldri sett et ekte svar |
| Booking | ❌ ikke bygget (Duffel gjør fortsatt alle bestillinger) |

## Hva vi vet sikkert

Innlogging mot `https://auth.pp.travelport.com/oauth/token` med
`grant_type=password` virker. Vi får en `Bearer`-token med 24 timers levetid.
Tokenets claims: `iss = https://auth.pp.travelport.com/`,
`aud = https://traefik-pp.edge-dev.tvptcloud.io/`, ingen `scope`.

Søkekallet mot `https://api.pp.travelport.com/11/air/catalog/search/catalogproductofferings`
avvises konsekvent med `401` og `1012116 - Invalid token`.

Vi prøvde fem varianter av samme kall ved oppstart (se `travelportProbeVariants`):

| Variant | Resultat |
| --- | --- |
| Headere nøyaktig som Travelports curl-eksempel | 401 · Invalid token |
| + `XAUTH_TRAVELPORT_ACCESSGROUP` | 401 · Invalid token |
| + `Accept-Version: 11` | 401 · Invalid token |
| Uten `TVP-PCC-Core` | 401 · Invalid token |
| Med feil sti (stor forbokstav) | **404** |

At feil sti gir 404 mens riktig sti gir 401 beviser at vi treffer riktig
endepunkt. Alle header-kombinasjoner feiler likt. Da er det ikke formatet.

## Konklusjon

Kontoen kan logge inn, men er ikke provisjonert for sanntidskall mot Flights
API. Travelports egen dokumentasjon sier det rett ut:

> TripServices credentials are required to run real-time requests. Travelport
> provides these credentials when you're provisioned with the TripServices APIs.

Selvbetjent registrering i MyTravelport gir altså en innlogging som kan hente
token og bla i Postman-eksempler, men ikke tilgang til å søke.

**Neste steg er en henvendelse til Travelport, ikke mer kode.** Be om at kontoen
(brukernavn `TP52731717`, PCC `7K99_1G`) provisjoneres for Flights API v11 GDS i
pre-production, og oppgi feilkoden `1012116`.

## Når tilgangen er på plass

1. Sett `TRAVELPORT_SEARCH_ENABLED=true` i Railway.
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
