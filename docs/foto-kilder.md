# Fotokilder for de godkjente designene

Regelen er uendret: ekte fotografi, lisenstrygt, kontrollert av et menneske
mot stedet det viser. Ingen AI-genererte bilder. Skissene brukte Lisboa,
Siena, Monterosso og et hotellrom som eksempler; i produksjon vises alltid
bildet til det reisemålet kontoen eller registeret faktisk peker på.

## Bilder i bruk

| Skjerm | Bilde | Fil | Kilde og lisens | Kreditering |
|--------|-------|-----|-----------------|-------------|
| 1, 6 – reiseplankort | Reisemålets registerbilde (f.eks. `lisboa`) | `public/destinations/<id>.jpg` (+ `-256`, `-640`) | Unsplash-/Pexels-lisens, registrert i `src/content/photos.ts` | Vises på `/fotokreditering` |
| 3 – innlegg og gruppeforside | Reisemålet innlegget/gruppen peker på | `public/destinations/<id>.jpg` | som over | som over |
| 4 – hovedkort og bikort | Første og andre reisemål for valgt tempo | `public/destinations/<id>.jpg` | som over | som over |
| 5 – hotellandingsside | Hotellterrasse med utsikt | `public/photos/hotel-terrace.jpg` (+ `-640`) | Unsplash-lisens, `OTHER_CREDITS` i `src/content/photos.ts` | `/fotokreditering` |

Ingen nye bildefiler er lagt til i dette arbeidet, og ingenting er kjøpt.

## Kandidater som ble vurdert, men ikke lastet ned

Skissene viste Siena, Monterosso og et lyst hotellrom. Disse Unsplash-bildene
ble kontrollert visuelt og passer om Siena/Monterosso senere legges inn i
registeret, eller om hotellbildet skal byttes. De må lastes ned og
optimaliseres lokalt (`scripts/` har mønsteret for `-256`/`-640`-varianter)
før bruk; sandkassen kunne ikke hente bildefiler.

| Motiv | Fotograf | Unsplash-id | Lenke | Lisens |
|-------|----------|-------------|-------|--------|
| Siena sett ovenfra (Toscana) | Cristina Gottardi (@cristina_gottardi) | `photo-1490349858727-b25c13b324a0` | https://unsplash.com/photos/qf2Lg1ZtxDc | Unsplash-lisens |
| Siena, gate og tårn | Pedro Lastra (@peterlaster) | `photo-1478135361625-613b3835d0a6` | https://unsplash.com/photos/N--5R-Jypdw | Unsplash-lisens |
| Monterosso al Mare, strand og klipper | Daniel Rickard (@danrickard) | `photo-1670389347432-f7be6e574a0c` | https://unsplash.com/photos/QA0iSOnR_g4 | Unsplash-lisens |
| Lyst hotellrom med seng og vindu | Andrew Neel (@andrewtneel) | `photo-1549638441-b787d2e11f14` | https://unsplash.com/photos/B4rEJ09-Puo | Unsplash-lisens |

Unsplash-lisensen krever ikke kreditering, men vi krediterer likevel på
`/fotokreditering` når et bilde tas i bruk.
