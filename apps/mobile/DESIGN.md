# HelloSky iOS – designsystem

Overlevering av appens uttrykk i repoet. Det finnes **ingen Figma-fil** for appen; denne filen og koden er
kilden. Alle verdier under er hentet fra koden (`src/lib/theme.ts`), ikke skrevet av fra en skisse.

## Prinsipper

- **Svart og hvitt bærer identiteten, blått er handling.** Kull/svart grunn, hvite søke- og kortflater.
  HelloSky-blått (`#0754F8`) brukes bare på det man kan trykke på: primærknapper, valgt fane/brikke,
  lenker og ikoner i handlinger.
- **Systemskrift.** SF Pro via iOS' systemskrift; ingen fontfiler lastes eller følger med. Tekststørrelsen følger
  telefonens innstilling. Klokkeslett og priser har tabellsifre (`fontVariant: tabular-nums`).
- **Ekte data eller tydelig demo.** Testdata merkes «DEMO» i toppen og med en egen linje; ingenting vises som
  fakta når leverandøren ikke oppga det («Ikke oppgitt» er ikke det samme som «Ikke inkludert»).
- **Bare fly.** Ingen hotell, leiebil, boardingkort, sete, gate eller bestilling i appen. Tilbudet åpnes hos
  tilbyderen («Bestillingen fullføres hos tilbyderen.»).

## Farger

| Token | Verdi | Bruk |
|---|---|---|
| `bg` | `#0C0D0F` | Grunnflate (mørk) |
| `raised` | `#191B1F` | Hevede mørke flater: knapper, faner, meldinger |
| `darkBorder` | `#2B2D32` | Kanter på mørke flater |
| `onDark` | `#F8F9FA` | Tekst på mørkt |
| `onDarkMuted` | `#B2B5BC` | Sekundærtekst på mørkt |
| `onDarkDim` | `#8E9199` | Tertiærtekst på mørkt (kreditering) |
| `white` | `#FFFFFF` | Søkeark, kort, ark |
| `inset` | `#F5F5F7` | Innfelte flater på hvitt (felt, segmenter) |
| `lightBorder` | `#E6E7EB` | Kanter på lyse flater |
| `text` | `#111214` | Tekst på lyst |
| `textSecondary` | `#62656D` | Sekundærtekst på lyst |
| `blue` | `#0754F8` | Handling (på lyst og som knappeflate) |
| `bluePressed` | `#0544CC` | Trykket primærknapp |
| `blueOnDark` | `#4C8DFF` | Blå tekst/ikon på mørkt (valgt fane i menyen, +1-døgn) |
| `blueSoft` | `#EAF0FF` | Valgt rad på lyst |
| `success` / `successSoft` | `#0A7A3F` / `#E8F5EE` | «Inkludert» |
| `warning` / `warningSoft` / `warningOnDark` | `#8A5000` / `#FFF6E5` / `#FFD27A` | Demo, bytte, utløpt pris |
| `danger` / `dangerSoft` | `#B42318` / `#FDECEA` | Feil, flyplassbytte |
| `scrim` / `scrimStrong` | `rgba(12,13,15,.55)` / `.78` | Nøytralt svart overlegg på foto |

Tilstandsfarger står alltid sammen med tekst eller ikon, aldri alene.

### Kontrast (WCAG 2.x, målt)

| Par | Forhold |
|---|---|
| `text` på `white` / `inset` | 18,7 / 17,2 |
| `textSecondary` på `white` / `inset` | 5,8 / 5,4 |
| `blue` på `white`, `white` på `blue` | 5,8 |
| `blue` på `blueSoft` / `inset` | 5,1 / 5,3 |
| `onDark` på `bg` / `raised` | 18,4 / 16,4 |
| `onDarkMuted` på `bg` / `raised` | 9,5 / 8,4 |
| `onDarkDim` på `bg` / `raised` | 6,2 / 5,5 |
| `blueOnDark` på `bg` / `raised` | 6,1 / 5,4 |
| `warningOnDark` på `bg` / `raised` | 13,7 / 12,1 |
| `success` / `warning` / `danger` på `white` | 5,4 / 6,5 / 6,6 |

`blue` på `bg` er bare 3,4:1 og brukes derfor aldri som tekst på mørkt – der brukes `blueOnDark`.

## Typografi

| Token | Str./linje | Vekt | Bruk |
|---|---|---|---|
| `hero` | 28/34 | 600 | Overskrift i fotohodet |
| `title` | 22/28 | 600 | Skjermtitler |
| `section` | 18/24 | 600 | Seksjoner, korttitler |
| `headline` | 17/22 | 600 | Toppfelt |
| `body` / `bodyStrong` | 16/22 | 400 / 600 | Brødtekst, knapper |
| `callout` / `calloutStrong` | 15/20 | 400 / 600 | Rader i kort |
| `footnote` / `footnoteStrong` | 13/18 | 400 / 600 | Hjelpetekst, meldinger |
| `caption` | 12/16 | 400 | Etiketter, prisgrunnlag |
| `code` / `codeSmall` | 26/30 · 22/26 | 700 | Flyplasskoder |
| `time` / `timeLarge` | 17/22 · 22/28 | 600, tabell | Klokkeslett |
| `price` | 24/30 | 700, tabell | Priser |

## Mål

- **Avstand** (4-punktsrytme): `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32`. Sidemarg 16.
- **Hjørner**: `sm 10 · input 14 · card 20 · sheet 28 · pill 999`.
- **Trykkflater**: minst 44 × 44 pt (`TOUCH`).
- **Skygger**: bare diskrete (`0 1 2 rgba(0,0,0,.06)` på kort); ingen glød.

## Komponenter

| Komponent | Fil | Hva |
|---|---|---|
| `PrimaryButton`, `SecondaryButton`, `LinkButton`, `IconButton` | `src/components/ui.tsx` | Knapper (blå primær, mørk/lys sekundær, 44 pt ikonknapper) |
| `Chip`, `ChoiceChips`, `Segmented`, `DarkTabs` | `ui.tsx` | Filterbrikker, valg, «Tur-retur/Én vei», fanene i detaljene |
| `InformationCard`, `InfoRow` | `ui.tsx` | Hvite kort med rader (ikon, tittel, verdi) |
| `Notices`, `Banner`, `DemoBadge` | `ui.tsx` | Korte meldinger på mørkt (kan åpnes), meldinger på lyst, «DEMO»-merke |
| `Field`, `Stepper`, `BottomSheet`, `StateView` | `ui.tsx` | Tekstfelt, antall reisende, ark nedenfra, tomme/feil-tilstander |
| `SearchPanel`, `FormTile`, `DateField` | `SearchPanel.tsx`, `DateField.tsx` | Søkearket: turtype, fra/til med bytt, datoer, reisende, klasse |
| `OfferCard`, `FlightLegRow`, `RouteLine`, `BaggageSummary` | `OfferCard.tsx` | Resultatkortet: ut- og hjemreise, bagasje, pris og prisgrunnlag |
| `PriceTag` | `PriceTag.tsx` | Kronepris, «ca.»-pris med kurs, eller «Ingen pris i kroner» |
| `PhotoBackdrop`, `BottomFade` | `Photo.tsx` | Foto med nøytralt overlegg og kreditering |
| `DestinationCard`, `BottomNavigation`, `AirlineLogo`, `Icon` | `src/components/` | Reisemålskort, fanemeny, selskapslogo (eller kode), SVG-ikoner i Lucide-stil |

## Skjermene

1. **Hjem** (`src/app/(tabs)/index.tsx`): foto øverst (vinge over skylaget), hilsen med kundens fornavn når
   innlogget – ellers bare «God kveld» osv. – og hvitt søkeark: `Tur-retur | Én vei`, Fra/Til med bytt,
   Avreise/Retur, Reisende/Reiseklasse, «Søk fly». Under: reisemål som søker direkte.
2. **Resultater** (`src/app/resultater.tsx`): mørk grunn, rute og søk i toppen (+ «DEMO»), brikker (Alle, Direkte,
   Maks 1 mellomlanding, Bagasje inkludert), korte meldinger, antall reiser/tilbud og sortering. Ett hvitt kort per
   reise; samme reise hos flere tilbydere vises én gang med billigste pris og «N tilbydere». Flytende verktøylinje:
   Filtrer / Sorter / Datoer.
3. **Flydetaljer** (`src/app/tilbud/[id].tsx`): fotokort med selskap, utreisen i store tall og hjemreisen under;
   faner Oversikt / Bagasje / Vilkår (bare når tilbyderen oppga vilkår) / Reiseplan; fast bunnlinje med pris,
   prisgrunnlag og «Se tilbud hos [tilbyder]» → leverandørens egen lenke i Safari-visning, målt med nettets
   `flights.trackProviderClick`.

I tillegg: flyplassøk (`flyplass.tsx`, hvitt modalark), Utforsk (`(tabs)/utforsk.tsx`) og Profil
(`(tabs)/profil.tsx`, innlogging og fotokreditering).

## Foto

- Bildene er HelloSkys egne, godkjente reisefoto fra nettets register (`public/destinations`, `public/photos`),
  kopiert inn av `scripts/make-photos.mjs` (1080 px brede). De følger med appen: ingen bildesøk ved visning,
  ingen Unsplash-nøkkel i appen.
- Opphavet følger nettets register `src/content/photos.ts`: alle 25 er registrert som Unsplash. Fotografens navn
  er ikke registrert der, så appen viser «Foto: Unsplash» på bildet og en liste i Profil – ingen navn er diktet opp.
- Nye bilder legges først inn i nettets register med kilde (og helst fotograf), deretter i
  `src/lib/destinations.ts`.

## Forhåndsvisninger

Skjermbildene i overleveringen er laget med react-native-web i Chromium (375, 393 og 430 pt brede) med Inter som
stand-in for SF Pro og uten safe area. De er ikke fra en iOS-simulator; en ekte iPhone/simulator viser SF Pro,
iOS-kalenderen og safe area.
