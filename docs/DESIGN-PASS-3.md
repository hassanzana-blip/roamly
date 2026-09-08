# Tredje designrunde — hva som er endret, og hva som gjenstår

Denne runden handlet om fire sider: profilen, søkeresultatene, forsiden og
journalen. Målet var at en kunde som så HelloSky i går skal kjenne igjen
produktet, men merke at noen har tatt over.

Alt under er målt på det bygde bygget, ikke på utviklingsserveren.

## Profilen: fra innstillingsside til reiseside

Profilen leste som iOS-innstillinger med reisedata pakket inn i rader. Den er
bygget om rundt fire spørsmål i den rekkefølgen folk stiller dem: hvem er jeg,
hva er neste reise, hva bør jeg bry meg om nå, hva har jeg bygget opp her.
Innstillinger er flyttet ut til `/profil/innstillinger`.

- **Identitetsbånd** øverst: navn, nivå, medlemsnummer og reisebalansen –
  reiser, land og byer regnet fra ekte, gjennomførte bestillinger.
- **Neste reise er en scene**, ikke et kort: byens eget foto i full styrke med
  en bunntung skygge, nedtellingen som lime-flate, rute, dato og klokkeslett
  som et boardingkort, to handlinger i stedet for tre.
- **Reisepasset** viser landene som flagg, ikke tall i en grå boks.
- **Favorittrutene** er ett fotografisk objekt per rute.
- **Snarveiene** er et rutenett med flater i stedet for en liste med rader.
- Hver modul skjuler seg selv når den ikke har ekte data å vise.

## Søkeresultatene: én scene og fjorten rolige rader

Hvert tilbud hadde sju bånd med hårlinjer mellom. Siden ble 19 500 piksler lang
på telefon, og «Vårt valg» så ut som de andre.

- «Vårt valg» er nå en mørk scene med begrunnelsen først som avkryssede fakta,
  prisen stor og valget som full flate.
- De øvrige er rolige rader uten indre rammer.
- Sammenlign og del er flyttet inn i detaljene.
- Totalprisen for følget («Totalt for 2 voksne · 1 barn») er det dominerende
  tallet i hver rad.

Siden er 14 650 piksler i stedet for 19 500.

## Forsiden: søket som ett objekt

Søket var et kort inni et kort inni et kort. Nå er det ett objekt – turtypene
øverst, én hårlinje, feltene rett på flaten. «Rutene hjem» viser landflagget,
og «Derfor reiser familier med oss» er kortet ned fra tre avsnitt til tre
linjer.

## Journalen: omslaget sier hva saken handler om

Fjorten av tjuetre artikler har ikke et verifisert foto, og alle fikk samme
vinge i tre farger. Omslaget bærer nå kategoriens egen glyf fra
HelloSky-pakken: bagasjesaker ser ut som bagasje, mellomlanding som
mellomlanding. Ti historietyper ganger tre flater.

## Flagg og flyselskapslogoer

- `CountryFlag` bruker flag-icons (MIT), vendret som statiske SVG-er i
  `public/flags`. Ingenting havner i JS-bunten. Flagg brukes der landet er
  informasjon: flyplassvelgeren, rutene, reisene, reisepasset – aldri som pynt.
- `AirlineLogo` viser leverandørens egen logo når vi har den, ellers et
  IATA-monogram. Vi tegner aldri en logo selv og henter den aldri fra
  bildesøk. På mørk flate står logoen på hvit plate, slik selskapene krever.

## Ytelse

Lighthouse mobil, bygget app, simulert 4G:

| Side     | Før | Etter  |
| -------- | --- | ------ |
| Forside  | 50  | 65–67  |
| Søk      | 50  | 69     |
| Journal  | 56  | 77–83  |
| Profil   | –   | 81     |

Hva som ble gjort:

- **Statiske filer ble servert ukomprimert.** react-vendor gikk over nettet som
  355 kB der brotli gir 95. Bygget forhåndskomprimerer nå alt komprimerbart, og
  `serveStatic({ precompressed: true })` velger riktig variant. 2 586 kB → 676 kB.
- **Miniatyrene lastet 640 px-bilder i 64 px-rammer.** Nye 256 px-varianter tok
  reisemålsbildene på forsiden fra 290 kB til 52 kB.
- **Skriftene forhåndslastes.** CLS er 0 på alle målte sider.
- **luxon (71 kB) er ute** av bunten; `Intl` gjør jobben.
- **react-day-picker (76 kB)** lastes først når datovelgeren åpnes.
- **Sideinngangen er ren CSS**, ikke motion i basischunken.
- **Forsidens innhold under folden** gjengis når hovedtråden er ledig.

Forside og søk står igjen under 70. Resten av gapet er hovedtrådsarbeid i en
klientgjengitt app: `react-vendor` bruker 1,5 sekunder på å kjøre på en strupet
mobil-CPU. Å lukke det krever tjenersidegjengivelse – en arkitekturendring, ikke
en designendring.

## Feil funnet og rettet underveis

- `npm run check` (`tsc -b`) var rød i hele kodebasen: ikonstørrelsene 18 og 22
  finnes ikke i skalaen 14/16/20/24/28. Snappet til skalaen; typesjekken er grønn
  for første gang.
- `account.hub.nextTrip` er `null` i praksis, men ikke i typen (`upcoming[0] ?? null`
  smalner ikke uten `noUncheckedIndexedAccess`).
- `HubModules.tsx` var død kode ingen importerte, og den kompilerte ikke.
- `.text-primary` er globalt overstyrt til olivenfargen fordi ren lime ikke er
  lesbar på hvitt. På mørk flate ble den mudder. Ny `.text-lime-dark`.
- `layoverInfo` ga luxon `setZone: true`, som betyr «bruk sonen fra strengen» og
  dermed overstyrte flyplassens sone: alt ble regnet i UTC. Nå regnes det i
  flyplassens sone, slik dokumentasjonen alltid har sagt. Fem tester låser det.
- Kvadratiske utsnitt av liggende byfoto traff himmelen og ga tomme, lyse ruter.
- `.photo-wash` la et jevnt teppe over hele fotoet og var likevel for svak der
  teksten står.
- Kontrastfeil (WCAG AA) på lys limeflate i profilen og på 9 px etiketter i
  `/quiz`.

## Portvakter

| Gate                         | Status |
| ---------------------------- | ------ |
| `npm run check` (tsc -b)     | grønn  |
| `npm run lint`               | grønn  |
| `npm test` (18 filer, 213)   | grønn  |
| `npm run build`              | grønn  |
| `npx playwright test` (4)    | grønn  |
| axe wcag2a+wcag2aa, 19 ruter × 390/1440 | ingen alvorlige eller kritiske |
| Horisontal overflyt, 390 og 768 | ingen |

## Ikke gjort

Fra oppdraget står følgende igjen, og er ikke påbegynt:

- OurAirports-datalag for flyplassmetadata.
- MapLibre-kart der det er funksjonelt.
- Better Auth med Apple/Google/Facebook/X og passkeys. Leverandørregisteret
  finnes (`src/lib/authProviders.ts`) og viser bare det som faktisk er satt opp;
  ingen av dem er konfigurert ennå.
- Reisetavler med visuelle omslag, og merker/achievements.
- Utvidede reisemålssider.
