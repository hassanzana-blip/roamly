# Roamly — arkitekturrevisjon (steg 1–2 i masterplanen)

Dato: 2026-09-06. Basert på faktisk kode, ikke antakelser.

## Faktisk arkitektur (inventar)

| Lag | Faktisk innhold |
|---|---|
| Prosess | Én Node-prosess: Hono 4.8 serverer tRPC 11 på `/api/trpc/*` (fetch-adapter) + statisk Vite-bygg i prod (`api/boot.ts`, `api/lib/vite.ts`). PORT fra miljø, `@hono/node-server`. |
| Frontend | React 19, react-router 7, Tailwind 3.4, shadcn/Radix, TanStack Query, superjson. SPA-fallback krever `Accept: text/html`. |
| Database | MySQL (TiDB-kompatibel, port 4000) via Drizzle 0.45 + mysql2 3.14. **`mode: "planetscale"` i `getDb()`**. Tabeller i dag: `bookings`, `support_messages`. **`db/migrations/` er tom** — ingen migrasjoner i versjonskontroll. |
| Duffel | `api/lib/duffel.ts`: v2-klient, `balance`/`card` payment type, søk/hent tilbud/opprett ordre. Demomotor `api/lib/demo.ts` speiler samme datamodell. |
| E-post | nodemailer (SMTP_*), logger når SMTP mangler. Bekreftelse sendes inline i booking-kallet. |
| Rate limiting | In-memory sliding window (`api/lib/ratelimit.ts`), én instans. |
| Tester | 27 stk (ratelimit, format, demo) — alle grønne. |
| Auth | **Ingen.** Alle endepunkter er `publicQuery`. |

## Risikoer funnet (prioritert)

1. **PCI-omfang (kritisk):** `createOrderSchema` godtar rå kortdata (`number`, `cvc`, `expiry`). Selv om kortet aldri sendes videre eller lagres, bringer transitt av PAN serveren inn i PCI-DSS-omfang. **Tiltak: fjernes helt.**
2. **Ingen autentisering/autorisasjon (kritisk):** `getOrder` returnerer full passasjerdata inkl. passnummer fra en ordre-ID alene; `findBooking` og `myCases` er kun beskyttet av at man kjenner referanse/e-post. **Tiltak: staff-sesjoner + RBAC på alle admin-endepunkter; kunde-endepunkter får strengere krav.**
3. **Booking-lagring er fire-and-forget (kritisk):** DB-feil logges bare — en betalt Duffel-ordre kan gå tapt lokalt. Ingen outbox, ingen reconciliation. **Tiltak: transaksjon + outbox + reconcile-jobb.**
4. **Ingen tilstandsmaskin:** booking er en JSON-blob uten livssyklus. **Tiltak: kanonisk state machine med validerte overganger + booking_events.**
5. **Ingen webhook-mottak:** airline-initierte endringer når aldri frem. **Tiltak: `/api/webhooks/duffel` med X-Duffel-Signature-verifisering + dedupe.**
6. **`mode: "planetscale"`** deaktiverer transaksjoner i Drizzle. **Tiltak: eksplisitt transaksjonsstøtte der DB tillater det; ellers kompenserende design (verifisert mot faktisk database).**
7. **Penger som flyttall:** `Number(offer.totalAmount)` ved tilleggsberegning. **Tiltak: desimal-strenger gjennom hele kjeden, DECIMAL(10,2) i DB.**
8. **Ingen health check / graceful shutdown** for Railway. **Tiltak: `/healthz`, SIGTERM-håndtering.**
9. **Migrasjoner mangler i Git.** **Tiltak: drizzle-kit generate → sjekk inn SQL.**
10. **In-memory rate limiter** skalerer ikke til flere replikaer (akseptabelt for 1 web + 1 worker, dokumentert).
11. **Domene hardkodet** i mailer (`roamly.no`). **Tiltak: `APP_BASE_URL`.**
12. **E-post inline i booking-responsen** uten retry. **Tiltak: e-post som outbox-jobb.**

## Målarkitektur (minste kompatible — ingen omskriving)

Samme repo, to prosesser:

- **Web (`npm start`):** eksisterende Hono/tRPC-app + `/healthz` + `/api/webhooks/duffel` + graceful shutdown. Uendret offentlig flyte.
- **Worker (`npm run worker`):** ny `api/worker.ts` — poller `jobs`-tabellen (outbox), prosesserer e-post, webhook-events, reconciliation, quote-utløp, med claim-lås, backoff+jitter og dead-letter.

Autentisering: Argon2id-passord (fallback scrypt hvis native-modul feiler i bygg), TOTP-MFA med recovery-koder, server-sesjoner i HttpOnly/Secure/SameSite-cookie, rotasjon ved innlogging, kortere levetid for admin. RBAC: roller OWNER/ADMIN/SUPPORT/FINANCE/READ_ONLY → eksplisitte tillatelser, håndhevet i tRPC-middleware på serveren. Bootstrap: `npm run bootstrap:admins` med e-post fra miljøvariabler, engangs invitasjonslenker, aldri i Git.

Datamodell: utvider eksisterende skjema (ikke dupliserer) med staff_users, staff_sessions, customers, booking_segments, booking_events, quotes, payments, refunds, support_cases, internal_notes, webhook_events, jobs, audit_logs. Money: DECIMAL(10,2) + strenger i TS.

Betaling: kunde-betaling krever leverandør (Stripe/Vipps) — **ikke levert ennå, blokkerer produksjonslansering**. Strukturen (quote → sikker checkout-lenke → kunden betaler selv → ordre først etter betaling) bygges nå med leverandørgrensesnitt; rå kortdata fjernes fra API-et umiddelbart.
