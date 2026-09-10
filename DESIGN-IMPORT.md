# DESIGN-IMPORT (midlertidig)

Denne grenen (`kimi/design-refresh`) inneholder den nye designoppdateringen:
ny hero på forsiden («Større verden. Nærmere deg.»), søkekort med fire
produkter (Fly / Hotell / Cruise / Leiebil), cruise-katalog, kompakte
billettkort på mobil, og 39 nye fotografier under `public/photos/`.

## Hvorfor et import-steg i Dockerfile?

De berørte filene (17 kodefiler + 39 bilder) pushes til Git fortløpende.
Inntil videre henter `Dockerfile` dem inn under bygg fra to midlertidige
pakker (se RUN-steget merket «Midlertidig import av designoppdateringen»).
Bygget gir derfor alltid den komplette nye versjonen.

## Deploy til Railway

Bygg fra denne grenen (eller `main` etter merge) med repoets `Dockerfile` –
ingen andre endringer trengs. Husk miljøvariablene fra `DEPLOYMENT.md`
(Duffel, Stripe, database osv. settes i Railway, aldri i Git).

## Slik fjernes import-steget når filene er i Git

Når alle filene er committet som vanlige Git-filer:

1. Slett RUN-steget «Midlertidig import av designoppdateringen» i `Dockerfile`.
2. Slett denne filen.

Vakta i RUN-steget gjør at bygget uansett faller tilbake til repo-innholdet
hvis pakkene skulle være borte.
