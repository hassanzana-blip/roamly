# Prisjakt: resultatlisten, detaljene og forsiden

Arbeidet følger to godkjente skisser: den kompakte sammenligningen av
flyresultater og arket med reisedetaljer. Denne filen sier hva som ble bygget,
hva som bevisst avviker fra skissene, og hva vi ikke kan bygge ennå fordi
dataene ikke finnes.

## Resultatlisten (`/sok`)

- **Toppen** er marineblå med ruten, datoene, reisefølget og «Endre søk». Den
  ruller bort når man begynner å lese; én klebrig linje overtar med ruten i
  kortform, fanene og filtrene. Siden har bare denne ene klebrige linjen.
- **Fanene** er Anbefalt, Billigst og Raskest (Familievennlig kommer i tillegg
  når det reiser barn). Hver fane viser prisen på det tilbudet som faktisk
  vinner kategorien, regnet fra det filtrerte utvalget – prisen finnes alltid
  på et kort man kan trykke på. «Anbefalt» bruker rangeringen i
  `src/lib/offers.ts`; ingen oppdiktet poengsum.
- **Filtrene** er fem kompakte kontroller: Filtrer (hele arket), Stopp,
  Bagasje, Tider og Flyselskap. Sorteringen for øvrig ligger øverst i
  filterarket.
- **Kortet** (`src/components/offers/ResultCard.tsx`) er ~263 px for tur-retur
  og ~197 px for én vei ved 390 px bredde. Hver strekning bruker samme tre
  kolonner: avgang, reiselengde med stopp, ankomst. Ett anbefalingsmerke per
  kort; advarsler (flyplassbytte, selvtransfer, nattlig eller langt opphold)
  vises alltid i tillegg.

Fjernet: store flyselskapsoverskrifter, dekorative fly, gjentatte
stopp-etiketter, lange bagasjeavsnitt, rader med merkelapper og «Via
reisebyrå» når selgeren allerede står ved prisen. «Lagre», «Sammenlign» og
«Del» er flyttet inn i detaljarket, der det er plass til dem.

## Reisedetaljer

`src/components/offers/OfferDetailsSheet.tsx` – ark fra bunnen på telefon,
dialog på skrivebord. Full dato per strekning, hvert flyvende ledd med
flynummer, flytype og klasse, hvem som faktisk flyr det, mellomlandingens
lengde og sted, advarsel ved flyplassbytte og selvtransfer, bagasje med de
tallene leverandøren faktisk oppga, vilkår, selger og hva prisen omfatter.
Prisen og veien videre står fast i bunnen.

Tilgjengelighet: kryss, Escape, klikk utenfor og nettleserens tilbakeknapp
lukker arket; fokus flyttes inn og tilbake til «Detaljer»-knappen; bakgrunnen
er låst for rulling; ingen informasjon finnes bare ved peker.

## Forsiden

`src/components/home/PriceFinder.tsx` ligger rett under det godkjente søket.
Kontrollene er ekte: avreisested, reisemål, når (neste helg / om en måned / om
tre måneder), antall netter, totalbudsjett, bare direktefly og innsjekket
bagasje. Budsjettet blir `maxpris` i lenken og settes som pristak i
resultatene; bagasjekravet blir `bagasje=1` og filtrerer. Datoene som faktisk
søkes vises før man trykker.

## Data og ærlighet

- **Bagasje** skilles i håndbagasje, innsjekket og «ikke oppgitt». Ukjent blir
  aldri «inkludert» og aldri «ikke inkludert».
- **Gebyrer** fra leverandøren («NOK 450», «NOK58.0») skrives om til norsk med
  `formatSupplierMoney`. Lar den seg ikke lese trygt, viser vi ingenting.
- **Sandkasseplassholdere** fra KAYAK («Not available in Sandbox») filtreres
  bort i `api/lib/kayak.ts`, slik at de aldri kan rendres som en logo eller et
  selskapsnavn. Uten logo vises et rent IATA-monogram.
- **Gyldighet**: teksten sier nå «Hentet nå · må oppdateres om ca. N min».
  Leverandørens `expiresAt` er en utløpsfrist for tilbudet, ikke en garanti om
  prisen, og skal ikke leses som et løfte.
- **Hotell**: totalprisen for oppholdet står størst, med netter, rom og gjester
  under, og nattprisen som sekundær linje. Vurderingen oppgir kilden.

## Det vi ikke kan bygge ennå

`flights.priceHints` returnerer `null` for alle datoer: ingen leverandør vi er
koblet til gir dagspriser eller «fra»-priser uten et fullt søk per dato.
Derfor finnes det ikke:

- priskalender med tall (kalenderen viser «Søk», ikke en pris),
- «fra»-priser på reisemålskort,
- budsjettsøk mot «hvor som helst»,
- prisvarsler i produksjon (skjemaet vises bare i demomodus).

Alt dette krever enten en leverandør med et pris-API for datointervaller, eller
at vi selv bygger et prislager som søker og lagrer priser over tid. Til det er
på plass viser vi ingen tall vi ikke har hentet.
