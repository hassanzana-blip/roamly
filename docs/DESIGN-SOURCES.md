# HelloSky 3.0 – design system, libraries and asset sources

The customer-facing redesign (ivory · burgundy · coral) is implemented directly
from the supplied mockups. There is no Figma file behind them.

## Libraries actually used

| Purpose | Library | Notes |
|---|---|---|
| UI foundations | shadcn/ui on Radix (`src/components/ui`) | Button, Sheet, Popover, Calendar (react-day-picker), Checkbox, Slider, ToggleGroup (`Segmented`), Collapsible, Dropdown. Restyled with the token set in `src/index.css`. |
| Icons | lucide-react | One family, 1.5 px strokes; sizes via `components/app/Icon.tsx` (14/16/20/24/28). Airline marks come from the provider (`AirlineLogo`), never from an icon set. |
| Typography | `@fontsource-variable/outfit` (public), `@fontsource-variable/manrope` (admin, fallback) | Variable fonts: one file per family covers the 400–600 weights in use. Outfit was chosen after a rendered side-by-side against the mockups (single-storey «a», geometric bowls); Manrope is kept for the admin. |
| Motion | `motion` (motion/react) | Search-card switch on the home screen; honours `prefers-reduced-motion`. Press feedback is CSS (`active:scale`). |
| Map | `maplibre-gl` + OpenFreeMap `positron` style | Renderer: MapLibre GL JS. Data/tiles/glyphs/sprites: https://tiles.openfreemap.org (no key). Attribution (OpenFreeMap · OpenMapTiles · OpenStreetMap contributors) is rendered by the map's attribution control. CSP `connect-src` allows the host (`api/boot.ts`). |
| Map fallback | `world-atlas` (Natural Earth, public domain), `topojson-client`, `d3-geo` | `StaticDiscoveryMap`: an SVG map used only if the tile style cannot be fetched, so the section never shows an empty box. |

## Coordinates and prices on the map

Pins use the airport coordinates in `contracts/airports.ts` (curated, verified)
and the live «fra»-price from `flights.priceHints` for one adult, one way,
from Oslo. Where no price exists the pin shows the city name only.

## Photography

* Destination photos: local, optimised files in `public/destinations/*` (1024 / 640 / 256
  variants), sourced under the Unsplash and Pexels licences and checked by a
  person to show the actual place. The registry and credits page live in
  `src/content/photos.ts` and `/fotokreditering`.
* Hotel photos: only the property's own images as delivered by the provider
  (KAYAK `images[]`). Without provider images a neutral placeholder is shown.
* Airline logos: provider-delivered brand assets; IATA monogram as fallback.
* The mockups' Mallorca, Lisboa (bougainvillea), Roma and København frames are
  layout references. Mallorca and København are not yet in the destination
  registry; adding them requires fetching and checking new photographs, which
  could not be done from the build environment (unsplash.com is not reachable).

## Tokens

`src/index.css` `:root` holds the public palette: ivory `#F6F3EB`, burgundy
`#451B23`, coral `#D03A40` (the brand `#D84348` nudged 3 % darker so white text
passes WCAG AA at 4.8:1), coral ink `#B8343A` for coral text on ivory, blush
`#F4E4E1`. Admin keeps its lime system under `[data-theme="admin"]`.
