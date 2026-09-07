# HelloSky

Norsk flybestillingstjeneste (OTA) på Duffel. React + Vite + Tailwind i front, Hono + tRPC + Drizzle/MySQL i back,
Stripe som betalingsleverandør, én worker-prosess for alt asynkront arbeid. Alt kundevendt innhold er på norsk bokmål.

- **Web** (`dist/boot.js`): nettside, tRPC-API, webhooks (Stripe/Duffel), health checks
- **Worker** (`dist/worker.js`): outbox-jobber — booking-orkestrering, refusjoner, avstemming, e-post, sweep
- **Database**: MySQL 8 / MariaDB 10.11 / TiDB (migrasjoner i `db/migrations`)

Se [DEPLOYMENT.md](DEPLOYMENT.md) for drift, [RUNBOOK.md](RUNBOOK.md) for hendelser og [CHANGELOG.md](CHANGELOG.md) for
hva som er nytt.

## Arkitektur

```
Nettleser ──tRPC──▶ Web (Hono)                     Worker (poll jobs)
                     │ flights.search → Duffel/demo   │ process_booking_attempt → orkestrator
                     │ checkout.createSession         │ recover_attempt        → gjenoppretting (SUPPLIER_UNKNOWN)
                     │   → checkout_sessions          │ process_refund         → refusjon (Stripe/demo) + hovedbok
                     │   → Stripe PaymentIntent       │ reconcile_order/sweep  → avstemming mot Duffel
                     │ paymentAuthorized / webhook    │ stripe_webhook/duffel_webhook
                     │   → booking_attempts + jobb    │ send_email             → e-post (email_events)
                     └─ /api/webhooks/{stripe,duffel} → webhook_events (dedupe) → jobb
```

### Bestillingsflyten (checkout → Stripe → booking attempt → Duffel)

1. **`checkout.createSession`** priser tilbudet på serveren (leverandørpris + tilvalg + servicegebyr − bonus), låser
   `breakdown` i `checkout_sessions`, lagrer passasjerer (passnummer kryptert i `passenger_documents`) og oppretter en
   Stripe **PaymentIntent med manuell fangst**. Idempotent på `idempotencyKey`. Uten Stripe-nøkler brukes
   `provider: "demo"` (forbudt i `APP_ENV=production`).
2. Kunden betaler i Stripe Elements — kortdata når aldri serveren.
3. **`checkout.paymentAuthorized`** (klient) eller `payment_intent.amount_capturable_updated` (webhook) verifiserer
   beløp/valuta mot PaymentIntent og oppretter **én** `booking_attempts`-rad (unik `idempotency_key`) + jobben
   `process_booking_attempt`.
4. **Orkestratoren** (`api/lib/orchestrator.ts`) kjører en idempotent tilstandsmaskin per forsøk:
   `PAYMENT_AUTHORIZED → SUPPLIER_ORDERING → SUPPLIER_CONFIRMED → CAPTURED → CONFIRMED`.
   - Ferskt tilbud revalideres: utløpt → `OFFER_EXPIRED`, dyrere → `PRICE_CHANGED` (sesjonen `price_changed`, PI annulleres).
   - Timeout/ukjent utfall → `SUPPLIER_UNKNOWN` og `recover_attempt` (oppslag på `metadata.attempt_id`); tre runder uten
     treff → `FAILED_VOIDED`, PI annulleres, kunden varsles.
   - Fangst feiler etter leverandørbekreftelse → booking i `REVIEW`, **aldri** auto-kansellering, ops varsles.
   - Daglig live-tak (`MAX_DAILY_LIVE_AMOUNT_MINOR`) stopper nye live-bookinger med `DAILY_CAP`.
5. **Finalisering** skriver booking, segmenter, billetter, betaling, hovedbok (dobbelt bokføring, balansert per valuta),
   kvittering med løpende fakturanummer og legger `booking_confirmation` + `payment_receipt` i e-postkøen — alt i én
   transaksjon. `checkout.status` polles av klienten til `confirmed`/`failed`.

### Refusjoner

`refund_cases` har egen tilstandsmaskin (`requested → … → amount_confirmed → psp_refund_created → psp_refund_succeeded →
customer_notified → closed`). Kunden avbestiller via `orders.cancellationQuote` + `orders.confirmCancellation`
(Duffel order cancellation); flyselskapskansellering oppdages av avstemmingen (`airline_cancellation` + support-sak);
ansatte oppretter kulanse via `admin.requestRefund` og godkjenner med `admin.approveRefund` (krever fersk sesjon).
Beløp til kunde begrenses alltid av fanget beløp. Jobben `process_refund` gjør Stripe-refusjonen idempotent og bokfører
(`ledger_entries`, kreditnota i `invoices`).

### Worker-jobber (`jobs`-tabellen)

Outbox med `dedupe_key`/`active_dedupe_key` (kun én aktiv jobb per nøkkel), prioritet, eksponentiell backoff og
dead-letter etter `max_attempts` (ops varsles; retry fra admin → Innstillinger → Jobber). Jobbtyper og håndterere ligger i
`api/lib/workerHandlers.ts`; poll-løkken i `api/worker.ts`. Periodisk `sweep` avstemmer aktive bookinger, utløper gamle
checkout-sesjoner, markerer `TRAVELLED`, sender T-24h-påminnelser og rydder sesjoner.

### Sikkerhet (kort)

CSP uten `unsafe-inline` for script, `X-Frame-Options: DENY`, Origin-sjekk på muterende tRPC-kall, rate limiting per IP,
staff-innlogging med obligatorisk TOTP + gjenopprettingskoder + fersk sesjon for kritiske handlinger, RBAC per tillatelse,
kundekonto med e-postverifisering, PII-feltkryptering (AES-256-GCM) for passnummer, revisjonslogg for alle admin-handlinger.

## Utvikling

```bash
npm install
cp .env.example .env            # tomt DUFFEL_API_KEY + ingen STRIPE_* = demomodus
npm run dev                     # http://localhost:3000 (Vite + Hono dev-server)
npm run check                   # tsc -b
npm run lint                    # eslint
npm test                        # enhetstester (vitest)
npm run test:it                 # integrasjonstester mot ekte MySQL/MariaDB (se under)
npm run test:e2e                # Playwright mot bygget app i demomodus (krever npm run build)
npm run build                   # dist/public (Vite) + dist/boot.js + dist/worker.js (esbuild)
npm start                       # web fra dist
npm run worker                  # worker fra dist
```

### Database lokalt

```bash
# MySQL 8 eller MariaDB ≥ 10.6. Eksempel:
mysql -uroot -e "CREATE DATABASE hellosky; CREATE USER 'hs'@'localhost' IDENTIFIED BY 'hs'; GRANT ALL ON *.* TO 'hs'@'localhost';"
DATABASE_URL=mysql://hs:hs@localhost:3306/hellosky npm run db:migrate:prod   # kjør migrasjoner
npm run db:generate                                                          # ny migrasjon etter endring i db/schema.ts
npm run migrate:check                                                        # feiler hvis schema.ts ikke er dekket av migrasjoner
```

### Integrasjonstester (`api/test/*.it.ts`)

Kjører hele flyten mot en egen database `hellosky_it` (opprettes og migreres automatisk av `api/test/globalSetup.ts`):
checkout → orkestrator → booking, Stripe-mock (`api/test/stripeMock.ts`), Duffel-fake (`api/lib/duffelFake.ts`) med
moduser `ok | timeout | timeout_lost | price_up | expired | no_pnr | reject | unavailable`, refusjoner, avstemming,
webhooks, jobber, autentisering og HTTP-sikkerhet.

```bash
# Standard: root uten passord på TCP (CI). Lokalt kan du overstyre i .env.it (ikke committet):
IT_ROOT_DATABASE_URL=mysql://root:root@127.0.0.1:3306
IT_DATABASE_URL=mysql://root:root@127.0.0.1:3306/hellosky_it
npm run test:it
```

Hjelpere i `api/test/setup.ts`: `caller()` (tRPC-caller med fabrikert kontekst), `truncateAll()`, `runJobsUntilIdle()`
(kjører `claimNextJob` + `dispatch` til køen er tom), `fakeStaff()/seedStaff()`, `fakeCustomer()`, `assertLedgerBalanced()`.

### E2E (Playwright)

`e2e/booking.spec.ts` går forside → søk → velg tilbud → skjema → demobetaling → bekreftelse med PNR (desktop + 360 px
mobil) og kjører axe-core (0 kritiske) på `/`, `/sok` og `/bestill`. `playwright.config.ts` starter `dist/boot.js` og
`dist/worker.js` selv mot `E2E_DATABASE_URL` (default = `IT_DATABASE_URL`). Første gang: `npx playwright install chromium`.

## Kodekart

| Sti | Innhold |
|---|---|
| `api/boot.ts` | Hono-app: sikkerhetshoder, Origin-sjekk, health, webhooks, tRPC |
| `api/router.ts`, `api/*.ts` | tRPC-routere: flights, checkout, orders, customerAuth, staffAuth, admin, team, partners, quotesPublic, community, extras |
| `api/middleware.ts` | tRPC-oppsett, feilformat (`appCode`), `customerProcedure`, `verifiedCustomerProcedure`, `permittedProcedure`, `freshSessionProcedure` |
| `api/lib/orchestrator.ts` | Booking-tilstandsmaskin (revalidering, ordre, gjenoppretting, fangst, finalisering) |
| `api/lib/refunds.ts` | Refusjonssaker og `process_refund` |
| `api/lib/reconcile.ts` | Avstemming mot Duffel (PNR, billetter, kansellering, ruteendringer) + `sweep` |
| `api/lib/jobs.ts`, `api/lib/workerHandlers.ts`, `api/worker.ts` | Outbox, jobbhåndterere, poll-løkke |
| `api/lib/duffel.ts`, `api/lib/duffelFake.ts`, `api/lib/demo.ts` | Duffel-klient (byttbar via `setDuffelClient`), fake for tester, demomotor |
| `api/lib/stripe.ts` | Stripe-klient (PaymentIntent manuell fangst, refusjon, webhook-signatur) |
| `api/lib/ledger.ts`, `api/lib/invoices.ts` | Hovedbok (dobbelt bokføring) og kvittering/kreditnota med nummerserie |
| `api/lib/env.ts` | Validert miljø + `assertProductionSafety()` |
| `db/schema.ts`, `db/migrations/` | Drizzle-skjema og SQL-migrasjoner |
| `contracts/` | Delte typer (Duffel v2-form) mellom front og back |
| `src/` | React-app (kunde + `/admin`) |
| `scripts/` | `migrate.mjs` (kjør migrasjoner fra bildet), `migrate-check.mjs` (CI-drift-sjekk) |
| `deploy/` | Railway-maler for web og worker |
