# Deploy-maler (Railway)

Railway leser én `railway.json` per tjeneste fra repo-roten, og to tjenester fra samme repo kan ikke ha ulike
`railway.json` i samme fil. Bruk derfor malene her ved å peke hver tjeneste på sin fil:

| Tjeneste | Mal | Settings → Config-as-code → Path |
|---|---|---|
| `web` | `deploy/railway-web.json` | `deploy/railway-web.json` |
| `worker` | `deploy/railway-worker.json` | `deploy/railway-worker.json` |

Begge bygger samme `Dockerfile`. `web` kjører `node scripts/migrate.mjs` som *pre-deploy* (migrasjoner før ny versjon
tar trafikk) og har health check på `/healthz`. `worker` starter `node dist/worker.js` og restartes alltid.

Alternativt uten config-as-code: dupliser repo-tjenesten i Railway og sett **Custom Start Command** til
`node dist/worker.js` på kopien.

Miljøvariabler: se `DEPLOYMENT.md` §3 — sett dem som *Shared Variables* slik at web og worker alltid har samme verdier.

## Andre verter

Bildet er standard Node 22, ikke-root; startkommando overstyres per tjeneste:

```bash
docker build -t hellosky .
docker run --rm --env-file .env hellosky scripts/migrate.mjs     # migrasjoner
docker run -d  --env-file .env -p 3000:3000 hellosky              # web (CMD dist/boot.js)
docker run -d  --env-file .env hellosky dist/worker.js            # worker
```
