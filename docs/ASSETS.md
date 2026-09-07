# HelloSky asset registry

Every visual has a job. Medium is chosen per asset: photo, vector glyph, UI icon, data diagram, spot illustration, motion, or an official brand asset. Nothing is invented: baggage counts, stops, layovers, cabin class and booking states are rendered from supplier and order data only.

Source of truth for vectors is the official HelloSky SVG pack (`public/icons/*.svg`, sprite `public/icons/sprite.svg`, catalogue `docs/reference/hellosky-svg-pack/hellosky-svg-library.svg`): 44 true 24×24 outline icons, 1.8 stroke, round caps and joins, `currentColor` ink, lime `#C4F71D` on one selective accent. `scripts/svg-pack-to-tsx.mjs` regenerates `src/components/graphics/pack/index.tsx` (components `Hs*`, lime mapped to `hsl(var(--primary))`, grey to `hsl(var(--muted-foreground))`) and `pack/manifest.json`. App-level glyphs in `src/components/graphics/` re-export pack shapes under their product names and add custom outlines in the same language only where the pack has no shape. The live sheet is at `/utvikler/ikoner` (noindex); the earlier raster sheet `docs/reference/hellosky-icon-sheet.png` is kept for history.

| Asset | Type | Use | Source | Variants | Alt / label | Dynamic |
| --- | --- | --- | --- | --- | --- | --- |
| `Glyph` | base component | every custom glyph | custom (`Glyph.tsx`) | 16/20/24 px | via `title` | no |
| `PersonalItemGlyph` | SVG glyph (pack) | fare and baggage rows | custom (`Baggage.tsx`) | 16–24 px | label from `BaggageVisual` | no |
| `CabinBagGlyph` | SVG glyph | offer card, checkout extras | custom | 16–24 px | `bg.carryon` | no |
| `CheckedBagGlyph` | SVG glyph | offer card, checkout extras | custom | 16–24 px | `bg.checked` | no |
| `HeavyBagGlyph` | SVG glyph | ready for weight-based allowances | custom | 16–24 px | supplier label | no |
| `MultipleBagsGlyph`, `StrollerGlyph`, `SportsEquipmentGlyph`, `WheelchairGlyph` | SVG glyph | special baggage when supplier data exists | HelloSky pack | 16–32 px | supplier label | no |
| `InstrumentGlyph`, `PetCarrierGlyph` | SVG glyph | special baggage when supplier data exists | custom, pack style | 16–32 px | supplier label | no |
| `BaggageVisual` | data diagram | repeats bag glyph × count, struck through when 0 | custom | 16–24 px | full sentence via `label` | yes (offer.baggage) |
| `TakeoffGlyph`, `LandingGlyph`, `DirectRouteGlyph`, `ConnectingRouteGlyph`, `OvernightGlyph`, `AircraftChangeGlyph`, `AirportChangeGlyph`, `RoutePinsGlyph` | SVG glyph | filters, warnings, itineraries | HelloSky pack (`Aircraft.tsx`) | 16–32 px | text label | no |
| `AircraftSideGlyph`, `TransferRoadGlyph`, `AirportGlyph`, `TerminalGlyph`, `GlobeGlyph` | SVG glyph | itineraries, discovery | custom, pack style | 16–32 px | text label | no |
| `PlaneTakeoff`, `PlaneLanding` | UI icon | airport fields | Lucide | any | field label | no |
| `RouteDiagram` | data diagram + motion | flight details, My Trip | custom (`Route.tsx`) | fluid | IATA labels, layover text | yes (slice.segments) |
| `AirportChangeDiagram` | data diagram | self-transfer warning | custom | fluid | `rt.airportchange` | yes |
| `SeatGlyph` (available/selected/unavailable/extra-legroom/preferred) | SVG glyph | seat maps when API data exists | HelloSky pack (`Seats.tsx`; preferred is custom) | 16–32 px | state label | yes |
| `SeatPositionGlyph`, `SeatsTogetherGlyph` | SVG glyph | window/aisle position, family seating | HelloSky pack | 16–32 px | text label | no |
| `BassinetGlyph` | SVG glyph | infant bassinet | custom, pack style | 16–32 px | text label | no |
| `CabinClassGlyph` | SVG glyph | cabin picker, offer header | pack seat + custom pitch marks | 20–28 px | `cabinLabel()` | yes (cabinClass) |
| `AdultGlyph`, `ChildGlyph`, `InfantGlyph`, `FamilyGlyph`, `AssistanceGlyph` | SVG pictogram | passenger picker, party summary, assistance requests | HelloSky pack (`Family.tsx`) | 20–32 px | passenger type | no |
| `SeniorGlyph`, `GroupGlyph`, `UnaccompaniedMinorGlyph`, `PetGlyph`, `AddTravellerGlyph` | SVG pictogram | ready for special requests | custom, pack style | 20–32 px | text label | no |
| `PartyPictogram` | data diagram | family total context | custom | 20 px | `common.pax` | yes (passengers) |
| `PassportGlyph`, `BoardingPassGlyph` | SVG glyph | travel documents | HelloSky pack (`Documents.tsx`) | 16–24 px | text label | no |
| `VisaStampGlyph`, `LuggageTagGlyph` | SVG glyph | destination visa notes, bag tags | custom, pack style | 16–24 px | text label | no |
| `AMENITY_ICONS`, `TRANSPORT_ICONS`, `HOTEL_ICONS`, `TRUST_ICONS`, `DOCUMENT_ICONS` | icon maps | render only keys with real data | HelloSky pack (wifi, power, meal, entertainment, car, taxi, train, bus, secure payment, confirmation, support) + Lucide (`Icons.tsx`) | any | key label | yes |
| `BookingTimeline` + `timelineFor` | data diagram | confirmation, My Trip | custom (`Status.tsx`, `timeline.ts`) | fluid | `tl.*` | yes (order state) |
| `StatusGlyph` (booked / ticket / processing / change / cancelled / refund) | SVG glyph | status lists, admin, My Trip | HelloSky pack (`StatusGlyphs.tsx`) | 20–32 px | state label | yes |
| `public/icons/*.svg` + `sprite.svg` (44) | SVG source | pack files, also usable as `<img>` or `<use href="/icons/sprite.svg#…">` | HelloSky SVG pack v1 (brand asset, provided by HelloSky) | 24 grid | per-file `<title>` | no |
| `docs/reference/hellosky-svg-pack/` | reference | pack README and catalogue sheet | HelloSky | | | |
| `docs/reference/hellosky-icon-sheet.png` | reference | earlier raster sheet, history only | HelloSky | | | |
| `NoFlightsSpot`, `SearchExpiredSpot`, `PaymentFailedSpot`, `BookingFailedSpot`, `ConnectionProblemSpot`, `NoSavedSpot`, `NoHotelsSpot`, `NoTripsSpot`, `NoNotificationsSpot`, `EmptyTableSpot` | spot illustration | empty and error states | custom (`Illustrations.tsx`) | 128×96 | `title` prop | no |
| `ConfirmationMark` | motion SVG | booking confirmation | custom (`Checkmark.tsx`), Motion | 96 px | `title` prop | no |
| `SkeletonFlightCard`, `SkeletonDestinationCard` | loading | results, discovery | custom (`Skeletons.tsx`) | fluid | aria-hidden | no |
| `.plane-fly`, `.route-dash` | CSS motion | search in progress | `src/index.css` | n/a | text status beside it | no |
| `SkyMark` | brand mark | header, footer, admin | custom from logo (`brand/SkyMark.tsx`) | 24–32 px | decorative | no |
| `/brand/klarna.jpg`, `/brand/vipps.jpg` | official brand asset | payment methods | provider brand files (existing) | 70×28 | brand name | no |
| Visa, Mastercard, Apple Pay, Google Pay logos | official brand asset | payment section | **not added**: fetch official packs from the provider brand centres, never AI-generate | | | |
| Airline logos | official asset | offer header | **not available in offer data** (Duffel `Carrier` mapped without logo URL); shows IATA initials until `logo_symbol_url` is mapped | | airline name | yes |
| Flags | open-source set | not used yet | `flag-icons` (MIT) available on npm if country flags are needed | | | |
| `/destinations/*.jpg` (+`-640`) | photography | destination cards | Unsplash/Pexels licence, manually verified real places (existing) | 1024 / 640 | `imageAlt` | no |
| `arrivals-reunion-osl` | Higgsfield photo (nano_banana_2, 2k, 3:2) | home hero candidate | generated 2026-09-07, job `2a9cb25e…` | fetch via `scripts/fetch-photos.mjs` | "Familie møter besteforeldre i ankomsthallen" | no |
| `gate-family-itinerary` | Higgsfield photo | support page / My Trip hero | job `0449685e…` | same | "Mor og to barn ser på reiseruten ved gaten" | no |
| `rental-car-luggage` | Higgsfield photo | car rental | job `1d592a67…` | same | "Far løfter koffert inn i leiebil" | no |
| `hotel-arrival-couple` (4:3) | Higgsfield photo | hotel | job `eb44daa1…` | same | "Par ankommer hotell med kofferter" | no |
| `checkin-family-stroller` | Higgsfield photo | family/baggage explainer | job `4e583b88…` | same | "Familie med barnevogn ved innsjekking" | no |
| `gate-solo-dawn` | Higgsfield photo | flight status / empty state | job `bb5a0a73…` | same | "Alene ved gaten i morgenlys" | no |
| `arrivals-reunion-ebl` | Higgsfield photo | destinations (Kurdistan) | job `51df3e6e…` | same | "Gjensyn i ankomsthallen i Erbil" | no |
| `luggage-lineup` | Higgsfield photo | baggage rules page | job `522e7354…` | same | "Familiens bagasje klar i gangen" | no |
| `asmara-harnet-avenue` | Higgsfield photo | Asmara destination card (had no photo) | job `d8147813…` | same | "Harnet Avenue i Asmara" | no |
| cabin boarding photo | Higgsfield photo | (job failed, not registered) | | | | |

## Rules

- Photos are reviewed by a person before use; anything that reads as generated is rejected.
- No overlays or pills on photographs. Captions go under the image.
- Baggage weight is shown only when the supplier provides it; counts otherwise.
- Seat maps render from API data with `SeatGlyph`, never from a bitmap.
- Amenities render only for keys present in supplier data.
