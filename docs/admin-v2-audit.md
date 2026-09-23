# Eierpanel 2.0 — revisjon før redesign

Fase A. Hva som faktisk står der i dag, før en linje endres.

Referansebildet er den visuelle fasiten. Denne rapporten sier hva som allerede
finnes, hva som mangler, og hvor referansen og systemet er uenige — slik at
uenighetene blir avgjort med åpne øyne og ikke oppdaget i produksjon.

---

## 1. Ruter

29 ruter under `/admin`, alle definert i `src/App.tsx:189–217`, alle lastet fra
én chunk (`src/pages/admin/index.ts`) slik at kundesider aldri drar med seg
admin-kode.

To ruter ligger utenfor skallet: `/admin/logg-inn` og `/admin/aktiver`.
De 27 andre er barn av `AdminLayout`.

| Gruppe | Ruter |
| --- | --- |
| Drift | `/admin`, `gjennomgang`, `bestillinger`, `bestillinger/:id`, `ny-bestilling`, `tilbud`, `ruteendringer`, `sesjoner`, `hotell-bil`, `kvittering/:id` |
| Kunder | `kundeservice`, `kunder`, `samfunn`, `svindel` |
| Økonomi | `betalinger`, `refusjoner`, `rapporter`, `utgifter`, `lonn` |
| Team | `meldinger`, `notater`, `problemer` |
| System | `sikkerhet`, `aktivitetslogg`, `innstillinger` |

Kartet ligger ett sted — `src/pages/admin/nav.ts` — og både sidemenyen og
kommandopaletten leser derfra. Det er riktig bygget og skal ikke splittes.

**Konflikt med referansen.** Referansen har ni flate punkter: Oversikt, Tilbud,
Bestillinger, Kunder, Reiseanalyser, Flydata, Uttak og inntekter, Varsler,
Innstillinger. Systemet har 27 i fem grupper. Å kopiere referansens meny
bokstavelig ville skjult 18 sider som fungerer og er i bruk.

**Avgjørelse:** behold alle 27 og gruppene. Kopier referansens *visuelle*
språk — bredde, logoblokk, aktivmarkering, eier nederst — ikke antallet
oppføringer. Dette er den eneste bevisste avvikelsen fra referansen, og den er
tatt fordi alternativet er å fjerne fungerende funksjonalitet.

Fire av referansens navn peker på sider som ikke finnes ennå:
Reiseanalyser, Flydata, Uttak og inntekter, Varsler. De bygges som nye ruter,
ikke som omdøpte gamle.

---

## 2. Datakilder

| Flate | Prosedyre | Status |
| --- | --- | --- |
| Driftskø | `admin.dashboard` | finnes |
| Bestillingsliste | `admin.bookingsList` | finnes, paginert |
| Bestillingsdetalj | `admin.bookingDetail` | finnes |
| Tilbud | `admin.quotesList` | finnes |
| Kunder | `admin.customersList` | finnes |
| Salgsrapport | `admin.salesReport` | finnes, per dag, maks 90 dager |
| Eiertall | `adminOwner.summary` | finnes (bygget forrige runde) |
| Global søk | `admin.spotlight` | finnes |
| **Daglig serie søk + bestillinger** | — | **mangler** |
| **Leverandørhelse over tid** | — | **mangler** |
| **Varsler som egen flate** | — | **mangler** |

`admin.salesReport` gir bestillinger per dag, men ingen søk per dag.
Referansens hovedgraf («Søk og bestillinger», 7/30/90/år) trenger begge i én
serie. Det er ett nytt endepunkt, ikke en omskriving.

### Måling som allerede kjører

Tre tabeller skriver fra og med forrige deploy: `search_events`,
`provider_clicks`, `affiliate_conversions`. Ingen er fylt med historikk —
målingen startet 23. september 2025. Alle grafer vil derfor være korte eller
tomme en stund, og det skal stå, ikke skjules.

### Ruteminiatyrer

`ALL_DESTINATIONS` (`src/content/discover.ts`) har `iata` og `image` for 25
reisemål; bildene ligger i `public/destinations/` i tre størrelser.
`airportCity(iata)` i `api/lib/airportMeta.ts` gir bynavn — men bare på
serveren. Rutenavn bør derfor komme ferdig oppløst fra API-et i stedet for å
dra en flyplasstabell inn i klientbunten.

---

## 3. Autentisering og eiertilgang

- Sesjon på serveren (`api/lib/sessions.ts`), aldri rolle fra nettleseren.
- `api/lib/rbac.ts`: fem roller, 31 eksplisitte tillatelser,
  `permittedProcedure(permission)` håndhever hver enkelt.
- `company:read` ligger bare hos OWNER og vokter eierpanelets tall.
  `overview:read` har alle — driftskøen er felles arbeid.
- MFA (`MfaGate`), skjermlås etter 14 min (`LockGate`, `useIdleLock`),
  fersk sesjon kreves for refusjonsgodkjenning (`freshSessionProcedure`).
- Profilvalg (`ProfileGate`) etter innlogging; `staffAuth.setProfile` avviser
  alt annet enn OWNER og alt annet enn `zana`/`zyar`.
- Revisjonslogg merkes med profilnavnet via `staffActorLabel`.

Ingenting her skal røres. Redesignet er UI.

### Skille mot kundesiden

- `/^\/admin/` står i `NAV_HIDDEN` (`src/components/app/nav.ts:25`), så
  kundens bunnmeny og WhatsApp-knapp forsvinner i admin.
- `data-theme="admin"` settes på `<html>` og bytter hele tokensettet.
- `/admin` har `noindex,nofollow`, er `Disallow`-et i robots.txt og står ikke i
  sitemapet. Verifisert mot kjørende server.
- Ingen eierdata, profilvalg eller leverandørhelse finnes i kundebunten.

---

## 4. Designprimitiver som finnes

`src/pages/admin/ui.tsx` — 18 eksporter:

`Pill`, `BookingStatePill`, `RefundStatePill`, `AttemptStatePill`,
`PageHeader`, `Card`, `EmptyState`, `ErrorState`, `LoadingRows`, `TableCard`,
`ClickableRow`, `Pager`, `Btn`, `Field`, `KV`, `Timeline`, `CopyButton`,
`ReauthDialog`.

Dette er allerede et lite designsystem. 2.0 skal stramme det, ikke erstatte det
— hver erstatning er en risiko for 27 sider som bruker dem i dag.

`src/components/admin/`: `Avatar`, `CommandPalette`, `LockGate`, `MfaGate`,
`ProfileGate`, `ShortcutSheet`.

---

## 5. Biblioteker

Alt referansen trenger er allerede installert:

| Behov | Pakke | Versjon |
| --- | --- | --- |
| Primitiver | 26 × `@radix-ui/react-*` | 1.x–2.x |
| Ikoner | `lucide-react` | 0.562.0 |
| Grafer | `recharts` | 2.15.4 |
| Kommandopalett | `cmdk` | 1.1.1 |
| Servertilstand | `@tanstack/react-query` | 5.90.16 |
| Datoer | `date-fns` | 4.1.0 |
| Bevegelse | `motion` | 13.2.0 |
| Klassenavn | `clsx`, `tailwind-merge`, `class-variance-authority` | — |

**Ikke installert:** `@tanstack/react-table`, `visx`.

Tabellene i dag er rene `<table>`-elementer i `TableCard`, med paginering på
serveren. TanStack Table løser sortering, kolonnevalg og virtualisering i
klienten — problemer disse tabellene ikke har, fordi serveren allerede
paginerer. **Anbefaling: ikke installer den.** Stram opp `TableCard` i stedet.
Visx: samme svar, `recharts` holder.

`src/components/ui/chart.tsx` er en ferdig recharts-innpakning. Brukes i dag
bare av `Reports.tsx` (ett stolpediagram). Den skal være grunnlaget for
referansens linjediagram, slik at admin har én grafstil og ikke to.

---

## 6. Nåværende utseende mot referansen

| | I dag | Referansen | Gap |
| --- | --- | --- | --- |
| Overskriftsfont | Newsreader, **serif** | SF Pro, sans | **Stort** |
| Sidemenybredde | 256 px (`w-64`) | ≈ 220–240 px | Lite |
| Sidemenymateriale | gjennomsiktig + blur | solid hvit | Middels |
| Aktiv menyoppføring | **svart** fylt boks | myk blå flate, blå ikon | **Stort** |
| Eierprofil | øverst til høyre | **nederst i sidemenyen** | **Stort** |
| Toppfelt | 64 px, søk til venstre | søk sentrert, ⌘K, varsler | Middels |
| Hero | mørkt kort, bilde til høyre | bilde toner ut i bakgrunnen | Middels |
| KPI-kort | to svarte, ett blått, ett lyst | fire like lyse kort | **Stort** |
| Hovedgraf | finnes ikke på forsiden | stor linjegraf, periodevalg | **Mangler** |
| Topp ruter | tekstliste | rader med miniatyrbilde | Middels |
| Kortradius | `rounded-2xl` = 16 px | ≈ 14–18 px | Ingen |
| Tabelltetthet | romslig | tett, profesjonell | Middels |
| Tomme tilstander | stor ramme med ikon | liten, kompakt | **Stort** |

### De fire som avgjør inntrykket

1. **Serif-overskrifter.** `font-display` er Newsreader. Referansen er
   utvetydig sans. Dette alene får panelet til å lese som «redaksjonelt
   nettsted» i stedet for «macOS-verktøy». Fiks: la `[data-theme="admin"]`
   overstyre `.font-display` til systemstacken. Kundesiden beholder serifen.
2. **Svarte flater.** Sidemenyens aktivmarkering og to av KPI-kortene er
   `bg-night` (nesten svart). Referansen er lys hele veien, med blått som
   eneste aksent. De svarte flatene kom fra forrige referansebilde og er nå
   feil.
3. **Eierprofilen står øverst til høyre.** Referansen har den nederst i
   sidemenyen, som macOS-kontobytte. Flyttingen er liten i kode og stor i
   inntrykk.
4. **Ingen hovedgraf.** Forsiden mangler referansens tydeligste element.

---

## 7. Responsivt i dag

- Sidemeny: `hidden lg:block`, fast `w-64`; under 1024 px en skuff
  (`MobileDrawer`) med fokusfelle og Escape.
- Innhold: `lg:pl-64`, `px-3 sm:px-6 lg:px-8`, ingen maksbredde — strekker seg
  i det uendelige på brede skjermer.
- Tabeller: `TableCard` med `minWidth={720}` og vannrett rulling. På 390 px
  betyr det at brukeren drar en 720 px tabell sidelengs.

To ting å rette: en fornuftig maksbredde på innholdet, og kort i stedet for
vannrett rulling på telefon.

---

## 8. Hva som ikke skal røres

Auth · MFA · skjermlås · RBAC · revisjonslogg · profilbytte · tilbudsflyt ·
bestillingsflyt · refusjoner · leverandørlaget · `admin.*`-endepunktene ·
databasen · inntektsberegninger · ruting.

Redesignet legger seg oppå. Eksisterende endepunkter brukes som de er, bortsett
fra de to–tre nye som må til for graf og leverandørside.

---

## 9. Kjent begrensning i byggemiljøet

Nedlasting av bilder er sperret av utgående nettverkspolicy — Unsplash, Pexels
og Figma-opplasting svarer alle 403 gjennom proxyen. Nye fotografier kan derfor
ikke hentes herfra.

`public/destinations/` har 25 reisemål i tre størrelser, alle ekte og kreditert
i `src/content/photos.ts`. Ett av dem er norsk: `tromso.jpg`. Det er det
riktige heltebildet nå. Flere norske motiver (Lofoten, Senja, fjordene) må
lastes opp utenfra før de kan brukes.

---

## 10. Plan videre

- **B–G** Figma: fundament, komponenter, dashbord, tilbud, bestillingsdetalj.
- **H** Produksjonstokens: sans-overskrifter i admin, lyse flater, radius,
  skygger, tetthet.
- **I** Skallet: sidemeny 232 px, eier nederst, toppfelt, innholdsbredde.
- **J** Forsiden: hero, fire lyse KPI-kort, hovedgraf, topp ruter.
- **K** Tabeller og detaljsider.
- **L** Nye endepunkter for graf og leverandører.
- **M–O** Responsivt, tilgjengelighet, visuell kontroll mot referansen.

Ingen deploy uten godkjenning.
