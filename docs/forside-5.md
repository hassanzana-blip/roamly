# Forsiden: «Mer ferie. For pengene.»

Dette dokumentet hører til de to godkjente forsidedesignene (toppen og
fortsettelsen nedover samme side). Det sier hva som er bygget, hva som er
verifisert, hvilke bilder som er brukt, og hva som fortsatt mangler fra
leverandørene før forsiden kan vise priser.

## Hva som er bygget

| Del | Fil | Merknad |
|-----|-----|---------|
| Topp: logo, profil, to-linjers tittel, undertittel | `src/pages/Home.tsx` | Logoen er den godkjente produksjonsfilen, uendret |
| Kategorivalg Fly/Hotell/Leiebil/Cruise | `src/components/app/ServiceTabs.tsx` (`variant="card"`) | Valgt = royal blå med hvit tekst og hvitt ikon |
| Søkekortet | uendret | Det godkjente søket er ikke redesignet |
| «Hvor langt rekker budsjettet?» | `HomeDiscover.tsx` → `BudgetPanel` | Sjøgrønt panel, valgt = mørk skog. Valget settes som `maxpris` i søket |
| «En helg et annet sted» | `HomeDiscover.tsx` → `WeekendAway` | To kort med foto, lagreknapp, reisemål, grunnlagslinje |
| «Litt sol igjen?» | `HomeDiscover.tsx` → `SeasonBanner` | Teksten følger årstiden (`seasonKey`), den står ikke fast på høst |
| «Finn hotell til en god pris» | `HotelDiscover.tsx` | Ett sted på siden. Ekte stedssøk + kart |
| «Reis fra din flyplass» | `HomeDiscover.tsx` → `DeparturePanel` | Oslo (OSL), Torp (TRF), Bergen (BGO), Stavanger (SVG) |
| «Finn en tur under X kr» | `HomeDiscover.tsx` → `BudgetOffers` | Radene følger valgt flyplass, budsjett, datoer og antall reisende |
| «Hva slags pause trenger du?» | `HomeDiscover.tsx` → `BreakStyles` | Storbyhelg (lavendel) og Sol og strand (aprikos) |
| Bestillingsforklaring | `Home.tsx` | «Du søker her. Bestillingen gjør du hos leverandøren.» |
| Delte regler og lenkebygging | `src/lib/homeDiscover.ts` (+ `.test.ts`) | 7 tester |

Bunnmenyen er beholdt, med `body.has-tabbar` og `env(safe-area-inset-bottom)`.

Nye farger i `src/index.css` og `tailwind.config.js`, lyst og mørkt tema:
`--sea`, `--forest`, `--apricot`, `--sunny-warm`, `--lav-soft`, `--page`.

Sandefjord lufthavn Torp (`TRF`) er lagt inn i `contracts/airports.ts` med
riktige koordinater og tidssone, slik at Torp-valget gir et ekte søk.

## Kontroller som faktisk gjør noe

* Budsjettvalget legger `maxpris` på `/sok`-lenkene fra forsiden. Uten valg
  settes ingen ramme.
* Flyplassvalget bytter avreisested i forslagene under. Panelet sier selv at
  søket øverst på siden ikke endres, fordi det ikke gjør det.
* «Kart» åpner det samme MapLibre-kartet resten av siden bruker, lastet først
  når noen ber om det. Uten nett til flisene faller det tilbake til et
  SVG-kart – kontrollen er aldri død.
* «Hvor vil du bo?» er et ekte kombinasjonsfelt mot `hotels.places` med
  piltaster, Enter og Escape, ikke en knapp som ser ut som et felt.
* Hjertene lagrer reisemålet lokalt, som ellers på siden.

## Priser: hva vi ikke kan vise ennå

Designene viser «Fra 1 290 kr» på reisemålskortene. Det kan vi ikke vise i
dag, og vi gjetter ikke: `flights.priceHints` svarer `{ date, amount: null }`
for hver dato, så det finnes ingen priskilde per reisemål eller dag.

Derfor står det «Se flyreiser» der prisen skulle stått, og overskriften over
tilbudslisten er «Finn en tur under X kr» – et tilbud om å søke, ikke en
påstand om en pris. Ingen priser fra skissene er kopiert inn.

Når en priskilde finnes, må hver pris bære: valuta, datoer, avreisested,
om den er per person eller totalt, hvordan obligatoriske gebyrer er
behandlet, og en lenke som fører til nøyaktig den prisen.

## Andre avhengigheter som står igjen

* **«Hvor som helst» som reisemål** støttes ikke av søket. Forsiden peker
  derfor på konkrete reisemål i stedet for å love et søk vi ikke kan kjøre.
* **Kartfliser** hentes fra `tiles.openfreemap.org`. Uten utgående nett vises
  SVG-fallbacken.
* **Hotellsøket** krever `KAYAK_HOTELS_ENABLED`. Er det av, deaktiveres
  stedsfeltet i stedet for å late som det virker.

## Avhengigheter lagt til

Ingen. Alt i listen som trengtes var allerede installert: Radix, shadcn-delene,
lucide-react, Manrope, react-hook-form, zod, react-day-picker, date-fns, cmdk,
TanStack Query, vaul, motion, embla-carousel og maplibre-gl.

## Bilder

Alle bildene på forsiden er reisemålsfoto som allerede lå i prosjektet under
Unsplash-/Pexels-lisens, registrert i `src/content/photos.ts` og vist på
`/fotokreditering`. Ingen nye filer er lastet ned, ingenting er kjøpt, og
ingen bilder er AI-genererte.

| Seksjon | Reisemål | Fil |
|---------|----------|-----|
| En helg et annet sted | Lisboa, Warszawa | `public/destinations/lisboa*.jpg`, `warszawa*.jpg` |
| Litt sol igjen? | Málaga | `public/destinations/malaga*.jpg` |
| Finn hotell til en god pris | Barcelona, Roma | `public/destinations/barcelona*.jpg`, `rome*.jpg` |
| Finn en tur under X kr | Warszawa, London, Paris, Málaga | `public/destinations/<id>*.jpg` |

Skissene viste København, Porto og Gdańsk. Vi har ikke lisensierte bilder av
dem, og sandkassen har ikke utgående nett til Unsplash eller Pexels
(`curl` gir HTTP 000), så de kunne ikke hentes. Warszawa og Roma er brukt i
stedet, fra samlingen vi allerede har rett til. Skal København, Porto og
Gdańsk inn, må bildene lastes ned, beskjæres til `-256`/`-640` og føres inn i
registeret først.

Hotellkortene er reisemål, ikke navngitte hoteller: et bybilde ved siden av et
hotellnavn ville vært et bilde vi ikke har rett til å knytte til det hotellet.

## Verifisering

* `tsc -b`, `eslint .`, `vitest run` (384 tester, 49 filer), `vite build` – alle grønne.
* Forsiden gjennomgått på 360, 390, 430, 768 og 1440 px: ingen vannrett
  rulling, ingen innhold som stikker ut uten å bli klippet.
* 200 % tekststørrelse på 390 px: ingen tekst som forsvinner ut av skjermen.
  Rettelsene som skulle til: prisovervåkingskortet, seksjonsoverskriftene,
  «Litt sol igjen?»-banneret og pausefliser som nå brekker i stedet for å
  presse innholdet ut.
* Budsjett, flyplassvalg, tjenestefaner, lagreknapper og kartet er klikket
  gjennom med Playwright og gir de lenkene de sier de gir.
* Datoformatet «25.–28. sep.» var «25..–28. sep.» og er rettet i
  `formatDateRangeShort`.

Gjenstående funn: tre reine tekstlenker på 1440 px («Alle reisemål», «Se alle
reisemål», «Alle artikler») er 36 px høye. Det er over minstekravet for
pekerenheter, og de finnes ikke på telefon.

Skjermbilder ligger i arbeidsmappen for denne økten:
`home-shots/01-mobil-topp.png`, `02-mobil-fortsettelse.png`,
`03-mobil-hotell.png`, `04-desktop.png` og fullsidene `06-mobil-hele.png`,
`05-desktop-hele.png`.

## Avvik fra skissene, med begrunnelse

| Skissen | Bygget | Hvorfor |
|---------|--------|---------|
| «Fra 1 290 kr» på kortene | «Se flyreiser» | Ingen priskilde. Vi finner ikke på tall |
| København, Porto, Gdańsk | Warszawa, Roma | Ingen lisensierte bilder, og ingen nettilgang til å hente dem |
| Tre budsjettvalg på én linje | To på første linje, ett på andre | På 390 px får ikke tre plass. Strekker vi dem, ser det valgte ut som en hovedknapp |
| «Finn reisetilbud →» | «Finn reisen →» | Søkekortet er den godkjente produksjonskomponenten og er ikke rørt |

## Figma

Forsiden er også tegnet opp i Figma, fra koden – ikke omvendt:

**https://www.figma.com/design/mV44PmCN93PhNtJ6aspmjW** (side «Forside 5.0»)

| Ramme | Hva den viser |
|-------|----------------|
| `Forside – mobil 390` | Hele siden på telefon, fra logolinjen til bunnmenyen |
| `Forside – desktop 1440` | Toppmeny, tittel, kategorivalg, søkekort, budsjettpanel og helgeforslagene |
| `Om denne filen` | Kort notat om hva filen er og hva den ikke påstår |

Grunnlaget er hentet ut av koden, ikke gjenskapt på frihånd:

* Variabelsamlingen **HelloSky/Farge** har lyst og mørkt tema og speiler
  tokenene i `src/index.css` (`page`, `card`, `foreground`, `muted-foreground`,
  `border`, `primary`, `azure-ink`, `petrol`, `sea`, `forest`, `apricot`,
  `sunny-warm`, `lav-soft`, `mint`). Alle flater og all tekst er bundet til
  variabler, ikke til hex-verdier.
* Tekststilene er Manrope i de størrelsene forsiden faktisk rendrer
  (display 36/56, H2 24/30, H3 18, brødtekst 16, caption 13, micro 12), med
  linjehøyde og knipning fra `src/index.css`.
* Logoen er den godkjente `public/brand/hellosky-mark.svg`, importert som
  vektor. Den er ikke tegnet på nytt.

To ting filen med vilje ikke gjør:

* **Ingen priser på reisemålskortene.** Samme grunn som i koden – det finnes
  ingen priskilde. Kortene sier «Se flyreiser».
* **Fotorutene er plassholdere** med filnavnet på bildet som hører hjemme der
  (`public/destinations/lisboa-640.jpg` og så videre). Nettverkspolicyen i
  byggemiljøet avviser opplasting til `mcp.figma.com`, så bildebytes kunne
  ikke sendes inn. Bildene dras inn manuelt, eller lastes opp fra en maskin
  med nettilgang; rutene er allerede i riktig størrelse og navngitt.
