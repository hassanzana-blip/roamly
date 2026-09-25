# HelloSky for iOS

Selvstendig Expo-app (SDK 57, React Native 0.86, Expo Router) for flysøk på norsk bokmål med priser i norske kroner.
Appen snakker bare med HelloSkys server på `/api/mobile/trpc` – aldri direkte med flyleverandører.
En ny installasjon starter på bokmål. Et lagret engelsk eller norsk språkvalg beholdes ved omstart.
Byggidentitet, miljøer og lanseringskrav står i [`RELEASE.md`](RELEASE.md).

## Hva appen gjør

Appen er **bare for flysøk og sammenligning**. Den selger ingenting selv og viser ingen gate-, sete-, boardingkort-
eller bestillingsopplysninger. Vil kunden ha et tilbud, åpnes tilbyderens egen side, og bestillingen fullføres der.

- **Hjem** (uten innlogging): et mørkt panel med spørsmålet «Hvor vil du reise?» (innlogget: hilsen med fornavnet) og
  profilknapp, Fly/Hotell som to ruter, `Tur-retur  Én vei` som faner, fra og til under hverandre med bytt-knappen på
  skillelinjen (flyplassøk med `flights.airports`, bare den valgte flyplassen – aldri andre i samme by), avreise ▸ retur
  i ett felt (én kalender i et ark), reisende og reiseklasse som brikker (voksne/barn 2–11 år/spedbarn med alder,
  «Bare direktefly»). Reisemålskortene (uten pris) søker direkte.
- **Resultater** (`flights.search`): ett kort per reise med ut- og hjemreise, bagasje og **hva prisen gjelder**
  («Totalt for 2 voksne · Tur-retur» – aldri per person). Samme reise hos flere tilbydere vises én gang med billigste
  tilbyder og «N tilbydere» (samme gruppering som nettet). Brikker og filterark (mellomlandinger, innsjekket bagasje,
  avgangstid), sortering («Billigst» = serverens rekkefølge, «Raskest», «Færrest mellomlandinger») og «Datoer» som
  søker på nytt. Tilbud uten kronepris står alltid nederst. Appen viser **bare kronebeløp**:
  - `1 234 kr` – leverandørens egen kronepris,
  - `ca. 1 234 kr` + «Omregnet med Norges Banks kurs 22.09.2026» – omregnet på serveren; meldingen over listen sier
    at endelig beløp kan avvike og kan åpnes for hele forklaringen,
  - «Ingen pris i kroner» + grunnen – når kurs mangler, er for gammel eller valutaen ikke støttes.
  Leverandørens beløp, valuta og publiserte kurs ligger urørt i serverkontrakten, men vises aldri i appen.
- **Flydetaljer**: fotokort, faner Oversikt / Bagasje / Vilkår / Reiseplan. Bagasje per reisende med tre tilstander
  (inkludert, ikke inkludert, ikke oppgitt); vilkår bare når leverandøren oppga dem (aldri gebyrbeløp); tidslinje med
  bytter, flyplassbytte og +1 døgn. Flere tilbydere av samme reise kan velges; pris, bagasje og vilkår følger valget.
- **Videre til tilbyderen**: «Se tilbud hos [tilbyder]» åpner leverandørens egen https-lenke **urørt** i
  Safari-visning (`expo-web-browser`), med «Bestillingen fullføres hos tilbyderen.» under. Klikket måles med nettets
  eksisterende `flights.trackProviderClick` (samme prosedyre er montert på `/api/mobile/trpc`; ingen ny
  videresending). Lenker som ikke er ren https, åpnes ikke.
- **Utforsk** og **Profil** (`mobileAuth`): reisemål; Profil er en innstillingsliste med et innloggingskort (e-post og
  passord, ny konto og glemt passord i et eget ark), språk, valuta (NOK, bare informasjon), hjelp og juridisk, og
  for innloggede konto, utlogging og sletting. Ingen andre roller.

## Utseende

Kull/svart grunn, hvite søke- og kortflater og HelloSky-blått bare som handlingsfarge; iOS' systemskrift med
tabellsifre for tid og pris; ekte foto (se under). Tokens, kontrastmålinger, komponenter og skjermer står i
[`DESIGN.md`](DESIGN.md); verdiene bor i `src/lib/theme.ts`, felles komponenter i `src/components/ui.tsx`.
Målet er trykkflater på minst 44 pt. Kjente avvik og målte resultater står i `DESIGN.md`;
den nåværende valutaforklaringen er under målet og venter på retting.

**Foto:** HelloSkys egne, godkjente reisefoto fra nettets register, kopiert inn av `scripts/make-photos.mjs`
(`assets/photos/*.jpg`). De følger med appen – ingen bildesøk mens appen brukes, ingen Unsplash-nøkkel i appen.
Kilden står i nettets register (`src/content/photos.ts`) og i `src/lib/destinations.ts`; appen viser ingen
kildeetiketter eller kredittliste (se `DESIGN.md`, «Foto»).

## Sikkerhet

- Kundens opake token lagres i iOS-nøkkelringen (`expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`), og sendes
  som `Authorization: Bearer` på de beskyttede kunderutene: `me`, `updateProfile`, `deleteAccount` og `logout`.
  Søk og klikkmåling sendes aldri med token.
- Ingen AsyncStorage, ingen logging (`no-console` er en lintfeil i `src/`).
- Eneste konfigurasjon er den offentlige `EXPO_PUBLIC_API_BASE_URL` (https påkrevd; http bare mot localhost i utvikling).
  Ingen leverandørnøkler og ingen serverkode i bygget – `npm run check:bundle` bekrefter det på det eksporterte bygget,
  og at klikkmålingen er med.
- Delte typer fra `../../contracts` importeres kun med `import type`. Metro blokkerer rotens `node_modules`.

## Kommandoer

```bash
cp .env.example .env.local        # sett EXPO_PUBLIC_API_BASE_URL
npm ci
npm start                         # Expo dev-server; native simulator på Mac eller kompatibelt utviklingsbygg
npm run typecheck && npm run lint && npm test
EXPO_PUBLIC_API_BASE_URL=https://… npm run export:ios && EXPO_PUBLIC_API_BASE_URL=https://… npm run check:bundle
```

Kontrakten mot serveren testes også fra serversiden: `api/test/mobileClient.it.ts` kjører denne appens `src/lib/api.ts`
mot den ekte Hono-appen.

## Bygg og privat iPhone-test

Eksisterende prosjekt hos Expo er `helloskytravels-team/zana`; navnet kunden ser er HelloSky.
Bundle-ID `no.hellosky.app` er registrert hos Apple, og appoppføringen Hellosky Travel har ID `6815342171`.
Ikke kjør `eas init` på nytt eller opprett et nytt prosjekt for denne appen.

| Profil i `eas.json` | Distribusjon | EAS-miljø |
|---|---|---|
| `simulator` | iOS-simulator på Mac; usignert | `preview` |
| `preview` | Intern distribusjon til registrerte iPhoner; krever signering | `preview` |
| `testflight` | Butikkbygg; innsending er et separat godkjenningspunkt | `preview` |
| `production` | Butikkbygg; innsending er et separat godkjenningspunkt | `production` |

`submit`-profilene peker til eksisterende appoppføring. Ingen profil sender inn automatisk.
Leverandørnøkler eller signeringshemmeligheter hører aldri hjemme i Git eller `EXPO_PUBLIC_`-variabler.
Uten en gyldig offentlig `EXPO_PUBLIC_API_BASE_URL` viser appen «Appen er ikke satt opp».

**Verifisert 23.09.2026:** eksisterende Railway-staging på
`https://roamly-staging.up.railway.app` har web, egen database og begge API-flatene.
EAS-miljøet `preview` bruker denne adressen. Faktisk mobilklient fikk flyplasser og demoresultater;
dette er ikke bevis på ekte bookbare priser. Produksjon på `hellosky.no` manglet mobilrutene ved siste kontroll.
Staging kjører nå `18ad2ea`, og samme kunde er verifisert begge veier mellom web og appens faktiske API-klient.
Se [konkret test- og byggebevis](docs/RELEASE_EVIDENCE.md) for testomfang, kilder og gjenstående kontroller.

Et [native simulatorbygg](https://expo.dev/accounts/helloskytravels-team/projects/zana/builds/988e8421-4373-4e48-9fba-585928db397f)
fra `79c2730` er ferdig kompilert. Det er eldre enn gjeldende kode, er ikke kjørt på en simulator, og kan ikke
installeres på en fysisk iPhone. Nettleseropptakene i `docs/evidence` er supplerende bevis, ikke native tester.

For et nytt privat enhetsbygg:

1. Bestå kontrollene i `RELEASE.md` på én bestemt commit, og kontroller backend-adressen med
   `node scripts/mobile-readiness.mjs https://roamly-staging.up.railway.app` fra reporoten.
2. Kontroller eksisterende signeringsoppsett og at testtelefonen er registrert. Forrige `preview`-forsøk var
   blokkert fordi intern iOS-distribusjon manglet tilgjengelige signeringsopplysninger. Ny tilgang eller nye
   signeringsopplysninger må avklares før de opprettes.
3. Når dette er på plass, kjør `eas build --platform ios --profile preview` fra `apps/mobile`, uten auto-submit.
4. Åpne installasjonslenken fra det ferdige EAS-bygget på den registrerte iPhonen. Ingen ferdig
   iPhone-installasjonslenke er dokumentert ennå.
5. Kjør den native sjekklisten i `RELEASE.md`, inkludert datoark, tastatur, skjermkanter, VoiceOver og stor tekst.

## Før lansering

- Full grønn CI, testet backend og ekte søk/tilbyderovergang på enhet for samme kandidat.
- Kontoens slettingshandling finnes i appen og bruker den eksisterende kundetjenesten med ny
  autentisering når nødvendig. Omfanget av sletting og eventuell lovpålagt oppbevaring må gjennomgås før
  lansering; denne implementasjonen hevder ikke at alle historiske kundedata slettes.
- Bekreft personvern-, support- og butikkopplysninger mot faktisk funksjonalitet.
- Produksjonsdeploy og TestFlight/App Store-innsending krever eksplisitt godkjenning av kandidaten.
