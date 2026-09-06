# Roamly – driftsrunbook

Håndbok for vanlige hendelser i produksjon. Alle handlinger i admin-portalen
logges i aktivitetsloggen (`/admin/aktivitetslogg`).

---

## A. Varsler og hvor de går

| Hendelse | Hvor du ser det |
|---|---|
| Ny booking | E-post til `OPS_ALERT_EMAIL` + `/admin/bestillinger` |
| Booking feilet / avviker fra Duffel | `/admin` → «Krever oppfølging» + e-postvarsel |
| Døde jobber i køen | `/admin` + `/admin/innstillinger` + e-postvarsel |
| Feilede webhooks | `/admin/innstillinger` → «Siste webhooks» |
| Saker uten ansvarlig | `/admin` → «Saker uten ansvarlig» |

## B. Booking står i «Bookes hos leverandør» lenge

1. Åpne bestillingen → **Avstem mot Duffel nå**.
2. Systemet henter fersk status fra Duffel og oppdaterer tilstanden.
3. Hvis den fortsatt henger: sjekk Duffel-dashbordet for ordren
   (`orderId` står i bestillingen) og se `/admin/innstillinger` for døde jobber.

## C. Booking i «Avventer avstemming»

Betyr at Duffel har rapportert en endring (f.eks. flyttet avgang).
1. Åpne bestillingen, les hendelsesloggen.
2. **Avstem mot Duffel nå** for å hente siste status.
3. Kontakt kunden dersom reisen er endret (e-post/telefon fra bestillingen).
4. Marker deretter med riktig status via «Endre status» med begrunnelse.

## D. Behandle refusjon

Krever nylig innlogging (under 15 min siden – logg inn på nytt om nødvendig).
1. `/admin/refusjoner` → finn forespørselen.
2. Verifiser beløp mot betalingen (`/admin/betalinger`).
3. **Merk som behandlet** først etter at pengene faktisk er returnert via
   betalingsleverandøren (Vipps/Stripe/bank).
4. Bestillingen går automatisk til «Refundert» (hele beløpet) eller
   «Delvis refundert».

## E. Feilede jobber (dead letter queue)

`/admin/innstillinger` → «Feilede jobber».
1. Les feilmeldingen (`lastError`).
2. Fiks årsaken (f.eks. SMTP nede, Duffel timeout).
3. Trykk **Prøv igjen** – jobben legges tilbake i køen med samme dedupe-nøkkel,
   så den kan ikke kjøres dobbelt.

## F. Webhooks feiler

`/admin/innstillinger` → «Siste webhooks fra Duffel».
- **401/signature mismatch**: `DUFFEL_WEBHOOK_SECRET` i Railway stemmer ikke
  med den Duffel har. Kjør `npm run duffel:webhook` på nytt.
- **Ingen webhooks i det hele tatt**: sjekk at endepunktet er registrert i
  Duffel-dashbordet og at domenet svarer på `/api/webhooks/duffel`.
- Systemet svarer alltid raskt 200 OK og prosesserer asynkront – en feilet
  webhook kan trygt prosesseres på nytt (dedupe på event-ID).

## G. Nødstopp av booking

Sett `PUBLIC_INSTANT_BOOKING=false` i Railway og redeploy.
Nettsiden lar da ingen fullføre en direktebooking (brukes ved
leverandørproblemer eller mistenkt misbruk). Tilbudsflyt påvirkes ikke.

## H. Tilbakestille en ansatts tilgang

1. `/admin/innstillinger` → finn personen under «Ansatte».
2. OWNER kan endre rolle eller deaktivere – alle økter til personen
   tilbakekalles umiddelbart.
3. Mistet TOTP-enhet: OWNER deaktiverer og inviterer på nytt med samme
   e-post. Gamle gjenopprettingskoder blir ugyldige.

## I. Tilbakerulling av en release

1. Railway → web-tjenesten → **Deployments** → velg forrige grønne deploy →
   **Redeploy**. Gjenta for worker-tjenesten.
2. Databasemigreringer rulles **ikke** tilbake automatisk – nye migreringer
   skal alltid være bakoverkompatible.

## J. Sikkerhetshendelse

1. Sett `PUBLIC_INSTANT_BOOKING=false`.
2. Roter hemmeligheter i Railway: `DUFFEL_API_KEY`, `DUFFEL_WEBHOOK_SECRET`,
   SMTP-passord, databasepassord.
3. Deaktiver berørte ansattkontoer (alle økter tilbakekalles).
4. Sjekk `/admin/aktivitetslogg` for uventede handlinger (append-only,
   kan ikke være manipulert fra admin-UI).
