# Migrasjon 0006 – reiseplaner, dokumenter, venner og grupper

Fil: `db/migrations/0006_min_side_planer_dokumenter_venner.sql` (14 nye
tabeller, ingen endringer i eksisterende tabeller). Kjøres automatisk av
`node scripts/migrate.mjs` i Railway pre-deploy.

## Tabeller

| Tabell | Formål |
|--------|--------|
| `trip_plans` | Kundens reiseideer og -planer. `status` idea/planned/booked/done; `booking_id` kobler til ekte bestilling; `packing_json` pakkeliste; `archived_at` myk sletting |
| `customer_documents` | Metadata om private dokumenter (type, tittel, filnavn, mime, størrelse, sha256, reisedato, kobling til plan/bestilling) |
| `customer_document_blobs` | Selve innholdet, kryptert med AES-256-GCM (`PII_ENCRYPTION_KEY`), én rad per dokument |
| `customer_friendships` | Venneforespørsler og vennskap; invitasjonslenker lagres som hash med utløp |
| `customer_blocks` | Blokkeringer (skjuler begge veier) |
| `travel_groups`, `travel_group_members` | Private grupper med eier/medlem og `left_at` |
| `social_posts`, `social_comments`, `social_likes` | Innlegg for venner eller én gruppe |
| `group_polls`, `group_poll_options`, `group_poll_votes` | Avstemninger i grupper, én stemme per person (unik nøkkel) |
| `content_reports` | Rapporter fra kunder, leses i admin |

## Krav ved utrulling

- `PII_ENCRYPTION_KEY` må være satt (den brukes allerede for annen PII).
  Uten den feiler opplasting med 500, ikke med datalekkasje.
- Opplasting er begrenset til 6 MB per fil, 100 dokumenter per kunde, og
  innholdet sjekkes mot magiske bytes (PDF/JPEG/PNG/WebP). HTML sendt som PDF
  avvises med 415.
- `GET /api/documents/:id` svarer 401 uten sesjon og 404 for andres
  dokumenter. Svarene er `cache-control: private, no-store`.
- Tilbakerulling: tabellene er nye og kan slettes uten å påvirke resten.

## Tester

- Enhet: `npx vitest run` (46 filer / 366 tester, inkl. `api/lib/documentFiles.test.ts`, `api/lib/socialRules.test.ts`, `src/lib/tripPlans.test.ts`, `src/lib/documents.test.ts`, `src/content/inspiration.test.ts`, `src/components/stays/stayLinks.test.ts`).
- Integrasjon mot ekte MariaDB: `api/test/minside.it.ts` (planer, dokumenter med kryssbrukersjekk, venner/grupper/avstemninger/blokkering/rapport).
- Ende-til-ende (lokal server + Playwright, ikke sjekket inn): to kontoer,
  venneinvitasjon og gruppeinvitasjon via UI, like/kommentar/stemme,
  opplasting via UI, avvist HTML-som-PDF, kryssbrukerforsøk (404/401),
  skjermbilder ved 360/390/430/768/1440.
