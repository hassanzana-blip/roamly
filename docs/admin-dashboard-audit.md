# Eieradmin: revisjon før bygging

Skrevet før noe ble endret, fordi tre ting i oppdraget bygger på antakelser
som ikke stemmer med koden. De må ligge på bordet først.

## Det viktigste funnet

**HelloSky har ingen data om affiliate-inntekt. Ikke lite data – ingen.**

Oppdraget beskriver et dashbord bygget rundt
SØK → TREFF → LEVERANDØRKLIKK → OMDIRIGERING → KONVERTERING → PROVISJON.

Av de seks stegene finnes to i databasen i dag:

| Steg | Datakilde | Status |
|------|-----------|--------|
| Søk | `search_history` | **Delvis.** Bare innloggede kunder. `customer_id` er `NOT NULL`, så anonyme søk – de fleste – lagres ikke |
| Treff | ingen | Mangler |
| Leverandørklikk | ingen | **Mangler.** Ingenting logger at noen trykker «Se tilbud» og forlater siden |
| Omdirigering | ingen | Mangler |
| Konvertering | ingen | **Mangler.** Ingen tabell, ingen webhook, ingen import |
| Provisjon | ingen | **Mangler.** Ingen beløp, ingen status, ingen utbetaling |

Det finnes hverken `affiliate_*`, `conversion*`, `commission*` eller
`*click*` i skjemaet. Søkeord som `affiliate`, `conversion`, `commission`
gir null treff i `db/schema.ts`.

Konsekvensen er konkret: bygger jeg dashbordet slik det er beskrevet, vil
KPI-ene «Affiliate Commission», «Conversion Rate», «Provider Clicks»,
«Revenue per Click», «Confirmed Commission» og hele trakten stå tomme for
alltid. Ikke tomme fordi det er tidlig – tomme fordi ingenting måler dem.

**Derfor bygges sporingen først.** Uten den er eierdashbordet et vindu mot
en tom database, og det eneste alternativet er å finne på tall. Det gjør vi
ikke.

## Det nest viktigste funnet

**Adminen finnes allerede, og den er god.**

Oppdraget er skrevet som om `/admin` skal bygges fra bunnen. Realiteten:

* 30+ ruter under `/admin`, 20 sidefiler, 8 seksjoner
* Egen stab-autentisering (`api/staffAuth.ts`), adskilt fra kundeinnlogging
* **Ferdig rollemodell** i `api/lib/rbac.ts`: `OWNER`, `ADMIN`, `SUPPORT`,
  `FINANCE`, `READ_ONLY` – med 30 eksplisitte tillatelser, ikke bare
  rollenavn. Oppdraget ber om at «roller kan legges til senere». De finnes
* Revisjonslogg (`audit_logs`) med aktør, handling, ressurs, IP
* Kommandopalett og sidemeny som leser samme navigasjonsregister, slik at de
  ikke kan komme i utakt
* `api/insights.ts` – ekte spørringer, og kommentaren i fila sier allerede
  det oppdraget ber om: «Et diagram som fyller seg selv med anslag er verre
  enn ingen graf, fordi det ser like troverdig ut som et ekte»

Å bygge et parallelt «Owner Command Center» ved siden av dette ville gitt to
adminer som gradvis sier forskjellige ting om samme tall. **Vi utvider den
som finnes.**

## Det tredje funnet

**Unsplash-API-et finnes ikke i appen.**

Oppdraget sier at Unsplash-tilgang allerede er konfigurert i miljøet. Det
som finnes er en Unsplash-MCP tilgjengelig for meg som verktøy – ikke en
nøkkel appen kan bruke i produksjon. `grep -i unsplash` i `src/` og `api/`
gir bare de lokale fotoregistrene.

I tillegg avviser byggemiljøets nettverkspolicy nedlasting av bilder, så nye
filer kan ikke hentes inn herfra.

Adminen bruker derfor de 25 allerede lisensierte reisemålsbildene i
`public/destinations/`, samme kilde som den offentlige siden. Skal ekte
Unsplash-henting inn senere, er riktig løsning en server-side nøkkel og
hotlinking til Unsplashs CDN – det er det lisensen krever uansett.

## Hva som faktisk har data i dag

Disse kan vises ærlig, nå:

| Område | Tabell |
|--------|--------|
| Bestillinger, segmenter, hendelser | `bookings`, `booking_segments`, `booking_events` |
| Betaling, refusjon, hovedbok | `payments`, `refunds`, `refund_cases`, `ledger_entries` |
| Kassasesjoner og frafall | `checkout_sessions`, `booking_attempts` |
| Kunder og kontoer | `customers`, `customer_accounts` |
| Prisvarsler og prisovervåking | `price_alerts`, `price_watches` |
| Lagrede reiser | `saved_items`, `trip_boards` |
| Søk fra innloggede | `search_history` |
| Support og saker | `support_cases`, `support_messages`, `problem_reports` |
| Revisjon | `audit_logs` |
| Jobber og webhooks | `jobs`, `webhook_events`, `email_events` |
| Leverandørhelse | `api/lib/flightProviders.ts` (live, ikke lagret) |

**Men:** bestillingsmodellen er Duffel-direktesalg, og Duffel er slått av i
produksjon (`DUFFEL_API_KEY` tømt, KAYAK aktiv). Bestillingstallene er
derfor nær null i dag. Det er et ærlig null, og det skal stå som null.

## Plan

1. **Spor det som mangler.** Ny tabell `provider_clicks`: hvilken rute,
   hvilken leverandør, hvilket tilbud, hvilket beløp, hvilken enhet, hvilket
   marked, når. Skrives når noen forlater HelloSky for å bestille. Anonymt
   søk logges tilsvarende, uten å knytte det til en person.
2. **Konverteringer forberedes, ikke fabrikkeres.** Tabellstruktur og
   statusmodell (`estimated` / `confirmed` / `paid` / `reversed`) legges inn,
   men står tom til en leverandør faktisk rapporterer. Trakten viser stegene
   den har tall for, og sier rett ut hvor målingen stopper.
3. **Zana og Zyar** som to profiler på samme OWNER-konto, ikke to kontoer.
   Aktiv profil lagres på økten og følger med i revisjonsloggen.
4. **Visuell retning** fra referansebildet inn i den adminen som finnes:
   HelloSky-blå der referansen er gul, svart beholdt som i referansen, lyse
   flater, reisefoto som redaksjonell kontrast.
5. **Nye eiersider** oppå eksisterende data: leverandørytelse, søkeanalyse,
   marked, reisemål – hver med ærlige tomtilstander.

## Sikkerhet: slik det er i dag

Allerede på plass, og skal ikke svekkes:

* Egen stab-sesjon med MFA-støtte, adskilt fra kundeinnlogging
* `permittedProcedure` sjekker tillatelse på serveren for hvert kall
* `/admin` står i `NOINDEX_PREFIXES` og i `robots.txt`
* Adminen har eget tema (`[data-theme="admin"]`) isolert fra den offentlige

Det som må holdes: ingen ny admin-endepunkt uten `permittedProcedure`. Ingen
rolle lest fra nettleseren. Ingen leverandørnøkler i grensesnittet.
