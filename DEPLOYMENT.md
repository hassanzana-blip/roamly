# Roamly – produksjonssetting på Railway

Denne guiden tar deg fra GitHub-repo til kjørende produksjon på eget domene.
Målarkitektur: **to Railway-tjenester fra samme repo** (web + worker) og **én MySQL-database**.

---

## 1. Forutsetninger

- GitHub-repo `roamly` (privat) med denne koden.
- Railway-konto med GitHub tilkoblet.
- Duffel-konto (https://duffel.com) med API-nøkkel.
- SMTP-utleier for utgående e-post (f.eks. Resend, Postmark, Brevo, SES).
- Domenet ditt (f.eks. roamly.no) med tilgang til DNS.

## 2. Opprett prosjektet i Railway

1. **New Project → Deploy from GitHub repo** → velg `roamly`.
2. Railway bygger med `Dockerfile` automatisk.
3. Legg til database: **New → Database → MySQL**.

Du skal ende opp med **to tjenester** fra samme repo:

| Tjeneste | Startkommando | Formål |
|---|---|---|
| `web` | `npm start` | Nettside + API + webhooks (standard fra Dockerfile) |
| `worker` | `npm run worker` | Jobbkø: e-post, Duffel-avstemming, webhook-prosessering |

For `worker`: høyreklikk repo-tjenesten → **Duplicate**, og under
**Settings → Deploy → Custom Start Command** sett `npm run worker`.
Begge tjenestene deler samme build og samme variabler.

## 3. Miljøvariabler (Railway → Variables)

Sett disse på **begge** tjenestene (bruk gjerne Shared Variables):

| Variabel | Verdi |
|---|---|
| `DATABASE_URL` | `mysql://...` fra MySQL-pluginen (se .env.example) |
| `APP_ENV` | `production` |
| `APP_BASE_URL` | `https://dittdomene.no` |
| `DUFFEL_API_KEY` | `duffel_live_...` (test-nøkkel i staging) |
| `DUFFEL_PAYMENT_TYPE` | `balance` |
| `SMTP_URL` *eller* `SMTP_HOST/PORT/USER/PASS/SECURE` | fra SMTP-utleier |
| `MAIL_FROM` | `Roamly <bestilling@dittdomene.no>` |
| `OPS_ALERT_EMAIL` | e-post som skal få driftsvarsler |
| `PUBLIC_INSTANT_BOOKING` | `true` (sett `false` for nødstopp av booking) |

**Aldri** legg disse i Git. Railway Variables er eneste kilde.

## 4. Databasemigreringer

Migreringer ligger i `db/migrations/` og kjøres én gang per miljø:

```bash
# Lokalt, med Railway sin DATABASE_URL i .env (railway run eller lim inn):
npm run db:migrate
```

Alternativt via Railway CLI: `railway run npm run db:migrate`.

Verifiser: `curl https://<app>/readyz` skal svare `{"ready":true}`.

## 5. Første innlogging (engangs-bruk)

1. Legg til midlertidige variabler:
   - `BOOTSTRAP_OWNER_EMAIL` + `BOOTSTRAP_OWNER_NAME` (Zyar)
   - `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_NAME` (Zana)
2. Kjør `railway run npm run bootstrap:admins`.
3. Skriptet skriver ut **to engangslenker** (gyldige i 48 timer). Send dem
   sikkert (altså ikke i Git, ikke i åpne kanaler) til riktig person.
4. Hver person åpner lenken, velger passord og skanner QR-kode for
   totrinnsbekreftelse (TOTP), og får 8 gjenopprettingskoder.
5. **Fjern BOOTSTRAP_-variablene fra Railway etterpå.**

Det finnes ingen hardkodet tilgang. Uten disse variablene kan ingen
opprette administratorkontoer.

## 6. Duffel webhooks

```bash
railway run npm run duffel:webhook
```

Skriptet registrerer `https://dittdomene.no/api/webhooks/duffel` og skriver
ut `DUFFEL_WEBHOOK_SECRET` **én gang**. Lim den rett inn i Railway Variables
(web + worker) og redeploy.

## 7. Domene og DNS

1. Railway → web-tjenesten → **Settings → Networking → Custom Domain** →
   skriv `dittdomene.no` (og evt. `www.dittdomene.no`).
2. Hos DNS-utleieren:
   - `dittdomene.no` → ALIAS/ANAME (eller A-peker per instruks i Railway)
   - `www` → CNAME til Railway-domenet
3. Vent på grønt TLS-merke i Railway (automatisk sertifikat).
4. Sett `APP_BASE_URL=https://dittdomene.no` og redeploy.

## 8. Test før lansering (sjekkliste)

- [ ] `/healthz` og `/readyz` svarer 200
- [ ] Forsiden laster med videoheader
- [ ] Flysøk returnerer tilbud (Duffel **test**-nøkkel)
- [ ] Testbooking i Duffel test-modus dukker opp i **/admin/bestillinger**
- [ ] Driftsvarsel om «Ny booking» ankommer `OPS_ALERT_EMAIL`
- [ ] Bekreftelses-e-post ankommer kunden
- [ ] `/admin` krever innlogging + TOTP
- [ ] Feil passord 5+ ganger gir midlertidig sperre
- [ ] Bytt til `duffel_live_...` **først når alt over er grønt**
- [ ] **Aldri** kjør en ekte betalt booking som test

## 9. Daglig drift

Se **RUNBOOK.md** for hendelseshåndtering: feilede jobber, refusjoner,
avstemming mot Duffel, webhook-problemer og tilbakerulling.
