# HelloSky for iOS

Selvstendig Expo-app (SDK 57, React Native 0.86, Expo Router) for flysøk på norsk bokmål med priser i norske kroner.
Appen snakker bare med HelloSkys server på `/api/mobile/trpc` – aldri direkte med flyleverandører.

## Hva appen gjør

Appen er **bare for flysøk og sammenligning**. Den har ingen bestilling, åpner aldri leverandørens lenke og viser
ingen gate-, sete-, boardingkort- eller bestillingsopplysninger.

- **Søk** (uten innlogging): fra/til med flyplassøk (`flights.airports`), én vei eller tur-retur, datoer (iOS-kalender
  i et ark), voksne/barn (2–11 år)/spedbarn med alder, reiseklasse og «bare direktefly».
- **Resultater** (`flights.search`): billettkort med store flyplasskoder, rute, reisetid og bytter. Sortering
  («Billigst» = serverens rekkefølge, «Raskest», «Færrest bytter») og filtre (antall bytter, avgangstid for
  utreisen) regnes bare på data tilbudene har; tilbud uten kronepris står alltid nederst. Appen viser **bare
  kronebeløp**:
  - `1 234 kr` – leverandørens egen kronepris,
  - `ca. 1 234 kr` + «Omregnet med Norges Banks kurs 22.09.2026» – omregnet på serveren, med merknad om at
    leverandøren kan ta betalt i en annen valuta og at endelig beløp kan avvike,
  - «Ingen pris i kroner» + grunnen – når kurs mangler, er for gammel eller valutaen ikke støttes.
  Leverandørens beløp, valuta og publiserte kurs ligger urørt i serverkontrakten, men vises aldri i appen.
- **Tilbud**: tidslinje med strekninger og bytter (varighet regnet med tidssone), bagasje og vilkår når leverandøren
  oppgir dem, hvem som selger billetten, og kronemerknaden. Servicegebyret vises som beløp bare når det er i kroner.
- **Konto** (`mobileAuth`): vanlig kundeinnlogging med e-post og passord, ny konto og utlogging. Ingen andre roller.

## Utseende

Midnattsblå toppfelt med et prikket verdenskart (`assets/world-dots.png`, laget av `scripts/make-worldmap.mjs` fra
Natural Earth-data i `world-atlas`), hvite kort, indigo knapper og Manrope. Farger og mål står i `src/lib/theme.ts`
(tekstparene er sjekket mot WCAG AA), felles komponenter i `src/components/ui.tsx`, ikoner (SVG i Lucide-stil) i
`src/components/Icon.tsx`. Trykkflater er minst 44 pt.

## Sikkerhet

- Kundens opake token lagres kun i iOS-nøkkelringen (`expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`), og sendes
  som `Authorization: Bearer` bare på `mobileAuth.me`/`logout`. Søk sendes aldri med token.
- Ingen AsyncStorage, ingen logging (`no-console` er en lintfeil i `src/`).
- Eneste konfigurasjon er den offentlige `EXPO_PUBLIC_API_BASE_URL` (https påkrevd; http bare mot localhost i utvikling).
  Ingen leverandørnøkler, ingen serverkode og ingen kode som åpner leverandørens side i bygget – `npm run check:bundle`
  bekrefter det på det eksporterte bygget.
- Delte typer fra `../../contracts` importeres kun med `import type`. Metro blokkerer rotens `node_modules`.

## Kommandoer

```bash
cp .env.example .env.local        # sett EXPO_PUBLIC_API_BASE_URL
npm install
npm start                         # Expo dev-server (iOS: trykk i, eller Expo Go / dev build)
npm run typecheck && npm run lint && npm test
EXPO_PUBLIC_API_BASE_URL=https://… npm run export:ios && EXPO_PUBLIC_API_BASE_URL=https://… npm run check:bundle
```

Kontrakten mot serveren testes også fra serversiden: `api/test/mobileClient.it.ts` kjører denne appens `src/lib/api.ts`
mot den ekte Hono-appen.

## Privat iPhone-test (EAS) – forberedt, ikke kjørt

`eas.json` har to interne profiler og **ingen** innsending til App Store (ingen `submit`-seksjon, ingen butikkprofil):

| Profil | Hva | Krever Apple Developer Program? |
|---|---|---|
| `simulator` | iOS-simulatorbygg (`ios.simulator: true`), ingen signering | Nei |
| `preview` | Internt ad hoc-bygg for registrerte iPhoner | Ja |

Ingen hemmeligheter eller adresser står i `eas.json`. Begge profilene henter variabler fra EAS-miljøet `preview`.
Uten `EXPO_PUBLIC_API_BASE_URL` der viser appen «Appen er ikke satt opp» (feiler lukket).

Bundle-ID-en `no.hellosky.app` i `app.json` er en **plassholder** til den er bekreftet og registrert hos Apple.

Gjenstår før et bygg (i rekkefølge, gjøres av eieren av kontoene):

1. **Backend som ikke er produksjon.** Railway-prosjektet har i dag bare miljøet `production`. Appens API
   (`/api/mobile/trpc`) finnes bare på denne grenen. Et staging-miljø (se `DEPLOYMENT.md` §10) må settes opp og
   grenen deployes dit, med egen https-adresse.
2. **Expo-konto** + `npx eas-cli@latest login` og `npx eas-cli@latest init` i `apps/mobile` (skriver prosjekt-ID i
   `app.json`).
3. `npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_API_BASE_URL --value https://<staging> --visibility plaintext`
4. Simulator (uten Apple-medlemskap): `npx eas-cli@latest build -p ios --profile simulator`, og kjør bygget i
   Xcode-simulatoren på en Mac.
5. iPhone: aktivt Apple Developer Program, endelig bundle-ID, `npx eas-cli@latest device:create` for hver testtelefon,
   så `npx eas-cli@latest build -p ios --profile preview` (EAS lager ad hoc-profil og sertifikat med Apple-innlogging).

Uten Apple-medlemskap kan appen også prøves på egen iPhone via Expo Go (`npx expo start --tunnel`; alle native moduler
appen bruker, følger med Expo Go SDK 57), eller via Xcode med gratis Apple-ID (`npx expo run:ios --device` på Mac,
7 dagers signering). Ingen av dem er testet herfra.

## Før lansering

- Bekreft `ios.bundleIdentifier` (`no.hellosky.app` er en plassholder) og produksjonsadressen.
- Ekte test på iPhone/simulator (EAS Build eller Xcode), og live-sjekk av Norges Bank-kursene i produksjon.
- Apples krav: kontosletting i appen og, hvis sosial innlogging legges til, «Logg inn med Apple».
  Kontosletting er **ikke** lagt inn ennå: den eksisterende `customerAuth.deleteAccount` sletter ikke alle kundens data
  (bl.a. opplastede reisedokumenter, reiseplaner, lagrede elementer, søkehistorikk, varsler, prisovervåking og
  sosialt innhold). Den må utvides på serveren før appen kan tilby «Slett konto».
