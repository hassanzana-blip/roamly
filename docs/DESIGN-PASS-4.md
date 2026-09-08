# Fjerde runde — hva som er gjort, og hva som gjenstår

Denne runden handlet om én ting mer enn noe annet: HelloSky solgte hele verden,
men var bygget som om det solgte Midtøsten. Alt annet henger sammen med det.

Alt under er målt på det bygde bygget, ikke på utviklingsserveren.

## Fra diaspora-produkt til verdensomspennende reisebyrå

Forsidens tyngdepunkt – seks ruter med ekte priser – var Erbil, Istanbul,
Beirut, Sulaymaniyah, Dubai og Jeddah. «Anbefalt for deg» var de samme seks.
Om oss het «Reisebyrået som kjenner veien hjem». En kunde som ville til
Barcelona så ikke seg selv noe sted.

- **Reisemålene er ett register** med tema og region, ikke tre håndplukkede
  lister. `spreadAcrossRegions` går rundt regionene, så seks kort aldri blir
  seks naboland.
- **Ny seksjon: verden etter tema.** Sol og strand, storby, med barn, mat og
  kultur, natur, langtur, hjem til familien. Én interaktiv oppdagelse i stedet
  for elleve like kortrader.
- **Populære ruter** er nå Barcelona, Istanbul, London, Bangkok, Dubai og New
  York – ren data med flagg og ekte fra-priser.
- **Hjemreisene er én historie** i full bredde, ikke hele merkevaren.
  Spesialkunnskapen står tydelig; den eier bare ikke forsiden lenger.
- Tittelen sier hva vi selger: **«Hele verden. Ett søk unna.»**

## Flyplassøk over hele verden

Søket kjente 103 flyplasser. Kraków, Tbilisi, Alicante og Gdańsk ga null treff.

- OurAirports (public domain) filtrert til **3 244 flyplasser** med rutetrafikk
  og IATA-kode. 454 kB, lest bare av serveren – CSV-en på 12 MB kommer aldri i
  nærheten av nettleseren.
- Nettleseren beholder det kuraterte settet for øyeblikkelige forslag og spør
  serveren først når det lokale settet ikke rekker.
- Registeret er metadata, aldri inventar: tilgjengelighet, pris og
  billettutstedelse kommer fortsatt utelukkende fra leverandørene.

## Kassen

Tre reisende med passkrav ga trettifem felt på rad på en telefon.

- Reisende er nå progressiv: den du holder på med står åpen, resten hviler som
  sammendragslinjer med navn og hake, og neste åpner seg når den forrige er
  ferdig. En feil trekker alltid sin egen rad opp.
- «Reisen din» viser flyselskapets eget merke ved hver strekning.
- 3 359 piksler i stedet for 4 189, med samme innhold.

## Kundeservice

- Telefon og WhatsApp står rett under spørsmålet, ikke under «kanaler» langt
  nede på en side man åpner fordi noe er galt.
- Ny hensikt: «Jeg reiser snart – avreise innen 48 timer». Der er et skjema
  feil svar; siden svarer med telefon og WhatsApp.
- WhatsApp-boblen er verifisert mot innhold ved 1024, 1280 og 1440 på forsiden,
  søket og kundeservice: den dekker ingen knapp, lenke eller kontroll. På
  telefon og nettbrett finnes den ikke – bunnavigasjonen eier det hjørnet.

## Journalen

Etter toppsaken fulgte femten like kort i tre kolonner. Resten er nå delt etter
det eneste ekte signalet vi har: har saken et kontrollert fotografi, eller er
den en praktisk gjennomgang? «Steder» får bredden, «Det praktiske» er en
indeks på hårlinjer. Fire formater i stedet for ett.

## Bilder

- **Ni AI-genererte fotografier** lå planlagt inn i produktet – ankomsthaller
  med genererte mennesker, og et generert bilde av Harnet Avenue i Asmara som
  reisemålsbilde. De var aldri hentet ned og aldri i bruk, men skriptet lå der
  og registeret beskrev dem som normalt. Skriptet er fjernet, og regelen står
  nå i `docs/ASSETS.md`: ekte fotografi, aldri AI-genererte reisebilder.
- `src/content/photos.ts` er kilden til opphav, og **/fotokreditering**
  («Bildene bak reisen») viser bildene med sted og lisens. Der fotografens navn
  ennå ikke er nedtegnet, sier siden det én gang øverst i stedet for å finne på
  et navn. Lenket fra bunnteksten.

## Sosial innlogging

Serveren leser miljøet: en leverandør er konfigurert først når både klient-id og
hemmelighet er satt. `customerAuth.authProviders` sier hvilke som er på, og
grensesnittet følger. Å skru på Google er to miljøvariabler i Railway, ikke en
kodeendring. X er lagt til. Profil → Sikkerhet har «Tilkoblede kontoer», som
sier rett ut når ingen leverandør er satt opp i stedet for å vise døde knapper.

## Ytelse

| Side          | Før runden | Nå    |
| ------------- | ---------- | ----- |
| Forside       | 65         | 76    |
| Søk           | 69         | 75    |
| Journal       | 77         | 78    |
| Profil        | 81         | 81    |
| Kundeservice  | –          | 82    |

Blokkert tid på forsiden: 470 ms → 140 ms. CLS 0.

Animasjonsbiblioteket lå i bunnen av hver eneste mobilside for tre ting
nettleseren gjør selv: bunnavigasjonens aktive flate, trykkfølelsen på knapper,
og en kryssfade ved temabytte. Alle tre er nå ren CSS. Delte byggeklosser samles
i én chunk i stedet for femten filer på 2 kB.

## Feil funnet og rettet

- `/sok` uten reisemål eller dato falt i feilgrensen: datoformatererne kastet
  «Invalid time value» på tom streng. De returnerer nå tom streng, og søkesiden
  viser et ferdig åpnet søk.
- Søket normaliserte ikke aksenter: «Malaga» fant ikke Málaga, «Kobenhavn» ikke
  København, «Zurich» ikke Zürich.
- OurAirports oppgir landnavn på engelsk; landlisten er flyttet til contracts og
  brukes av begge sider, så et polsk forslag sier «Polen».
- Terningkastet på reisemålskortene var en oppdiktet redaksjonell score som
  leste som brukeranmeldelser. Fjernet.

## Portvakter

| Gate | Status |
| --- | --- |
| `npm run check` (tsc -b) | grønn |
| `npm run lint` | grønn |
| `npm test` (19 filer, 218 tester) | grønn |
| `npm run build` | grønn |
| `npx playwright test` (4) | grønn |
| axe wcag2a+wcag2aa, 14 ruter × 390/1440 | ingen alvorlige eller kritiske |
| Sidegjennomgang, 24 ruter × 375/390/430/768/1440 | ingen overflyt, ingen feilgrense, ingen JS-feil |

## Ikke gjort, og hvorfor

- **Ny fotografi.** `images.unsplash.com`, `api.unsplash.com` og Pexels er
  blokkert av organisasjonspolicy i denne sesjonen (403 på CONNECT). Jeg kunne
  ikke hente ett eneste nytt bilde. Systemet for opphav og kreditering står
  klart; å utvide bildebiblioteket krever at egress åpnes eller at bildene
  legges inn manuelt.
- **Selve OAuth-flyten.** Krever registrerte apper og callback-URL-er hos Apple,
  Google, Facebook og X, og nøkler jeg ikke har. Arkitekturen og grensesnittet
  står; sømmen er klar.
- **Passkeys.** Feltet finnes i svaret fra serveren og er `false`. Selve
  implementasjonen krever samme oppsett som over.
- **Lagret med fem faner** (reiser, fly, hoteller, reisemål, artikler). Vi
  lagrer i dag reisemål og søk. Å legge til tre tomme faner for data vi ikke
  samler ville vært oppdiktet modenhet.
- **MapLibre-kart.** Ikke lagt inn: ingen av flatene har i dag et kart som gjør
  en jobb et bilde ikke gjør bedre.
- **Reisetavler med omslag og merker.** Rutene finnes; det visuelle laget er
  ikke bygget.
