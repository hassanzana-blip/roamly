# HelloSky for iOS

Selvstendig Expo-app (SDK 57, React Native 0.86, Expo Router) for flysøk på norsk bokmål med priser i norske kroner.
Appen snakker bare med HelloSkys server på `/api/mobile/trpc` – aldri direkte med flyleverandører.

## Hva appen gjør

- **Søk** (uten innlogging): fra/til med flyplassøk (`flights.airports`), én vei eller tur-retur, datoer, voksne/barn
  (2–11 år)/spedbarn med alder, reiseklasse og «bare direktefly».
- **Resultater** (`flights.search`): i serverens rekkefølge – billigste i kroner først. Priser vises som
  - `1 234 kr` – leverandørens egen kronepris,
  - `ca. 1 234 kr` + «Omregnet fra 131,00 EUR · Norges Bank 22.09.2026» – omregnet på serveren,
  - «Ingen pris i kroner» + leverandørens beløp med egen valutakode – når kurs mangler/er for gammel/valuta ikke støttes.
  Et utenlandsk beløp vises aldri som kroner.
- **Tilbud**: strekninger, bytter, bagasje, vilkår, kurs og gebyr. Tilbud leverandøren selger (KAYAK) åpnes hos
  leverandøren med den urørte https-lenken i `SFSafariViewController`. Tilbud HelloSky selger kan ikke bestilles i appen ennå.
- **Konto** (`mobileAuth`): vanlig kundeinnlogging med e-post og passord, ny konto og utlogging. Ingen andre roller.

## Sikkerhet

- Kundens opake token lagres kun i iOS-nøkkelringen (`expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`), og sendes
  som `Authorization: Bearer` bare på `mobileAuth.me`/`logout`. Søk sendes aldri med token.
- Ingen AsyncStorage, ingen logging (`no-console` er en lintfeil i `src/`).
- Eneste konfigurasjon er den offentlige `EXPO_PUBLIC_API_BASE_URL` (https påkrevd; http bare mot localhost i utvikling).
  Ingen leverandørnøkler, ingen serverkode i bygget – `npm run check:bundle` bekrefter det på det eksporterte bygget.
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

## Før lansering

- Bekreft `ios.bundleIdentifier` (`no.hellosky.app` er en plassholder) og produksjonsadressen.
- Ekte test på iPhone/simulator (EAS Build eller Xcode), og live-sjekk av Norges Bank-kursene i produksjon.
- Apples krav: kontosletting i appen (ikke med ennå) og, hvis sosial innlogging legges til, «Logg inn med Apple».
