# Changelog

## 2026-09-07 — Revisjonsfunn B1–B9, OTA-040, observability, retention

### Rettelser
- **B1** Henvisningsbonus ved `TRAVELLED` ble kalt med booking-ID i stedet for kundekonto-ID (bonus ble aldri kreditert,
  eller kreditert feil konto). Sweep sender nå `bookings.customerAccountId` (hopper over når null).
- **B2** Tilbud (assisted booking) sendte ordre uten passasjerer. Nytt: `admin.createQuote` tar valgfritt `passengers[]`,
  `quotesPublic.submitPassengers` lar kunden fylle inn (pass lagres kryptert i `passengers_json`, flyttes til
  `passenger_documents` ved sesjon), `quotesPublic.getByToken` gir `passengerSlots`/`passengersSubmitted`, og
  `startPayment`/`book_from_quote` nekter med `INVALID_PASSENGER` («Passasjeropplysninger mangler»).
- **B3** Forsøk forlatt i `SUPPLIER_ORDERING` fikk aldri gjenopprettingsjobb. Nå enqueues `recover_attempt`, og sweep
  skanner forsøk som har stått i `SUPPLIER_ORDERING`/`SUPPLIER_UNKNOWN` > 5 min (dedupe per runde).
- **B4** Fangst-idempotensnøkkel får teller etter feil (`<key>:c<n>`) slik at nytt forsøk ikke får Stripes feilsvar replayet.
  Ny `admin.markAttemptCaptured` (refunds:process, fersk sesjon, revisjon) → `finalizeCapturedAttempt` kjører ordinær
  finalisering (`REVIEW → CONFIRMED`).
- **B5** `checkout.createSession`: parallelle kall med samme idempotensnøkkel gir én sesjon (duplikatnøkkel fanges),
  bonus reserveres inne i transaksjonen etter innsetting — aldri dobbelt trekk.
- **B6** `orders.confirmCancellation`: compare-and-swap på bookingtilstand (parallelle bekreftelser → én refusjonssak),
  kanselleringstilbudet må tilhøre bookingens ordre (verifiseres mot Duffel før og etter bekreftelse).
- **B7** `orders.get` returnerer `invoice` (siste kvittering) og `payment.pspReference` (siste 8 tegn).
- **B8** `flights.status` eksponerer `feeConfig { percent, flatMinorByCurrency }` inkl. admin-overstyringer.
- **B9** Segmenttider tolkes i flyplassens IANA-sone (`api/lib/time.ts: segmentInstant`) i `isCancellable`, TRAVELLED-
  sweep og T-24-påminnelser — ikke lenger serverens lokaltid.
- **OTA-040** Avstemming skriver i én transaksjon (sideeffekter etter commit); dedupe-nøkkel for ruteendrings-e-post er
  hash av gammel+ny rute, ikke `Date.now()`.

### Observability
- Valgfri Sentry (`SENTRY_DSN`): interne tRPC-feil, jobbfeil, unhandled rejections. `GET /metrics` (Prometheus,
  `METRICS_TOKEN`) med tellere for bookinger, feilede forsøk, Duffel-kall, Stripe-webhooks, døde jobber, refusjonssaker.

### Retention (OTA-141/109)
- Sweep sletter utløpte tokens/OTP/passordreset/holds, arkiverer `webhook_events`-payload etter 90 dager og anonymiserer
  `customers` uten bestilling siste 5 år. Se RUNBOOK §J2.

## 2026-09 — «Produksjonsklar OTA»: checkout-sesjoner, Stripe, orkestrator, refusjoner, testharness

### Booking og betaling
- Checkout-sesjoner (`checkout_sessions`) med serverside prising, låst `breakdown`, idempotens på `idempotencyKey`,
  Stripe PaymentIntent med manuell fangst; demobetaling kun utenfor produksjon.
- Booking-orkestrator som idempotent tilstandsmaskin (`booking_attempts`): revalidering av tilbud
  (`OFFER_EXPIRED`/`PRICE_CHANGED`), `SUPPLIER_UNKNOWN` med gjenoppretting på `metadata.attempt_id`, fangst etter
  leverandørbekreftelse, `REVIEW` ved fangstfeil (aldri auto-kansellering), daglig live-tak (`MAX_DAILY_LIVE_AMOUNT_MINOR`).
- Finalisering i én transaksjon: booking, segmenter, billetter, betaling, hovedbok (dobbelt bokføring), kvittering med
  ubrutt fakturanummerserie, e-postkø. Bonusopptjening/-bruk for innloggede kunder.
- **Fikset:** gjenoppretting etter timeout stoppet etter første runde — `recover_attempt` ble re-enqueuet med samme
  dedupe-nøkkel som den kjørende jobben og ble stille forkastet. Nøkkelen er nå per runde (`recover:<id>:<n>`), slik at
  alle tre rundene kjøres og forsøket ender i `FAILED_VOIDED` (PI annulleres, kunde varsles) når ordren ikke finnes.

### Refusjoner
- Egen tilstandsmaskin (`refund_cases`/`refund_events`), kundekansellering via Duffel order cancellation, flyselskaps-
  kansellering oppdaget av avstemming (refusjonssak + support-sak), kulanse fra admin med fersk-sesjonskrav.
- Stripe-refusjon idempotent med ny nøkkel etter feil, tilbakeføring i hovedbok ved `psp_refund_failed`, kreditnota,
  `REFUNDED`/`PARTIALLY_REFUNDED`, beløp alltid begrenset av fanget beløp (`REFUND_EXCEEDS_CAPTURED`).

### Avstemming og webhooks
- `reconcile_order`/`sweep`: PNR og billetter i etterkant, beløpsavvik, flyselskapskansellering, ruteendringer
  (`schedule_changes` + `CHANGE_REQUESTED` + e-post), `TRAVELLED`, T-24h-påminnelse, utløp av sesjoner/tilbud.
- Webhooks for Stripe (signatur via SDK) og Duffel (HMAC, replay-vindu 5 min) med dedupe på event-ID og behandling i worker.
  Chargeback → `fraud_flags` + `REVIEW` + ops-varsel.

### Worker og jobber
- Outbox (`jobs`) med `active_dedupe_key` (én aktiv jobb per nøkkel), prioritet, backoff, dead-letter + ops-varsel,
  atomisk claim og frigivelse av låser fra krasjede workere.
- Jobbhåndterere flyttet til `api/lib/workerHandlers.ts` (`dispatch`, `runJob`) — `api/worker.ts` eier bare løkken og
  starter den kun som entrypoint (`dist/worker.js`) eller med `WORKER_MAIN=true`. Gjør handlerne importerbare i tester.

### Sikkerhet og tilgang
- CSP uten `unsafe-inline` for script (sha256 for inline-skript i bygget), `X-Frame-Options: DENY`, Origin-sjekk på
  muterende tRPC-kall, kroppsgrenser, rate limiting (`RATE_LIMITED` + `retryAfterSec`), `x-request-id` på alle svar.
- Staff: obligatorisk TOTP med gjenopprettingskoder, sesjonsrotasjon, fersk sesjon for kritiske handlinger, RBAC per
  tillatelse, revisjonslogg. Kunde: e-postverifisering kreves for reiser/saker/eksport, GDPR-eksport og anonymisert sletting.
- PII-feltkryptering (AES-256-GCM) av passnummer; kun siste 4 tegn i admin, full visning krever `customers:reveal` + revisjon.
- `assertProductionSafety()`: production nekter å starte uten live-nøkler, SMTP, PII-nøkkel og https.

### Duffel-klient
- Byttbar klient (`setDuffelClient`) med in-process fake (`DuffelFake`) for tester: moduser `ok`, `timeout`,
  `timeout_lost` (ny), `price_up`, `expired`, `no_pnr`, `reject`, `unavailable`, samt `liveMode`-flagg for å teste live-vern.

### Testing
- **Integrasjonstester mot ekte MySQL/MariaDB** (`npm run test:it`, `api/test/*.it.ts`, 45 tester): full checkout-flyt i demo
  og med Stripe-mock + Duffel-fake, idempotens under parallelle kall, alle feilmoduser, bags, daglig tak, fangstfeil,
  validering og PII-maskering, avbestilling/refusjon (demo + Stripe pending/failed/retry/webhook), tilgangskontroll,
  HTTP-sikkerhet (CSP, Origin, 429, 413), webhooks (signatur, dedupe), avstemming (kansellering, ruteendring, idempotens),
  jobbkø-semantikk, staff-innlogging med TOTP/gjenopprettingskoder og kundekonto-livsløp.
- Harness i `api/test/setup.ts` (tRPC-caller med fabrikert kontekst, `truncateAll`, `runJobsUntilIdle`), egen database
  `hellosky_it` opprettet og migrert av `globalSetup`.
- **E2E (Playwright)** `e2e/booking.spec.ts`: forside → søk → tilbud → skjema → demobetaling → PNR, desktop + 360 px mobil,
  axe-core uten kritiske feil på `/`, `/sok`, `/bestill`. Starter web + worker fra `dist/` selv.
- Enhetstester (148) uendret grønne.

### CI, Docker og drift
- GitHub Actions: typecheck, lint, unit, integrasjon (MySQL 8-tjeneste), build, `drizzle-kit check`, `migrate:check`
  (feiler ved skjemaendring uten migrasjon), Playwright-e2e og Docker-bygg med `/healthz`-røyktest.
- Dockerfile: multi-stage (`deps` → `build` → `prod-deps` → `runtime` på `node:22-slim`), ikke-root, `HEALTHCHECK`,
  `ENTRYPOINT ["node"]`, `CMD ["dist/boot.js"]`; worker som `dist/worker.js`; migrasjoner via `scripts/migrate.mjs`
  (kopiert inn i bildet sammen med `db/migrations`). `.dockerignore` utelater `.env*`, tester, e2e og dokumentasjon.
- Railway-maler `deploy/railway-web.json` (pre-deploy migrering) og `deploy/railway-worker.json` + `deploy/README.md`.
- Dokumentasjon skrevet om: `README.md` (arkitektur som den er nå), `DEPLOYMENT.md` (full env-tabell, to tjenester,
  Stripe/Duffel-webhooks, go-live-sjekkliste), `RUNBOOK.md` (review-kø, `SUPPLIER_UNKNOWN`, fangstfeil, refusjoner,
  chargebacks, ruteendringer, nøkkelrotasjon, restore), `.env.example` (alle variabler, HelloSky-navn).
  Fjernet utdaterte `docs/ARCHITECTURE-INVENTORY.md`, `info.md`, `e2e-n4.py` og ubrukt `.backend-features.json`.
