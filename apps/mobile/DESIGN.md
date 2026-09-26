# HelloSky iOS – designsystem

Overlevering av appens uttrykk i repoet. Tokenverdiene (farger, typografi, mål) er hentet fra koden
(`src/lib/theme.ts`), ikke skrevet av fra en skisse. Seksjonen «Tre skjermer» har i tillegg målte verdier.

Den redigerbare Figma-filen er bygget fra koden: https://www.figma.com/design/YE2XDmrOTFY8dRFiarPxSz. Per 26.09
har den rammen **P7 · Cloud + Graphite** (Core Flow) med seks skjermer fra `09404b2`: Hjem, resultater med kompakt
topp, søket åpent i toppen, Min side innlogget (hele siden), Min side for en ny gjest og velkomsten. Nye komponenter:
`HubTile`, `SummaryChip`, `ContinueRow`, `SectionHead`, `ListRow` og `TabBar` (kapselen, fire varianter), 20 nye
ikoner, fargene `canvas`, `surfaceSoft` og `blueOnDarkTint`, og skyggene `HelloSky/island` og `HelloSky/capsule`.
P6 (fra `6935d1d`) viser den mørke utgaven; se `docs/FIGMA_SPECIFICATION.md`. Figma-filen bruker Inter fordi SF Pro
ga tekst uten bredde i koblingen; appen bruker iOS' systemskrift. Er de uenige, er koden og denne filen kilden.

**Språk og marked:** norsk bokmål ved første oppstart; engelsk er et valg på Min side som lagres og beholdes. Priser
alltid i NOK. Fly fra Norge til hele verden er kjernen, og søk krever ikke innlogging. Det finnes også
hotellskjermer i utviklingsgrenen; de er ikke bekreftet med ekte bookbare leverandørtilbud.

## Prinsipper

- **«Cloud + Graphite» (25.09.2026): omtrent 70 % lyst, 20 % grafitt, 10 % blått.** Lys grunn (`canvas`) med hvite
  kort og lister; grafitt bare i «øyene» – søket på Hjem, ruteoverskriften i resultatene, helten på Min side,
  prislinjen i detaljene og fanemenyen. HelloSky-blått (`#0754F8`) brukes bare på det man kan trykke på:
  primærknapper, valgt brikke, lenker og ikoner i handlinger (`blueOnDark` på grafitt). Til 25.09 var hele appen
  mørk (kull).
- **Systemskrift.** SF Pro via iOS' systemskrift; ingen fontfiler lastes eller følger med. Tekststørrelsen følger
  telefonens innstilling. Klokkeslett og priser har tabellsifre (`fontVariant: tabular-nums`).
- **Ekte data eller tydelig demo.** Testdata merkes «DEMO» i toppen og med en egen linje; ingenting vises som
  fakta når leverandøren ikke oppga det («Ikke oppgitt» er ikke det samme som «Ikke inkludert»).
- **Fly først.** Hotellskjermene er et eget, ennå ikke leverandørverifisert spor. Leiebil og cruise er ikke
  implementert i iPhone-appen. Ingen boardingkort, sete, gate eller betaling i appen; flytilbudet åpnes hos
  tilbyderen («Bestillingen fullføres hos tilbyderen.»).

## Farger

| Token | Verdi | Bruk |
|---|---|---|
| `canvas` | `#F3F4F6` | Appens lyse grunn bak kort og lister |
| `surfaceSoft` | `#F7F8FA` | Myk flate på grunnen |
| `bg` | `#0C0D0F` | Dypeste grafitt: flater inni øyene (brikker, fliser, verktøyknapper) |
| `raised` | `#191B1F` | Grafittøyene: søket, ruteoverskriften, helten på Min side, prislinjen, fanemenyen |
| `darkBorder` | `#2B2D32` | Kanter på mørke flater |
| `onDark` | `#F8F9FA` | Tekst på mørkt |
| `onDarkMuted` | `#B2B5BC` | Sekundærtekst på mørkt |
| `onDarkDim` | `#8E9199` | Tertiærtekst på mørkt |
| `white` | `#FFFFFF` | Søkeark, kort, ark |
| `inset` | `#F5F5F7` | Innfelte flater på hvitt (felt, segmenter) |
| `lightBorder` | `#E6E7EB` | Kanter på lyse flater |
| `text` | `#111214` | Tekst på lyst |
| `textSecondary` | `#62656D` | Sekundærtekst på lyst |
| `textDisabled` | `#B4B7BE` | Det som ikke kan velges (passerte dager i kalenderen); unntatt kontrastkravet |
| `blue` | `#0754F8` | Handling (på lyst og som knappeflate) |
| `bluePressed` | `#0544CC` | Trykket primærknapp |
| `blueOnDark` | `#4C8DFF` | Blå tekst/ikon på mørkt (valgt fane i menyen, «Lukk» i øya, +1-døgn) |
| `blueOnDarkTint` | `rgba(76,141,255,.18)` | Pillen bak ikonet i den valgte fanen |
| `blueSoft` | `#EAF0FF` | Valgt rad på lyst |
| `success` / `successSoft` | `#0A7A3F` / `#E8F5EE` | «Inkludert» |
| `warning` / `warningSoft` / `warningOnDark` | `#8A5000` / `#FFF6E5` / `#FFD27A` | Demo, bytte, utløpt pris |
| `danger` / `dangerSoft` | `#B42318` / `#FDECEA` | Feil, flyplassbytte |
| `scrim` / `scrimStrong` | `rgba(12,13,15,.55)` / `.78` | Nøytralt svart overlegg på foto |

Tilstandsfarger står alltid sammen med tekst eller ikon, aldri alene.

### Kontrast (WCAG 2.x, målt)

| Par | Forhold |
|---|---|
| `text` på `white` / `inset` / `canvas` | 18,7 / 17,2 / 17,0 |
| `textSecondary` på `white` / `inset` / `canvas` | 5,8 / 5,4 / 5,3 |
| `blue` på `white` / `canvas`, `white` på `blue` | 5,8 / 5,3 / 5,8 |
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
| `hero` | 28/34 | 600 | Overskriften på forsiden («Hvor vil du reise?») og «Min side» for gjester |
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
- **Skygger**: bare diskrete – kort `0 1 2 rgba(0,0,0,.06)`, søkeøya på Hjem `0 10 30 rgba(16,17,20,.18)`,
  fanemenyens kapsel `0 6 20 rgba(0,0,0,.35)`; ingen glød.
- **Bevegelse**: 260 ms, rask start og rolig landing (`MOTION_MS`, `src/lib/motion.ts`). Med «Reduser bevegelse»:
  ingen bevegelse eller størrelsesendring, bare en kort toning. Ingen haptikk ennå (`expo-haptics` er ikke med).

## Komponenter

| Komponent | Fil | Hva |
|---|---|---|
| `PrimaryButton`, `SecondaryButton`, `LinkButton`, `IconButton` | `src/components/ui.tsx` | Knapper (blå primær, mørk/lys sekundær, 44 pt ikonknapper) |
| `Chip`, `ChoiceChips`, `Segmented`, `DarkTabs` | `ui.tsx` | Filterbrikker (et aktivt filter fra arket: blå med «×», trykk fjerner), valg, «Tur-retur/Én vei» og «Avgang/Ankomst» (prikk = filter på i det andre valget), fanene i detaljene |
| `InformationCard`, `InfoRow` | `ui.tsx` | Hvite kort med rader (ikon, tittel, verdi) |
| `Notices`, `Banner`, `DemoBadge` | `ui.tsx` | Korte meldinger på mørkt (kan åpnes), meldinger på lyst, «DEMO»-merke |
| `Field`, `Stepper`, `BottomSheet`, `StateView` | `ui.tsx` | Tekstfelt, antall reisende, ark nedenfra, tomme/feil-tilstander |
| `SearchPanel` | `SearchPanel.tsx` | Søket i en grafittøy – på forsiden og åpnet i ruteoverskriften i resultatene (`onSearched`: søker der, ingen ny resultatside): turtype som tekstfaner (valgt lys med blå strek), fra og til under hverandre i ett hvitt felt (avgang- og landingsikon, bytt-knappen på skillelinjen; ved bytte glir verdiene synlig til hverandres rad), avreise ▸ retur i ett felt, reisende og klasse som brikker (40 pt + hitSlop = 44), «Søk fly» |
| `FormTile`, `DateField` | `DateField.tsx` | Celle med ikon, etikett og verdi, og datofelt med iOS' kalender (hotellsøket) |
| `ServiceSwitch` | `ServiceSwitch.tsx` | Fly eller hotell: et kompakt todelt valg inni søkeøya (valgt hvit med mørk tekst) – bare når serveren sier at hotellsøket er på; brikker i hotellsøket |
| `OfferCard`, `RouteLine`, `BaggageSummary` | `OfferCard.tsx` | Resultatkortet (215 pt tur-retur ved 390): hver strekning på to linjer («UT · 9. OKT.» og «3 t 16 min · 1 mellomlanding · CPH», så tider, koder og rutelinje), risiko (natt, flyplassbytte, 6 t+) med ikon og ord, bagasje ved prisen, hele kortet er knappen |
| `SortTabs` | `SortTabs.tsx` | Best / Billigst / Raskest i ruteoverskriften med ekte toppris og reisetid; valgt fane hvit på grafitt; under hverandre når et beløp ville brytes. «Tidligst» og «Senest avgang» står i «Sorter» |
| `FocusStatusBar`, `StatusBarShield` | `src/components/` | Statuslinjen for fanen som vises (fanene står montert; bare den synlige har sin StatusBar), og en skjerm bak statuslinjen når innholdet ruller under den (`tone` lys eller mørk) |
| `WelcomeGate`, `SignInSheet`, `SocialButtons` | `src/components/` | Velkomsten ved første oppstart (Apple, Google, e-post, «Opprett konto», «Hopp over»), innloggingsarket (iOS' sidekort, delt av velkomsten og Min side) og Apple/Google-knappene – bare når serveren sier at de er satt opp |
| `LightNotices` | `LightNotices.tsx` | Meldinger på den lyse grunnen i resultatene (demo, «Om «ca.»-priser») |
| `DateRangeSheet` | `RangeCalendar.tsx` | Avreise og retur i ett ark: månedsliste (mandag først), bånd mellom datoene, antall netter, passerte dager sperret, 47 × 46 pt dager |
| `TravellersSheet` | `TravellersSheet.tsx` | Reisende, reiseklasse og «Bare direktefly» i ett ark; brukes på forsiden og i Utforsk |
| `MarkedText` | `MarkedText.tsx` | Tekst der det kunden skrev er uthevet (600); samme regel som søket (starten av hvert ord, aksenter og æ/ø/å likegyldig). Bare visuelt – VoiceOver leser raden som før |
| `PriceTag` | `PriceTag.tsx` | Kronepris, «ca.»-pris med kurs, eller «Ingen pris i kroner» |
| `PhotoBackdrop`, `BottomFade` | `Photo.tsx` | Foto med nøytralt overlegg; kildemetadata beholdes uten synlig kreditering over bildet |
| `DestinationCard`, `DestinationRailCard`, `BottomNavigation`, `AirlineLogo`, `Icon` | `src/components/` | Reisemålskort (fotokort i Utforsk og på Min side, som vokser med tekststørrelsen og aldri kutter navnet; hvitt kort med foto, by, land og kode og «Se flyreiser» – uten pris – i raden på forsiden), fanemeny som flytende grafittkapsel på en lys stripe (Hjem, Utforsk, Lagret, Min side; valgt fane: blå pille bak ikonet og blå etikett; 48 pt faner), selskapslogo (eller kode), SVG-ikoner i Lucide-stil |

## Skjermene

1. **Hjem** (`src/app/(tabs)/index.tsx`): lys grunn. Øverst spørsmålet «Hvor vil du reise?» (innlogget: «God kveld,
   Kari» – aldri med serverens plassholder «Reisende») og en rund profilknapp (initialene når innlogget; «Min side»
   for VoiceOver). Så søket i en grafittøy med runde hjørner og myk skygge: Fly/Hotell som et todelt valg (bare når
   hotellsøket er på), `Tur-retur  Én vei` som tekstfaner, fra og til i ett hvitt felt med bytt-knappen på
   skillelinjen («Oslo (OSL)», tomt felt: «Til hvor?»), avreise ▸ retur i ett hvitt felt, reisende og klasse som
   brikker og «Søk fly» – det eneste helblå. Under øya: andre nylige søk som hvite brikker, eller linjen om at man ikke
   må logge inn. Så reisemål som hvite kort uten pris (et trykk søker dit med skjemaets datoer), og hvordan HelloSky
   virker. «Fra» starter på den vanlige avreiseflyplassen når den er valgt, med mindre kunden er midt i å planlegge
   en reise.
2. **Resultater** (`src/app/resultater.tsx`): ruteoverskriften er en grafittøy helt ut til kantene og opp under
   statuslinjen, med runde hjørner nederst. Den er et kompakt sammendrag av søket som vises: tilbake, ruten
   («Oslo → Barcelona», VoiceOver-overskrift; et trykk åpner søket), «DEMO» på samme linje, «Endre søk», og to brikker
   på 44 pt – datoene («10.–17. okt.», «Én vei · 10. okt.») og reisende og klasse – som åpner kalenderen eller
   reisende-arket med «Søk på nytt». Ruten eller «Endre søk» åpner øya til det samme søket som på Hjem, med «Lukk»;
   «Søk fly» søker der (ingen ny resultatside), og øya lukker seg til overskriften med den nye ruten. Mens den står
   åpen, er alt under den inaktivt. I øya står også Best / Billigst / Raskest (standard «Best», nettets vekter). På
   den lyse grunnen: brikkene (Alle, Direkte, Maks 1 mellomlanding, Bagasje inkludert), meldinger (demo, «Om
   «ca.»-priser»), antall reiser/tilbud, og ett hvitt kompakt kort per reise (samme reise hos flere tilbydere én gang,
   med billigste pris og «N tilbydere»). Flytende grafittlinje: Filtrer / Sorter / Datoer. Alle tilstander (tom,
   lasting, feil, liste) er samme liste, så et åpent ark eller søk står når svaret kommer. Samme søk på nytt (dra
   ned, «Oppdater prisene») lar listen stå; feiler det, står de forrige prisene med grunnen og klokkeslettet.
3. **Flydetaljer** (`src/app/tilbud/[id].tsx`): lys grunn med tittellinje; fotokort med selskap, utreisen i store
   tall og hjemreisen under; så én rulleflate uten faner: selgerne, reiseplanen for hver strekning (hvert fly, bytter,
   flyplassbytte, +1 døgn), bagasjen og vilkårene til valgt selger (vilkår bare når tilbyderen oppga dem) og prisen.
   Fast grafittlinje nederst: pris og grunnlag til venstre, «Gå til tilbud» til høyre, og under «[tilbyder] ·
   Bestillingen fullføres hos tilbyderen.». Handlingen åpner leverandørens egen lenke i Safari-visning, målt med
   nettets `flights.trackProviderClick`. VoiceOver hører «Gå til tilbud hos [tilbyder]».

I tillegg: flyplassøk (`flyplass.tsx`, hvitt modalark med lys statuslinje over sidekortet; med `hjem=1` velges den
vanlige avreiseflyplassen), Utforsk (`(tabs)/utforsk.tsx`; fra-flyplass, datoer og reisende som knapper øverst, liste
og kart), Lagret (hvite grupper med reisemål og nylige søk) og Min side (`(tabs)/profil.tsx`).

**Min side** er kundens egen side, ikke bare innstillinger. Øverst en grafittøy opp under statuslinjen: innlogget
«Hei, Kari» med initialer og e-post (uten ekte fornavn: «Du er logget inn»); for gjester «Min side», én setning om
kontoen (samme som på hellosky.no, trengs ikke for å søke), «Logg inn» og «Opprett konto». I øya tre fliser med det som
faktisk ligger på telefonen: nylige søk, lagrede reisemål og vanlig avreise (koden eller «–»). Under, på den lyse
grunnen: «Fortsett søket» (de tre nyeste søkene som ikke har passert; ett trykk søker igjen), lagrede reisemål som
fotokort (ett trykk søker dit), eller «Kom i gang» når det ikke finnes noe; Reisevaner (vanlig avreiseflyplass);
innlogget Konto og «På hellosky.no» (Mine reiser – bestillinger gjort på hellosky.no –, Reisende, Prisvarsler,
Sikkerhet og innlogging, åpnet i Safari-visning, der nettet ber om innlogging første gang); Innstillinger (språk,
NOK), Hjelp og juridisk, «Logg ut» og «Slett konto», og versjonen. Seksjonsoverskriftene er små versaler, som i
Lagret. Med stor tekst står en rads verdi under tittelen. Innloggingsskjemaet står i et eget ark (iOS' sidekort),
med «Glemt passordet?» i samme ark.

**Velkomsten** (`WelcomeGate`) står over appen ved første oppstart: foto med mørk toning og HelloSky-merket, én setning
om hva appen gjør, «Fortsett med Apple», «Fortsett med Google» (begge bare når serveren sier at de er satt opp),
«Fortsett med e-post», «Opprett konto» og «Hopp over». Søk krever aldri konto.

Forsiden: etter søk står de andre nylige søkene (ikke passerte, ikke det som står i skjemaet) som små hvite brikker
under øya – «OSL‑LHR 9.–16. okt.», ett trykk søker igjen – der linjen om innlogging står for nye kunder.
Bytt-knappen snur en halv runde og verdiene glir til hverandres rad (ikke med «Reduser bevegelse»); VoiceOver hører
den nye ruten. I reisende-arket står et sammendrag øverst, og en regel som stopper en knapp (spedbarn per voksen, ni
reisende) står rett under den.

Flyplassøket viser registerets treff med én gang, på begge språk («København (Copenhagen)» når bare det engelske
navnet passet), og serverens treff under når de kommer – radene over flytter seg ikke. Det kunden skrev er uthevet;
en nøyaktig kode står invertert (kull med hvit tekst). Søk på byen Oslo gir Torp som egen rad rett under, merket
«Annen flyplass nær Oslo». Lasting og en feil hos serveren står under treffene, ikke over.

## Foto

- Bildene er HelloSkys egne, godkjente reisefoto fra nettets register (`public/destinations`, `public/photos`),
  kopiert inn av `scripts/make-photos.mjs` (1080 px brede). De følger med appen: ingen bildesøk ved visning,
  ingen Unsplash-nøkkel i appen.
- Opphavet beholdes i nettets register `src/content/photos.ts` og appens `src/lib/destinations.ts`.
  De lokalt medfølgende bildene dekker ikke appens skjermflater med kildeetiketter eller en kredittliste på Min side.
  Nye API-leverte bilder krever en egen kontroll av leverandørens attribusjonsvilkår før visning.
- Nye bilder legges først inn i nettets register med kilde (og helst fotograf), deretter i
  `src/lib/destinations.ts`.

## Tre skjermer – målbar spesifikasjon

**Status 26.09.2026:** tallene under er målt på den mørke utgaven (`dad15c4`, H2–H5 på nytt 25.09). «Cloud +
Graphite» (`a264f54`–`deb7898`) er ikke målt på nytt her: ruteoverskriften er omtrent 36 pt høyere (brikkene med
datoer og reisende erstatter én bildetekstlinje), så R3 og R4 må måles igjen. Nettleserbildene av den nye utgaven
står i `docs/evidence/MANIFEST.md` (`cg-*`, `minside-*`, `transform-*`).

**Referanse.** Eierens bilde med tre HelloSky-skjermer (Hjem, Resultater, Flydetaljer), vedlagt i Claude-økten
23.09.2026 kl. 16:37 UTC: JPEG, 305 928 byte, SHA-256 `a7b86c85100d486f8f02def97570a47beb488c961aa2e955b4e1da7821f02817`.
Det ligger ikke i repoet: det har tredjeparts flyselskapslogoer og et portrett. Det er en generert illustrasjon og
brukes for proporsjoner og hierarki, ikke som fasit piksel for piksel. Skjermene i bildet er 393 × ~941 pt
(forhold 2,39; en iPhone er 2,17), så høyder derfra gjelder ikke direkte på en 852 pt høy skjerm. Referansetall
under er målt i bildet med 1,013 px per pt (skjermen antatt 393 pt bred).

**Momondo-skjermbilder (sekundær referanse, bare samspill).** Alle 7 kom fram i Claude-økten 23.09.2026
(1206 × 2622 px, 402 pt ved 3×): valgfri innlogging, søkeskjema, rullet forside med tilbudskort, «Popular tools»,
Profil (to bilder) og Utforsk-kart. De ligger ikke i repoet (tredjeparts merkevare). Vi tar prinsipper, ikke farger
(lilla/rosa), logo, illustrasjoner eller tekst:

1. *Innlogging er valgfri og kan hoppes over* («Skip» øverst); ett tydelig hovedvalg. Hos oss: søk uten konto
   (som nå). Ingen påstand om «bestillingshistorikk» – vi har ingen. Ingen Apple/Google-knapp i appen før det er
   bygget og godkjent.
2. *Samlet, kompakt søk:* Fra/Til i én boks med bytt-knappen på skillelinjen, datoene som ett felt («23 Oct ▸
   30 Oct»), reisende og klasse som små valg. Skjemaet (turtype → Søk) er ~270 pt hos dem (anslått i bildet), 360 pt hos oss
   (218 → 578). Med våre flater på minst 44 pt blir samme oppbygning anslagsvis ~310 pt. Det gir plass til
   reisemålskortene.
3. *Søket krymper til en fast «Finn fly»-linje når man ruller*, så innholdet under blir tilgjengelig.
4. *Reisemålskort med beslutningsinfo* (reisetid, direkte, datoer, pris). Hos oss: bare det serveren faktisk kan
   gi for kortet; ingen «deals under …» og ingen pris uten et gyldig tilbud.
5. *Bunnmenyen er rolig:* fire valg, ett markert. Hos oss: fire (Hjem, Utforsk, Lagret, Min side). *25.09.2026:*
   en flytende kapsel som deres (hevet mørk flate, rund, 16 pt marg på sidene, over hjemindikatoren), uten glass:
   en uskarp bakgrunn krever en ny avhengighet, og en halvgjennomsiktig flate uten uskarphet blir uryddig.
6. *Profil som en ryddig innstillingsliste:* ett innloggingskort øverst, så grupper med rader som viser verdien
   til høyre («Currency £ (GBP)», «Region»). Hos oss: «Språk – Norsk (bokmål)», «Valuta – NOK» (bare
   informasjon), Hjelp, Personvern, Vilkår, Om oss. De juridiske radene samlet nederst; «Software licenses»
   (lisenser for åpen kildekode) er en rad vi mangler. *Bygget 25.09.2026* (se Skjermene); språket er fortsatt et valg
   rett i raden (to trykk færre enn en egen side), og lisensraden mangler fortsatt. *26.09.2026:* Profil er blitt Min side
   med en grafitthelt og moduler over innstillingene (se Skjermene).
7. *Utforsk sier hva et prisanslag er* («Estimated cheapest price per person in economy class»), står fast på
   avreisestedet («From OSL · Anytime») og har alltid en listevisning. Hos oss: liste, ikke kart (et kart uten
   ekte priser ville vært dødt), og ingen prisanslag før serveren har dem.

**Status 25.09.2026 (eierens nye skjermbilder, samme referanse):** punkt 2 er bygget på forsiden (se Skjermene),
med to tillegg: avgang- og landingsikon i rutefeltet (feltene har ingen etiketter) og hele datoen for VoiceOver.
Punkt 3 er ikke bygget ennå: forsiden er bare ~1,3 skjermer høy (målt 1020 pt innhold ved 390 × 844), så skjemaet
kan ikke rulles ut av bildet med vanlig tekststørrelse – linjen ville aldri vises. Den kommer når forsiden får mer
innhold (ekte tilbudsrad, se backloggen); til da ruller et trykk på statuslinjen til toppen, som i alle iOS-lister.

Ikke kopieres: Stays/Cars/Flight+Hotel, «Travel deals under £98», GBP, bjelle/varsler, Trips, «Price Alerts»
(bare hvis ekte), «Rate the app», kart med prisnåler, «Tracking preferences» (krever først en avklart
sporingspolicy), bagasje som søkevalg (søket tar ikke imot bagasje; vi filtrerer på bagasje i
resultatene). Multi-city er en ny funksjon og hører ikke til denne runden.

**Målt slik:** fiksturen (demo, Oslo → Barcelona, 5 tilbud) med vanlig tekststørrelse, ved 375 × 812, 393 × 852
og 430 × 932, pluss Resultater ved 320 × 568.
- Ny installasjon: ingen lagret språk.
- react-native-web i Chromium, med Inter i stedet for SF Pro.
- Simulert safe area øverst/nederst: 50/34 pt ved 375, 59/34 ved 393 og 430, 20/0 ved 320.
- Tall i punkter fra toppen av skjermen.
- Commit `dad15c4`. Bildene er `nb-dad15c4-*` og `en-dad15c4-*` i `docs/evidence`; metoden står i `MANIFEST.md`.
- H2–H5 er målt på nytt 25.09.2026 for den nye forsiden (med fanemenyen som flytende kapsel), samme metode.
- Ikke målt på iPhone ennå.

| # | Krav | Mål | Målt 375 / 393 / 430 |
|---|---|---|---|
| H1 | Ny installasjon er på norsk | «Søk fly», ingen lagret språk | ja / ja / ja |
| H2 | Toppen er kompakt (ingen fotohode siden 25.09) | tittel og profilknapp på én linje, rett under statuslinjen | ja / ja / ja |
| H3 | «Søk fly» er ett blått hovedvalg og synlig uten rulling | 52 pt, bunn over fanemenyen | 539 < 724 / 548 < 764 / 548 < 844 (25.09) |
| H4 | «Utforsk reisemål» og foto i første bilde | overskriften og ≥ 40 pt av første kort over menyen | 59 / 90 / 170 pt (25.09) |
| H5 | Reisemålskort uten oppdiktet pris; tomt reisemål som et dempet spørsmål | «Se flyreiser»; «Til hvor?» ikke blå | ja (25.09) |
| R1 | Første reise viser begge etapper | «UT · dato» og «HJEM · dato» med tider, rute og stopp | ja / ja / ja |
| R2 | Totalpris med grunnlag nede til venstre, «Detaljer» nede til høyre | «Totalt for 1 voksen · Tur-retur»; pillen ≥ 44 pt | ja; pillen 44 pt høy |
| R3 | Totalpris og «Detaljer» over den flytende linjen, også ved 320 | bunn ≤ linjens topp | 469 < 712 / 478 < 752 / 478 < 832; 320 nb 493 < 502, en 457 < 502 |
| R4 | Neste reise er synlig før rulling | ≥ 90 % | 90 % / 100 % / 100 % |
| R5 | Grupperte reiser, tilbud per selger | «N reiser · M tilbud»; selgerne først i detaljene | «4 reiser · 5 tilbud»; ja |
| R6 | Flytende linje: Filtrer / Sorter / Datoer; siste kort kan rulles fram over den | hver ≥ 44 pt, ingen «Kart» | ja |
| R7 | Demo-varselet er alltid synlig | ikke skjult eller forkortet | ja |
| D1 | Detaljene gjelder kortet man trykket på | `/tilbud/<id>`, samme tider og pris | `dy_eve`, 18:40 22:00 06:55 10:15, 1 990 kr |
| D2 | Fotoppsummering med begge etapper | utreise stort, hjemreise under | ja |
| D3 | Faner og «Reiseinformasjon» i første bilde | faner 44 pt; overskriften over bunnlinjen | 533 < 681 / 542 < 721 / 542 < 801 |
| D4 | Kompakt bunnlinje | pris og grunnlag til venstre, «Gå til tilbud» til høyre, valgt tilbyder og «Bestillingen fullføres hos tilbyderen.» ved handlingen; ≤ 135 pt med safe area; brytes i stedet for å kuttes, og deles selve beløpet over to linjer (stor tekst), står prisen alene og knappen under (`00d18db`) | 131 / 131 / 131 |
| F1 | Ingen vannrett rulling og ingen kuttet tekst | – | ingen |
| F2 | Trykkflater ≥ 44 pt, uten `hitSlop` over naboer eller utenfor et klippende felt | alle synlige i første bilde | ja |

**Bevisste avvik fra referansen** (produktkrav går foran bildet; listen er oppdatert 24.09):
- Fly/hotell er et tjenestevalg; «Tur-retur / Én vei» er et eget valg i flyskjemaet. Leiebil vises ikke som en fungerende tjeneste.
- Begge etapper på hvert kort.
- Totalpris for alle reisende bare når leverandørens prismodus er bekreftet; ellers merkes beløpet som ubekreftet.
- «Utforsk reisemål», ikke «Populære destinasjoner» (vi har ingen popularitetsdata).
- Utforsk har nå et kart over kuraterte flyplasser, men ingen prisnåler. Kartets brukbarhet på iPhone er under aktiv retting.
- Ingen bjelle, hjerte, bagasjeendring, setevalg eller «Fra … kr» på reisemål uten fungerende funksjon og verifisert
  data. Min side lenker til kundens egne sider på hellosky.no (Mine reiser, Prisvarsler …), tydelig som nettsider;
  appen viser ingen tall eller lister derfra.
- Flyselskapets kode i en sirkel til verifiserte logoer finnes; ingen halegrafikk.
- Knappen er «Gå til tilbud» med valgt tilbyder rett under, ikke «Velg denne flyreisen».

**Lukket i `dad15c4`:**
- Reisemålene står i første bilde (H4).
- Neste reise er ≥ 90 % synlig (R4).
- Bunnlinjen er 131 pt (D4).
- «Om «ca.»-priser» er en rad på 44 pt.
- «Detaljer» er fri ved 320 pt.
- Selgerne kommer først, med hele bagasjen.
- «Velg» er mørk tekst.

**Igjen å vurdere:**
1. *Flydetaljer:* varselet mellom oppsummering og faner (64 pt). Det står der også for testmiljø og for «ikke
   bekreftet ekte pris», og forsvinner bare når serveren oppgir en kjent tilbyder og `sandbox: false`.
2. *Resultater:*
   - Ingen ekte flyselskapslogoer, bare koden.
   - Ingen lagring av reiser (hjerte). Serveren har lagrede reiser for nettet, men de er ikke tilgjengelige i
     mobilfasaden ennå (BACKLOG 37).
3. *Typografi (valgfritt):* flyplasskodene i Flydetaljer er 32 pt, referansen ~28.

**Lukket i `00d18db`:**
- En innstillingsfil med ukjent versjon beholdes, og bare et bevisst språkvalg skrives inn (BACKLOG 8).
- `accessibilityLanguage` (nb-NO/en-GB) står på alt VoiceOver kan stoppe på (BACKLOG 43). Det er sjekket i kodetester,
  ikke med VoiceOver.
- Flere reisende og lange tilbydernavn er målt ved 375 pt, på bokmål, engelsk og med 135 % tekst (MANIFEST,
  «Edge cases»). Reisende-feltet, navnet i oppsummeringen og tidslinjen og fanene brytes nå i stedet for å kuttes.
  I tidslinjen legger varigheten seg under et langt navn.
- Ved stor tekst deles ikke beløpet i bunnlinjen lenger («18 450 k» / «r»): prisen står alene og knappen under (D4).

**Lukket i `be41be4`:**
- Selgerraden: prisen står til høyre så lenge teksten ved siden av har plass. Prisen legger seg under teksten når
  navnet brytes (langt navn eller stor tekst), eller når tekstkolonnen er smalere enn de faste ordene ved
  tekststørrelsen (80 pt × tekstskala, der «Håndbagasje» er ~74 pt). Da får navn, bagasje og vilkår hele bredden, og
  ingen ord deles. Korte navn med vanlig tekst er uendret (pikselidentisk på nett, bokmål og engelsk).
  Beslutningen bor i skjermen og gjelder for tekststørrelsen den ble målt med, så den overlever fanebytte. Radene og
  beløpet i bunnlinjen lages på nytt når tekststørrelsen endres, og måles da med den nye skalaen.

## Forhåndsvisninger

Skjermbildene i overleveringen (`docs/evidence`, se `MANIFEST.md`) er laget med react-native-web i Chromium, 375, 393
og 430 pt brede, med Inter i stedet for SF Pro. De nyeste (`edge-*-00d18db-*` for kantilfellene, `nb-dad15c4-*`, og `nb-d99568d-*` før dem) har simulert safe area; de eldre har ingen.
De er ikke fra en iOS-simulator. En ekte iPhone eller simulator viser SF Pro, iOS-kalenderen, statuslinjen og den
ekte safe area.
