# HelloSky-opptur: revisjon før endring

Dette er utgangspunktet, skrevet ned før noe ble rørt, slik at «bedre» kan
måles og ikke bare påstås.

## Hvordan produktet ble inspisert

hellosky.no er **ikke tilgjengelig fra dette byggemiljøet** – utgående proxy
avviser domenet (`CONNECT tunnel failed, 403`), både for curl og WebFetch.
Inspeksjonen er derfor gjort på den nøyaktige commiten som står i produksjon
(`628bb0c`), bygget og kjørt lokalt, med KAYAK-stubben som leverandør.
Samme kode, samme bygg, samme leverandørform – men si fra hvis noe på den
ekte siden ser annerledes ut enn det som står her.

Sider inspisert på 390, 430, 820 og 1440 px: forside, flyresultater, utforsk,
hotell, reisemålsside, innlogging, profil, lagret, 404.

Ingen vannrett rulling noe sted. Ingen JS-feil. 404 svarer med ekte 404.

## FREDET UI – ikke rør uten en klar forbedring

Dette er allerede sterkt og skal ikke bygges om:

| Del | Hvorfor den er fredet |
|-----|------------------------|
| Toppmenyen (desktop) og bunnmenyen (mobil) | Tydelig hierarki, kjent plassering, god kontrast |
| Den godkjente logoen og den blå identiteten | Merkevaren. Røres ikke |
| Søkekortet på forsiden | Godkjent, fungerer, er hovedhandlingen |
| Den marineblå resultatheaderen | Rute, datoer, reisende, «Endre søk», prisvarsel og sandkassemerke på ett sted |
| Sorteringsfanene med ekte priser | Viser hva valget koster før du tar det |
| Sidemenyens rangeringsintensjoner på desktop | «Ekstra bagasje», «Familievennlig», «Korte mellomlandinger» med pris, tid og selskap – dette er en ekte HelloSky-forskjell |
| Det kompakte flykortets rutenett | Begge strekninger leses med samme oppsett, nedover en liste |
| Ærlighetslinjene | «Testdata fra KAYAK sandbox», «Totalpris for 1 voksen», «må oppdateres om ca. X min», «Vi lagrer ingen priser» |
| Detaljarket | Fullstendige segmenter, mellomlanding, bagasje, vilkår, Escape/tilbake lukker |
| «Kort fortalt» på reisemålssiden | Ryddig faktatabell uten pynt |
| 404-siden | Riktig statuskode, rolig, én handling |
| Forsidens oppdagelsesseksjoner | Nettopp godkjent og deployet |

## Funn, prioritert

### P1 – ekte produktproblemer

**1. Samme reise vises som flere kort.**
Søket Oslo→London gir 8 «alternativer», men bare 5 faktiske reiser. Norwegian
07:00–09:15 ligger der to ganger: én gang solgt av Norwegian (2 580 kr), én
gang av Kiwi.com (2 620 kr). Identisk rute, identiske tider, identisk bagasje.
Det er leverandørlisten som lekker ut i grensesnittet, og det er nøyaktig det
som får en sammenligning til å føles som en API-demo. Reisen er enheten
brukeren sammenligner – ikke salgskanalen.

**2. Prisen er ikke det øyet ser først.**
Avgangstidene er like store og like fete som prisen. Briefen er utvetydig:
pris først, så tider. I dag konkurrerer de.

**3. Flyselskapet er en grå bokstavkode.**
Uten logo fra leverandøren faller kortet tilbake til «DY» i grått på grått.
KAYAK-sandkassen – som er det produksjon kjører på nå – sender
«Not available in Sandbox» der logoen skulle vært, så dette er det ekte
produksjonsbildet, ikke en lokal artefakt.

**4. Tomrom på desktop.**
På 1440 px strekkes reiselinjen mellom avgang og ankomst over ~700 px. Kortet
blir luftig på feil måte: mye plass, lite informasjon.

**5. Reisemålssidens ingress er uleselig.**
«Trikker og utsiktspunkter» står i grått oppå et travelt fotografi, under en
gradient som ikke rekker langt nok. Kontrastbrudd.

### P2 – reell forbedring

**6. Ingen server-rendret innhold.** `<div id="root">` er tom i HTML-en.
Meta, canonical, og:-tagger og sitemap injiseres riktig på serveren, men ingen
crawler uten JS ser et eneste ord. For innholdssidene – reisemål, journal,
juridisk – finnes teksten allerede lokalt og kan rendres på serveren uten å
røre søkeappen.

**7. Ingen rutesider.** `/fly/oslo-london` finnes ikke. Det er den mest
åpenbare organiske inngangen til et flysøk.

**8. Dobbel sorteringskontroll på desktop.** Fanene på toppen og listen i
sidemenyen styrer det samme.

**9. 404 lenker ikke videre.** Riktig svar, men en blindvei.

### P3 – finpuss

**10.** Filterraden på mobil kuttes midt i et ord ved høyre kant.
**11.** Tjenestefanene (Fly/Hotell/Leiebil/Cruise) tar plass øverst på
resultatsiden, over det brukeren kom for.

## Arkitektur: det som allerede er riktig

`api/lib/flightProviders.ts` er allerede den abstraksjonen briefen ber om: ett
`FlightProvider`-grensesnitt, én adapter per leverandør (Duffel, Travelport,
KAYAK, demo), normalisert `SearchResult` ut, og `resolveProviders` som ren,
testet funksjon. Ingen leverandørfelt lekker til frontend. **Dette skal ikke
skrives om.** Det som mangler er ikke abstraksjonen, men to ting over den:
gruppering av like reiser, og – den dagen flere leverandører er live samtidig
– parallelle kall med sammenslåing.
