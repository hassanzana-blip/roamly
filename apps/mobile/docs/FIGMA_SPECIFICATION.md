# Editable HelloSky specification

[Figma file](https://www.figma.com/design/YE2XDmrOTFY8dRFiarPxSz).

This documents the implemented charcoal/white/HelloSky-blue direction. It is not a new concept and is not evidence of native iOS execution.

- [Home, results, details](https://www.figma.com/design/YE2XDmrOTFY8dRFiarPxSz?node-id=22-151): three editable 393 × 852 frames based on app `dad15c4`, with 25 component instances and the bundled destination photography.
- [Airport, filters, dates](https://www.figma.com/design/YE2XDmrOTFY8dRFiarPxSz?node-id=28-216): three editable companion frames based on existing picker/filter code. The filters explicitly use one isolated `SEK_OFFER` fixture. Native date controls are schematic and require iOS verification.
- [Empty and loading states](https://www.figma.com/design/YE2XDmrOTFY8dRFiarPxSz?node-id=33-218): four editable StateView variants, dark/light and busy/idle, derived from `ui.tsx`. Title/body are required caller properties; body visibility and icon swapping are exposed. Native ActivityIndicator is schematic. Action buttons belong in the parent action wrapper, as in code.
- [Seller choice and baggage](https://www.figma.com/design/YE2XDmrOTFY8dRFiarPxSz?node-id=37-490): four SellerOfferRow variants (selected/unselected, price right/below) match the reviewed `be41be4` implementation. Six baggage variants document included, excluded and unknown facts for cabin/checked bags. Title, Value and Icon are required caller properties, as in the native InfoRow; examples explicitly set them and never imply default baggage allowances.
- [Inline banners](https://www.figma.com/design/YE2XDmrOTFY8dRFiarPxSz?node-id=39-375): six light/dark information, warning and error variants, with editable caller-provided messages, source icons and semantic colors. Actions remain separate. The dark error color is sourced from the existing `ui.tsx` literal, not invented as a new app theme value.
- Library: 78 variables, 18 text styles, thirteen component families with 48 variants, one destination-card component and eight SVG icon components. Input placeholder is exposed as a text property.
- Shared colors, spacing and native typography are sourced from `src/lib/theme.ts`. Figma uses a documented Inter fallback because its renderer returned unusable SF Pro text. The app retains iOS system typography; no Apple font files were downloaded or redistributed.
- Related content uses Auto Layout; panels are editable layers, not flattened screenshots. Safe-area space is shown without drawing device chrome.

The seller component documents the two adaptive price placements. In code, measured name wrapping or text-column width below 80 × fontScale moves the price below. Layout state survives tab changes and remeasures on fontScale changes. Figma does not execute those measurements. All new visible component fills/strokes are variable-bound; reviewed screenshots show no clipping. Value widths and baggage icon overrides were corrected after the first visual review.

Still open: full large-text screen specimens, full filter-scroll specification, native keyboard/calendar/VoiceOver testing, photo-source attribution, and coherent prototype wiring. Main and companion frames use different labelled fixtures, so they are not linked as though they form one stateful search.

Use the actual app's `DESIGN.md` and `docs/evidence/MANIFEST.md` for newer implementation changes and fixture provenance. The main screens remain normal-text specimens from `dad15c4`; new component boards describe `be41be4`. Neither proves native rendering or the newer search/expiry work in progress.
