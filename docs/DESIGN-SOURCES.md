# HelloSky 4.0 – design system, libraries and asset sources

The customer-facing redesign (deep petrol · azure · pale mint · soft lavender ·
white) is implemented directly from five supplied mobile references (home,
destination search, flight results, hotel details, saved collection). There is
no Figma file behind them; nothing was imported from Figma and no pixel
matching against a Figma source is claimed. The admin (`/admin/*`) keeps its own
visual system untouched (`[data-theme="admin"]` in `src/index.css`).

## Libraries actually used

| Purpose | Library | Licence | Notes |
|---|---|---|---|
| UI foundations | shadcn/ui on Radix (`src/components/ui`) | MIT | Button, Sheet (bottom sheets and the full-screen destination picker), Popover, Dropdown (trip type), Collapsible (details, fees), Calendar (react-day-picker), Checkbox, Slider, ToggleGroup (`Segmented`). Restyled with the tokens in `src/index.css`. |
| Icons | lucide-react | ISC | One family, 2 px strokes, 24 px in navigation and rows, 20 px inline; sizes via `components/app/Icon.tsx`. Airline marks are never icons (see below). |
| Typography | `@fontsource-variable/manrope` | OFL 1.1 | The project already shipped Manrope (admin). Its double-storey «a», open bowls and firm bold match the references, so it is now the single customer-facing family too. Outfit (3.0) was removed. |
| Motion | `motion` (motion/react) | MIT | Search-card switch on the home screen; honours `prefers-reduced-motion`. Press feedback is CSS. |
| Map (desktop discovery) | `maplibre-gl` + OpenFreeMap `positron` style | BSD-3 / ODbL data | Unchanged from 3.0; attribution rendered by the map control. |
| Map fallback | `world-atlas` (Natural Earth, public domain), `topojson-client`, `d3-geo` | ISC / BSD-3 | SVG fallback when tiles cannot be fetched. |
| Testing | Playwright, `@axe-core/playwright`, vitest | Apache-2 / MPL-2 / MIT | Screens at 360/390/430/768/1440, flows (save, note, picker), axe WCAG 2.1 AA: 0 violations on the five screens. |

Not used: Vaul (Radix Dialog covers the sheets), Google Fonts at runtime (fonts
are self-hosted through fontsource), Unsplash API (no network to unsplash.com
from the build environment; see photography), Figma Community files.

## Tokens (`src/index.css` `:root`)

| Token | Value | Use |
|---|---|---|
| Deep petrol | `#123B46` hsl(193 59% 17%) | Brand, text, navigation, «Hvor som helst» card, sort/filter text. 12.1:1 on white. |
| Azure | `#1265EA` hsl(217 86% 49%) | Primary actions («Finn reisen», «Se tilbud», «Se rom»), links. White on azure 5.2:1. As *text* on mint/lavender we use azure ink hsl(217 86% 45%) (≥ 5.5:1). |
| Pale mint | `#E6F1EC` hsl(153 28% 92%) | Search area, results header, stay summary, «Direkte» pill. |
| Soft lavender | `#EDE9F5` hsl(260 38% 94%) | «Fortsett søket», booking note, rooms row, trip note, save confirmations. |
| Burnt coral | `#C45B43` hsl(11 52% 52%) | Restrained accents. As a surface with white text (theme chip) and as text (hotel eyebrow) it is darkened to hsl(11 55% 45%), 5.3:1. |
| White | `#FFFFFF` | Every surface, cards, bottom navigation. |
| Neutrals | petrol-tinted greys (border hsl(195 20% 89%), muted text hsl(198 14% 38%)) | Hairlines, secondary text (≥ 5.5:1 on white). |

Shape: controls 12 px, cards 16 px, one hairline, no shadows. Type: body 16,
secondary 14–15, nav labels 13, headings 24–36 on a phone (`.t-h2`, `.t-h1`,
`.t-display`). Hit areas ≥ 48 px, main buttons 52 px, page gutter 20 px.

## Photography and rights

* **Destination photos** (`public/destinations/*`, 1024/640/256 variants) were
  sourced in 3.0 under the Unsplash and Pexels licences and checked by a person
  to show the actual place. Credits: `src/content/photos.ts` and
  `/fotokreditering`. They are reused for the home header, the editorial card,
  the destination picker thumbnails and the saved-collection header.
* **Substitution, disclosed:** the reference home header and collection header
  show Lisbon from above (Tejo, the 25 de Abril bridge). The only Lisbon
  photograph we hold rights to locally is the yellow tram (`lisboa.jpg`), so
  that is used. Fetching a new licensed photograph was not possible from the
  build environment (unsplash.com unreachable). Replace by adding a checked
  file to `public/destinations` and a credit in `photos.ts`.
* **Hotel photos:** only the property's own images as delivered by the
  provider (KAYAK `images[]`), `object-fit: cover`, with a neutral placeholder
  when none exist. The reference's «Casa do Tejo» is an illustration and is not
  reproduced; local screenshots use the sandbox stub's placeholder images.
* **Airline logos:** provider-delivered brand assets (`AirlineLogo`,
  `object-fit: contain`, never stretched), with an IATA monogram as the honest
  fallback. The references' Norwegian and KLM wordmarks are not bundled; in
  production the KAYAK response supplies each carrier's own logo.
* No emoji, gradients (beyond photo readability washes), fake reviews or
  invented ratings. Ratings shown on hotels are the provider's own.

## Data honesty in the five screens

* Flight prices, times, baggage lines and provider names come from the live
  search response. Baggage is «ikke oppgitt» / «detaljer hos leverandøren» when
  the provider does not state it – never assumed included.
* Sandbox results are labelled («Testdata») in the results header, above the
  first card, on the hotel eyebrow and in the saved hotel row.
* The saved collection lives in `localStorage` (`src/lib/collections.ts`) and
  says «Lagret i denne nettleseren». No cross-device sync is claimed. Sharing
  uses the Web Share API with a clipboard fallback and shares text only; there
  is no persisted collection route, so no shareable link is offered.
* «Hvor som helst» leads to the real destination browser (`/utforsk`); it does
  not run a fabricated «anywhere» search.
* Cruise has no provider; the tab leads to an honest availability page.
