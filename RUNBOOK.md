# HelloSky – driftsrunbook

Håndbok for hendelser i produksjon. Alle handlinger i admin logges i aktivitetsloggen (`/admin/aktivitetslogg`,
append-only). Kritiske handlinger (refusjon, rolleendring) krever **fersk innlogging** (< 15 min) — logg inn på nytt om
du får «Krever nylig innlogging».

---

## A. Hvor varsler havner

| Hendelse | Kanal |
|---|---|
| Ny booking, booking feilet, beløpsavvik, ruteendring, flyselskapskansellering | `OPS_ALERT_EMAIL` + `OPS_ALERT_WEBHOOK_URL` (Slack) |
| **PENGER I RISIKO** (fangst feilet etter leverandørbekreftelse), gjenoppretting ga opp, daglig tak nådd | samme, med prefiks — behandles straks |
| Chargeback (`charge.dispute.created`) | samme + booking i `REVIEW` + rad i `/admin/svindel` |
| Døde jobber (dead-letter) | samme + `/admin/innstillinger` → Jobber |
| Alt som trenger et menneske | `/admin/gjennomgang` (review-køen) |

## B. Review-køen (`/admin/gjennomgang`)

Viser bookinger i `REVIEW`, `BOOKING_FAILED`, `AWAITING_RECONCILIATION` og fastlåste booking-forsøk. Per rad:

| Tilstand | Betyr | Gjør |
|---|---|---|
| `REVIEW` med forsøk `CAPTURE_FAILED` | Duffel-ordre finnes, men Stripe-fangst feilet | §D |
| `REVIEW` fra dispute | Chargeback mottatt | §F |
| `AWAITING_RECONCILIATION` | Leverandør har ikke utstedt PNR/billetter | **Avstem mot Duffel nå**; henger det > 1 t: sjekk ordren i Duffel-dashbordet, kontakt Duffel-support |
| Forsøk `SUPPLIER_UNKNOWN` | Ukjent utfall hos Duffel (timeout) | §C |
| Forsøk `FAILED_VOIDED` | Terminal feil; betalingen er annullert automatisk | Ingen handling — kunden har fått e-post. Sjekk at PI faktisk er `canceled` i Stripe |

Bruk **Endre status** (med begrunnelse) kun når du har verifisert faktisk tilstand hos Duffel og Stripe.

## C. `SUPPLIER_UNKNOWN` — gjenoppretting

Orkestratoren fikk timeout/ukjent svar da ordren ble sendt. Systemet søker etter ordre med `metadata.attempt_id=<forsøk>`
i tre runder (2, 4, 6 min). Finner den ordren → fortsetter til fangst og `CONFIRMED`. Finner den ingen → `FAILED_VOIDED`,
PaymentIntent annulleres, kunden får «bestilling feilet»-e-post, ops varsles («Gjenoppretting ga opp»).

Automatisk sikkerhetsnett: sweep (hvert 10. min) finner forsøk som har stått i `SUPPLIER_ORDERING`/`SUPPLIER_UNKNOWN`
i mer enn 5 minutter og legger `recover_attempt` i kø (én per forsøk per runde). Et forsøk som ble forlatt i
`SUPPLIER_ORDERING` (prosesskrasj) flyttes til `SUPPLIER_UNKNOWN` og får gjenopprettingsjobb automatisk.

Manuelt:
1. Søk i Duffel-dashbordet etter ordre med metadata `attempt_id` = forsøks-ID (står i booking-detaljen → Forsøk).
2. Finnes ordren og forsøket står i `SUPPLIER_UNKNOWN`: booking-detalj → forsøk → **Prøv igjen** (legger `recover_attempt` i kø).
3. Finnes ordren, men forsøket allerede er `FAILED_VOIDED` (kunden er refundert): **kanseller ordren hos Duffel manuelt**
   — ellers betaler dere for en billett ingen har.
4. Finnes den ikke: ingenting å gjøre; sjekk at PI er annullert i Stripe.

## D. Fangst feilet (PENGER I RISIKO)

Duffel har utstedt billetten, men `capturePaymentIntent` feilet (kort avvist ved fangst, Stripe nede, autorisasjon utløpt).
Booking ligger i `REVIEW`, betaling `authorized`, ingen hovedbok/kvittering ennå.

1. Åpne PaymentIntent i Stripe. Er den `requires_capture`?
   - Enten: booking-detalj → forsøk → **Prøv igjen**. Nytt fangstforsøk bruker en NY idempotensnøkkel
     (`<forsøk>:c<n>`), så Stripe spiller ikke av det feilede svaret på nytt.
   - Eller: **fang beløpet manuelt** i Stripe og kall `admin.markAttemptCaptured({ attemptId, pspChargeId, confirmFreshSession: true })`
     (krever `refunds:process` + innlogging < 15 min; revisjonslogges som `attempt.marked_captured`). Den kjører samme
     finalisering som orkestratoren: betaling `captured`, hovedbok, kvittering, bonus, booking `REVIEW → CONFIRMED`,
     bekreftelses-e-post. Idempotent — kan trygt kalles igjen.
2. Er autorisasjonen utløpt/kansellert? Kontakt kunden for ny betaling (send betalingslenke fra Stripe eller opprett
   tilbud i `/admin/tilbud`). Får dere ikke betalt innen billettens frist: kanseller ordren hos Duffel og sett booking
   til `CANCELLED` med begrunnelse.
3. Skriv internt notat på bookingen med hva som ble gjort.

## E. Refusjoner (`/admin/refusjoner`)

Tilstander: `requested → eligibility_checked → supplier_requested → supplier_confirmed → amount_confirmed →
psp_refund_created → psp_refund_pending/succeeded → customer_notified → closed` (evt. `psp_refund_failed`, `rejected`).

- **Kundekansellering** kjører automatisk til `closed` (Stripe-refusjon + hovedbok + kreditnota + e-post).
- **Flyselskapskansellering** (fra avstemming) stopper i `requested`: bekreft leverandørbeløpet i Duffel
  (order cancellation / refund) og **Godkjenn** med beløp.
- **Kulanse**: `Opprett refusjon` (`staff_goodwill`) med beløp og begrunnelse → **Godkjenn** (fersk sesjon). Beløpet kan aldri
  overstige fanget beløp minus allerede refundert (`REFUND_EXCEEDS_CAPTURED`).
- **`psp_refund_failed`**: les `lastError` (typisk: charge already refunded, insufficient balance). Rett årsaken i Stripe og
  trykk **Prøv igjen** — ny idempotensnøkkel brukes automatisk, hovedbokposteringen ble tilbakeført ved feilen.
- Refusjon som Stripe rapporterer `pending` lukkes når `refund.updated` (succeeded) kommer via webhook.

## F. Chargebacks

`charge.dispute.created` → `fraud_flags` (score 100), booking i `REVIEW`, ops-varsel.
1. Svar i Stripe-dashbordet innen fristen: legg ved kvittering (`/admin/bestillinger/<id>` → kvittering), billettdata og
   e-postlogg (`email_events` viser sendt bekreftelse).
2. Vurder kansellering hos Duffel hvis reisen ikke er påbegynt og saken ser svindelaktig ut.
3. Avklar flagget i `/admin/svindel` (booking går tilbake til `CONFIRMED` hvis det var falsk alarm).

## G. Ruteendringer (`/admin/ruteendringer`)

Avstemmingen oppdager endrede segmenter → `schedule_changes` (status `detected`), booking `CHANGE_REQUESTED`, kunden får
e-post med gammel/ny plan, ops varsles.
1. Vurder om endringen er akseptabel (< 2 t) eller gir rett til refusjon/ombooking.
2. Ta kontakt med kunden ved større endringer. Løs saken med **Marker som løst** (→ `CONFIRMED`) eller opprett refusjon
   (`schedule_change`/`airline_cancellation`).

## G2. Tilbud uten passasjerer

`quotesPublic.startPayment` og `book_from_quote` nekter (`INVALID_PASSENGER`, «Passasjeropplysninger mangler») når
tilbudet mangler passasjerer eller antallet ikke matcher tilbudet. Kunden fyller inn via tilbudslenken
(`quotesPublic.submitPassengers`), eller den ansatte sender `passengers[]` i `admin.createQuote`. Passnummer lagres
kryptert i `quotes.passengers_json` (`encrypted: true`) og flyttes til `passenger_documents` når sesjonen opprettes.
Et manuelt betalt tilbud uten passasjerer får status `failed` + ops-varsel: registrer passasjerer og merk som betalt på nytt.

## H. Jobber (`/admin/innstillinger` → Jobber)

- `failed`: retryes automatisk med backoff (15 s → 30 min). `dead`: ga opp etter `max_attempts` — ops varslet.
- **Prøv igjen** legger jobben tilbake med samme dedupe-nøkkel (dobbeltkjøring er umulig; alle håndterere er idempotente).
- Vanlige årsaker: SMTP nede (`send_email`), Duffel 5xx (`reconcile_order`), Stripe nede (`process_refund`).
- Worker nede? `jobs` med `status='pending'` og gammel `run_at` vokser. Sjekk worker-tjenestens logg/health; jobber låst av
  en krasjet worker frigis etter 5 min.

## I. Webhooks (`/admin/innstillinger` → Webhooks)

- Stripe 400 «Ugyldig signatur»: `STRIPE_WEBHOOK_SECRET` stemmer ikke med endepunktet i Stripe (ett secret per endepunkt).
- Duffel 401: `DUFFEL_WEBHOOK_SECRET` feil eller klokkeskjevhet > 5 min (replay-vindu). Kjør `npm run duffel:webhook` på nytt.
- Rader med `status='failed'`: worker kastet under behandling — feilen står i raden; jobben retryes automatisk.
- Endepunktene svarer alltid raskt 2xx og dedupliserer på event-ID; replays fra dashbordet er ufarlige.

## J. Nødbrytere

| Situasjon | Handling |
|---|---|
| Stopp all direktebooking | `PUBLIC_INSTANT_BOOKING=false` + redeploy web |
| Begrens eksponering første dager / mistenkt misbruk | `MAX_DAILY_LIVE_AMOUNT_MINOR` (øre per døgn) |
| Stripe-hendelse | Endre nøkler i Stripe → oppdater `STRIPE_*` → redeploy begge |
| Duffel-hendelse | Roter API-nøkkel i Duffel → `DUFFEL_API_KEY` → redeploy begge |

## J2. Retention / dataminimering (OTA-141/109)

Kjøres automatisk av sweep-jobben (hvert 10. min, `api/lib/retention.ts`). Alle steg er idempotente:

| Data | Regel |
|---|---|
| `customer_email_tokens`, `customer_otp_codes`, `customer_password_resets`, `booking_holds`, `booking_access_tokens` | Slettes 24 t etter utløp/bruk |
| `staff_invites` | Slettes 30 dager etter utløp/bruk |
| `staff_sessions` / `customer_sessions` | Utløpte/tilbakekalte slettes etter 7 / 30 dager |
| `webhook_events` | Etter 90 dager: `payload` tømmes, `status = archived` (raden beholdes for dedupe og statistikk) |
| `customers` | Uten bestilling siste 5 år (og eldre enn 5 år): e-post → `anon-<id>@anonymised.invalid`, navn/telefon nulles. Revisjonslogg `customers.anonymised` |

Bookinger, betalinger, hovedbok, fakturaer og revisjonslogg beholdes (bokføringsloven: 5 år). Kundekontoer
(`customer_accounts`) slettes kun på forespørsel (`deletedAt`), ikke automatisk. Manuell kjøring:
`npx tsx -e "import('./api/lib/retention').then(m => m.runRetention().then(console.log))"`.

## J3. Observability

- `SENTRY_DSN` satt → interne tRPC-feil (kun `INTERNAL_SERVER_ERROR`), jobbfeil i worker og unhandled rejections sendes
  til Sentry med `requestId`/`jobId`, aldri cookies eller PII.
- `GET /metrics` (bearer `METRICS_TOKEN`) — Prometheus-tellere per prosess, se DEPLOYMENT.md §8. En `jobs_dead_total`
  som øker = gå til H. Jobber.

## K. Nøkkelrotasjon

- **Stripe/Duffel/SMTP**: bytt i leverandørens dashbord, oppdater variabel, redeploy web + worker. Pågående booking-forsøk
  bruker idempotensnøkler og overlever restart.
- **`DUFFEL_WEBHOOK_SECRET`/`STRIPE_WEBHOOK_SECRET`**: registrer nytt endepunkt/secret, oppdater variabel, slett gammelt.
- **`PII_ENCRYPTION_KEY`**: feltkryptering (AES-256-GCM) av passnummer i `passenger_documents.identifier_ciphertext`.
  Det finnes ikke støtte for to samtidige nøkler, så rotasjon gjøres i et vedlikeholdsvindu:
  1. `PUBLIC_INSTANT_BOOKING=false`, stopp worker.
  2. Slett dokumenter som ikke lenger trengs: `DELETE FROM passenger_documents WHERE expires_on < CURDATE()` (og eldre enn
     reisens siste ankomst — de trengs kun frem til utreise).
  3. Kjør et engangsskript (tsx) som for hver gjenværende rad gjør `decryptField` med gammel nøkkel og `encryptField` med ny
     (`api/lib/crypto.ts` leser nøkkelen fra `env.PII_ENCRYPTION_KEY`; kjør to prosesser eller kopier funksjonene).
  4. Sett ny `PII_ENCRYPTION_KEY` på web + worker, redeploy, verifiser `revealPassengerDocument` på én booking.
  **Mist aldri nøkkelen** — uten den kan passdata ikke leses. Oppbevar den i hemmelighetsforvalteren med backup.
- **Database-passord**: roter i MySQL, oppdater `DATABASE_URL`, redeploy.

## L. Gjenoppretting (restore)

1. Daglig backup av MySQL (Railway: Database → Backups; ellers `mysqldump --single-transaction`).
2. Test gjenoppretting kvartalsvis: opprett tom database, `mysql < dump.sql`, kjør `node scripts/migrate.mjs`, pek en
   staging-web mot den og verifiser `/readyz` + en booking-detalj.
3. Ved faktisk gjenoppretting: sett `PUBLIC_INSTANT_BOOKING=false`, stopp worker, restore, kjør migrasjoner, start worker,
   avstem alle aktive bookinger (`sweep` kjører automatisk innen 10 min; eller **Avstem mot Duffel nå** per booking),
   sammenlign `payments` mot Stripe-dashbordet for perioden mellom backup og hendelse, og åpne bookingen på nytt.
4. Fakturanummerserien (`invoices.invoice_number`) skal være ubrutt — dokumenter eventuelle hull i regnskapet.

## M. Tilbakerulling av release

Redeploy forrige grønne deploy for **web og worker**. Migrasjoner rulles ikke tilbake (append-only, bakoverkompatible).

## N. Ansatte

- Deaktiver/rolleendring: `/admin/innstillinger` → Ansatte (OWNER, fersk sesjon). Alle sesjoner tilbakekalles.
- Mistet autentikator: OWNER → **Nullstill MFA**; personen setter opp TOTP på nytt ved neste innlogging.
- Mistenkelig aktivitet: sjekk `/admin/aktivitetslogg` (filter på bruker), roter hemmeligheter (§K).
