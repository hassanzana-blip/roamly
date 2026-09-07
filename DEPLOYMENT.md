# HelloSky – produksjonssetting

Fra repo til kjørende produksjon: **to tjenester fra samme Docker-bilde** (web + worker), **én MySQL-database**,
Stripe og Duffel i live-modus. Eksemplene bruker Railway, men bildet er generisk (Fly.io, Render, ECS, k8s).

---

## 1. Forutsetninger

- Docker-vert eller Railway-prosjekt med GitHub tilkoblet.
- MySQL 8 (eller MariaDB ≥ 10.6 / TiDB) med `utf8mb4`.
- Duffel-konto med **live**-nøkkel (`duffel_live_…`) og Duffel-saldo (billetter betales fra saldo).
- Stripe-konto med live-nøkler (`sk_live_…`, `pk_live_…`) og aktiverte betalingsmetoder (kort, Klarna).
- SMTP-utleier (Postmark, Resend, Brevo, SES …).
- Domene med TLS foran tjenesten (Railway/Cloudflare/ingress) — appen antar **én** betrodd proxy (`TRUSTED_PROXY_HOPS=1`).

## 2. Tjenester

| Tjeneste | Kommando i bildet | Formål | Skalering |
|---|---|---|---|
| `web` | `node dist/boot.js` (standard `CMD`) | Nettside, tRPC-API, webhooks, `/healthz`, `/readyz` | 1–N replikaer (rate limits er per prosess) |
| `worker` | `node dist/worker.js` | Outbox-jobber: booking-orkestrering, refusjoner, avstemming, e-post, sweep | 1–N (jobber claimes atomisk) |
| `migrate` | `node scripts/migrate.mjs` | Kjøres **før** ny versjon av web/worker starter | engangs |

Bildet (`Dockerfile`) er multi-stage, kjører som ikke-root bruker `hellosky`, har `HEALTHCHECK` på `/healthz` og
Startkommando settes per tjeneste (web: `node dist/boot.js`, worker: `node dist/worker.js`).

Railway: bruk malene i `deploy/railway-web.json` (med `preDeployCommand` for migrering) og
`deploy/railway-worker.json`. Se `deploy/README.md`.

## 3. Miljøvariabler

Sett på **begge** tjenestene (Railway: Shared Variables). Aldri i Git.

### Påkrevd i produksjon (`APP_ENV=production` — sjekkes ved oppstart, ellers nekter prosessen å starte)

| Variabel | Verdi / generering | Merknad |
|---|---|---|
| `NODE_ENV` | `production` | Settes av Dockerfile |
| `APP_ENV` | `production` | Aktiverer alle produksjonssperrer (demo/testnøkler forbudt) |
| `APP_BASE_URL` | `https://hellosky.no` | Må være `https://`; brukes i e-postlenker og Origin-sjekk |
| `DATABASE_URL` | `mysql://user:pass@host:3306/hellosky` | Kobling til MySQL. `DB_POOL_SIZE` (default 10) |
| `DUFFEL_API_KEY` | `duffel_live_…` | Testnøkkel er **forbudt** i production, live-nøkkel er forbudt i alle andre miljøer |
| `DUFFEL_WEBHOOK_SECRET` | fra `npm run duffel:webhook` | HMAC-hemmelighet for `/api/webhooks/duffel` |
| `STRIPE_SECRET_KEY` | `sk_live_…` | Serverside |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_…` | Sendes til Stripe Elements i nettleseren |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` fra Stripe-dashbordet | Signatur for `/api/webhooks/stripe` |
| `PII_ENCRYPTION_KEY` | `openssl rand -base64 32` | AES-256-GCM-nøkkel for passnummer m.m. Se rotasjon i RUNBOOK |
| `SMTP_URL` *eller* `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_SECURE` | fra SMTP-utleier | Uten SMTP nekter production å starte |
| `MAIL_FROM` | `HelloSky <bestilling@hellosky.no>` | Avsender (DKIM/SPF må være satt opp for domenet) |

### Anbefalt

| Variabel | Default | Merknad |
|---|---|---|
| `OPS_ALERT_EMAIL` | `MAIL_FROM` | Mottaker for driftsvarsler (ny booking, feilet jobb, avvik, chargeback) |
| `OPS_ALERT_WEBHOOK_URL` | – | Slack-kompatibel webhook (`{ text }`) — samme varsler som e-post |
| `MAX_DAILY_LIVE_AMOUNT_MINOR` | `0` (av) | Øvre grense per døgn for live-bookinger via Stripe, i øre. F.eks. `5000000` = 50 000 kr. Forsøk over grensen får `DAILY_CAP` og ops varsles. Bruk lavt tak den første uken |
| `PUBLIC_INSTANT_BOOKING` | `true` | `false` = nødstopp: `checkout.createSession` svarer `BOOKING_CLOSED` |
| `SERVICE_FEE_PERCENT` / `SERVICE_FEE_FLAT_MINOR` | `0.08` / `25000` | Servicegebyr (kan overstyres i admin → Innstillinger) |
| `SUPPORT_PHONE` / `SUPPORT_EMAIL` / `SUPPORT_HOURS` | `22 41 00 00` / `hei@hellosky.no` / `06–24` | Kontaktinfo i e-poster |
| `LOG_LEVEL` | `info` | `trace`…`error`. JSON-logg i produksjon med `requestId` |
| `SENTRY_DSN` | – | Valgfri feilrapportering (Sentry). Tom = av. Rapporterer interne tRPC-feil, jobbfeil i worker og unhandled rejections — aldri cookies/PII |
| `METRICS_TOKEN` | – | Bearer-token for `GET /metrics` (Prometheus). Tom = åpent — sett den alltid når porten er nåbar utenfra |
| `TRUSTED_PROXY_HOPS` | `1` | Antall betrodde proxyer foran appen (for klient-IP i rate limiting) |
| `PORT` | `3000` | Railway setter denne |
| `SMS_PROVIDER` / `TWILIO_*` | `none` | Valgfri SMS (Twilio) |

### Frontend (bakes inn ved `npm run build` — sett i byggmiljøet)

| Variabel | Bruk |
|---|---|
| `VITE_PUBLIC_URL` | Kanonisk URL i `<link rel="canonical">`/OG |
| `VITE_ORG_NUMBER` | Organisasjonsnummer i bunntekst/kvittering |
| `VITE_COMPANY_ADDRESS` | Forretningsadresse |
| `VITE_SUPPORT_PHONE` | Telefonnummer i UI |
| `VITE_SERVICE_FEE_VAT_PERCENT` | MVA-sats vist for servicegebyr (default 25) |

### Engangs (fjernes etterpå)

`BOOTSTRAP_OWNER_EMAIL`, `BOOTSTRAP_OWNER_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME` — se §6.

### Kun for utvikling/test

`SKIP_ENV_SAFETY=true` (skrur av produksjonssperrene — **aldri** i prod), `FORCE_SERVE=true` (server statiske filer
utenfor `NODE_ENV=production`), `WORKER_MAIN=true` (start worker-løkken selv om entrypoint ikke heter `worker.js`).

## 4. Migreringer

Migrasjoner ligger i `db/migrations/` (drizzle). De kjøres **før** ny kode starter, aldri av web/worker selv:

```bash
# Fra det bygde bildet (samme bilde som web/worker):
docker run --rm --env-file .env hellosky scripts/migrate.mjs
# Railway: preDeployCommand i deploy/railway-web.json, eller
railway run node scripts/migrate.mjs
# Fra kildekode:
DATABASE_URL=… npm run db:migrate:prod
```

Regler: migrasjoner er append-only og bakoverkompatible (gammel kode må tåle nytt skjema under utrulling). Ny migrasjon:
endre `db/schema.ts` → `npm run db:generate` → commit. CI feiler (`npm run migrate:check`) hvis skjemaet har endringer
uten migrasjon, og `npx drizzle-kit check` verifiserer journalen.

Verifiser etter migrering: `curl https://<domene>/readyz` → `{"ready":true}`.

## 5. Stripe

1. **Nøkler**: `STRIPE_SECRET_KEY` (`sk_live_`) og `STRIPE_PUBLISHABLE_KEY` (`pk_live_`). Staging bruker `sk_test_`/`pk_test_`
   med `APP_ENV=staging`.
2. **Betalingsmetoder**: aktiver kort og Klarna i Stripe → Settings → Payment methods. Appen oppretter PaymentIntents med
   `capture_method: manual` og fanger først når Duffel har bekreftet billetten.
3. **Webhook** (Developers → Webhooks → Add endpoint): URL `https://<domene>/api/webhooks/stripe`, hendelser:
   - `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`
   - `payment_intent.payment_failed`, `payment_intent.canceled`
   - `refund.created`, `refund.updated`, `refund.failed`, `charge.refund.updated`
   - `charge.dispute.created`

   Kopier signeringshemmeligheten til `STRIPE_WEBHOOK_SECRET`. Endepunktet svarer alltid raskt 2xx, dedupliserer på
   `event.id` (`webhook_events`) og behandler i worker.
4. **Lokalt**: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` gir en midlertidig `whsec_…`.
5. **Test i staging**: kort `4242 4242 4242 4242` (OK), `4000 0000 0000 3220` (3DS), `4000 0000 0000 9995` (avvist).

## 6. Duffel

1. `DUFFEL_API_KEY=duffel_live_…`. Sørg for Duffel-saldo — ordrer betales med `payment_type: balance`.
2. **Webhook**: `railway run npm run duffel:webhook` (eller `DATABASE_URL=… APP_BASE_URL=… npx tsx api/cli/duffel-webhook.ts`)
   registrerer `https://<domene>/api/webhooks/duffel` for `order.created`, `order.updated` og
   `order.airline_initiated_change_detected`, og skriver ut hemmeligheten **én gang** → `DUFFEL_WEBHOOK_SECRET`.
3. Avstemming går uansett periodisk (`sweep` hvert 10. min) — webhooken gjør bare reaksjonen raskere.

## 7. Første administratorer (engangs)

1. Sett `BOOTSTRAP_OWNER_EMAIL/NAME` og `BOOTSTRAP_ADMIN_EMAIL/NAME`.
2. `railway run npm run bootstrap:admins` → to engangslenker (48 t). Send dem sikkert.
3. Hver person velger passord, skanner TOTP-QR og lagrer 8 gjenopprettingskoder. **MFA er obligatorisk** for alle ansatte.
4. Fjern `BOOTSTRAP_*`-variablene.

Utenfor produksjon finnes i tillegg et selvdeaktiverende førstegangsoppsett på `/admin/logg-inn` (kun når null kontoer finnes).

## 8. Health checks, logging og skalering

- `GET /healthz` → `{ ok: true }` (ingen eksterne kall) — brukes av Docker `HEALTHCHECK` og lastbalanserer.
- `GET /readyz` → `{ ready: true }` når databasen svarer (503 ellers) — bruk som readiness.
- Logg: JSON (pino) med `requestId`, `attemptId`, `bookingId`. `x-request-id` returneres på alle svar; send den inn for
  korrelasjon på tvers av proxy.
- Ryddig avslutning: web slutter å ta imot og lukker DB-pool; worker fullfører pågående jobb (maks 60 s) på `SIGTERM`.
- Rate limiting er i minne per prosess. Ved flere web-replikaer: sett strengere grenser i proxy eller bytt til Redis.
- Feilrapportering: sett `SENTRY_DSN` (web og worker). Prosessene starter uten; `@sentry/node` lastes kun når DSN er satt.
  Sett gjerne `APP_RELEASE`/`GIT_SHA` for release-tagging.
- Metrics: `GET /metrics` (Prometheus-tekst, `Authorization: Bearer $METRICS_TOKEN`). Tellere per prosess (web og worker
  har hver sine — scrape begge): `bookings_confirmed_total`, `booking_attempts_failed_total{code}`,
  `duffel_requests_total{outcome}`, `stripe_webhooks_total{outcome}`, `jobs_dead_total{type}`, `refund_cases_total{state}`,
  `trpc_errors_total{code}`, `process_uptime_seconds`. Nullstilles ved omstart (bruk `increase()`/`rate()`).
  Forslag til alarmer: `increase(jobs_dead_total[10m]) > 0`, `increase(booking_attempts_failed_total[1h]) > 3`,
  `rate(duffel_requests_total{outcome!="ok"}[5m]) / rate(duffel_requests_total[5m]) > 0.2`.

## 9. Sjekkliste før go-live

- [ ] `APP_ENV=production`, `APP_BASE_URL=https://…`, alle påkrevde variabler satt på **begge** tjenester
- [ ] `PII_ENCRYPTION_KEY` generert med `openssl rand -base64 32` og lagret i hemmelighetsforvalter (backup!)
- [ ] Migrasjoner kjørt; `/readyz` svarer `ready: true`
- [ ] Stripe-webhook registrert med hendelseslisten i §5 og testet («Send test webhook» → rad i admin → Innstillinger → Webhooks)
- [ ] Duffel-webhook registrert (`npm run duffel:webhook`) og `ping.triggered` mottatt
- [ ] SMTP: testbestilling i staging gir bekreftelse + kvittering; SPF/DKIM/DMARC for avsenderdomenet
- [ ] `OPS_ALERT_EMAIL`/`OPS_ALERT_WEBHOOK_URL` mottar varsel (f.eks. fra en død jobb i staging)
- [ ] `MAX_DAILY_LIVE_AMOUNT_MINOR` satt lavt (f.eks. 20 000 kr) første dagene
- [ ] To administratorer aktivert med MFA; `BOOTSTRAP_*` fjernet
- [ ] Vilkår, personvern, org.nr (`VITE_ORG_NUMBER`) og adresse (`VITE_COMPANY_ADDRESS`) korrekt i bygget
- [ ] Første ekte booking gjort av teamet selv (lav pris) og kansellert/refundert via admin for å verifisere hele løpet
- [ ] Backup av databasen aktivert (daglig) og gjenoppretting testet (RUNBOOK §K)
- [ ] `PUBLIC_INSTANT_BOOKING` kjent som nødbryter for vaktansvarlig

## 10. Staging

Samme oppsett med `APP_ENV=staging`, `duffel_test_…`, `sk_test_…`/`pk_test_…`, egen database og eget domene.
Produksjonssperrene tillater ikke live-nøkler her. Demomodus (`DUFFEL_API_KEY` tom, ingen Stripe) er kun for lokal utvikling.
