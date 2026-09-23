# Editable HelloSky specification

[Figma file](https://www.figma.com/design/YE2XDmrOTFY8dRFiarPxSz).

This documents the implemented charcoal/white/HelloSky-blue direction. It is not a new concept and is not evidence of native iOS execution.

- [Home, results, details](https://www.figma.com/design/YE2XDmrOTFY8dRFiarPxSz?node-id=22-151): three editable 393 × 852 frames based on app `dad15c4`, with 25 component instances and the bundled destination photography.
- [Airport, filters, dates](https://www.figma.com/design/YE2XDmrOTFY8dRFiarPxSz?node-id=28-216): three editable companion frames based on existing picker/filter code. The filters explicitly use one isolated `SEK_OFFER` fixture. Native date controls are schematic and require iOS verification.
- Library: 76 variables, 18 text styles, nine component families with 28 variants, one destination-card component and three swappable SVG icon components. Input placeholder is exposed as a text property.
- Shared colors, spacing and native typography are sourced from `src/lib/theme.ts`. Figma uses a documented Inter fallback because its renderer returned unusable SF Pro text. The app retains iOS system typography; no Apple font files were downloaded or redistributed.
- Related content uses Auto Layout; panels are editable layers, not flattened screenshots. Safe-area space is shown without drawing device chrome.

Still open: adaptive long-seller/large-text variants, dedicated loading/error/baggage/seller components, full filter-scroll specification, native keyboard/calendar/VoiceOver testing, photo-source attribution, and coherent prototype wiring. Main and companion frames use different labelled fixtures, so they are not linked as though they form one stateful search.

Use the actual app's `DESIGN.md` and `docs/evidence/MANIFEST.md` for newer implementation changes and fixture provenance. The `00d18db` accessibility/edge pass is under review and must not be described as completely synchronized to these normal-text Figma specimens.
