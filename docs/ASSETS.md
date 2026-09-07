# HelloSky asset registry

Every visual has a job. Medium is chosen per asset: photo, vector glyph, UI icon, data diagram, spot illustration, motion, or an official brand asset. Nothing is invented: baggage counts, stops, layovers, cabin class and booking states are rendered from supplier and order data only.

Style for all custom vectors: 24-unit grid, 1.75 stroke, round caps and joins, `currentColor`, ink and neutral greys, lime only for the selected or destination point. Components live in `src/components/graphics/`.

| Asset | Type | Use | Source | Variants | Alt / label | Dynamic |
| --- | --- | --- | --- | --- | --- | --- |
| `Glyph` | base component | every custom glyph | custom (`Glyph.tsx`) | 16/20/24 px | via `title` | no |
| `PersonalItemGlyph` | SVG glyph | fare and baggage rows | custom (`Baggage.tsx`) | 16–24 px | label from `BaggageVisual` | no |
| `CabinBagGlyph` | SVG glyph | offer card, checkout extras | custom | 16–24 px | `bg.carryon` | no |
| `CheckedBagGlyph` | SVG glyph | offer card, checkout extras | custom | 16–24 px | `bg.checked` | no |
| `HeavyBagGlyph` | SVG glyph | ready for weight-based allowances | custom | 16–24 px | supplier label | no |
| `StrollerGlyph`, `SportsEquipmentGlyph`, `InstrumentGlyph` | SVG glyph | special baggage when supplier data exists | custom | 16–24 px | supplier label | no |
| `WheelchairGlyph` | UI icon | assistance requests | Lucide `Accessibility` (ISC) | any | text label | no |
| `BaggageVisual` | data diagram | repeats bag glyph × count, struck through when 0 | custom | 16–24 px | full sentence via `label` | yes (offer.baggage) |
| `AircraftSideGlyph`, `DirectRouteGlyph`, `ConnectingRouteGlyph`, `AircraftChangeGlyph`, `OvernightGlyph` | SVG glyph | filters, sort chips, warnings | custom (`Aircraft.tsx`) | 16–24 px | text label | no |
| `PlaneTakeoff`, `PlaneLanding` | UI icon | airport fields | Lucide | any | field label | no |
| `RouteDiagram` | data diagram + motion | flight details, My Trip | custom (`Route.tsx`) | fluid | IATA labels, layover text | yes (slice.segments) |
| `AirportChangeDiagram` | data diagram | self-transfer warning | custom | fluid | `rt.airportchange` | yes |
| `SeatGlyph` (available/selected/unavailable/extra-legroom/preferred) | SVG glyph | seat maps when API data exists | custom (`Seats.tsx`) | 16–32 px | state label | yes |
| `SeatPositionGlyph` | SVG glyph | window/aisle miniature on fare cards | custom | 16–24 px | text label | no |
| `CabinClassGlyph` | SVG glyph | cabin picker, offer header | custom | 20–28 px | `cabinLabel()` | yes (cabinClass) |
| `AdultGlyph`, `ChildGlyph`, `InfantGlyph`, `BassinetGlyph` | SVG pictogram | passenger picker, party summary | custom (`Family.tsx`) | 20–24 px | passenger type | no |
| `PartyPictogram` | data diagram | family total context | custom | 20 px | `common.pax` | yes (passengers) |
| `PassportGlyph`, `VisaStampGlyph`, `BoardingPassGlyph`, `LuggageTagGlyph` | SVG glyph | travel documents, destination visa notes | custom (`Documents.tsx`) | 16–24 px | text label | no |
| `AMENITY_ICONS`, `TRANSPORT_ICONS`, `HOTEL_ICONS`, `TRUST_ICONS`, `DOCUMENT_ICONS` | icon maps | render only keys with real data | Lucide + custom (`Icons.tsx`) | any | key label | yes |
| `BookingTimeline` + `timelineFor` | data diagram | confirmation, My Trip | custom (`Status.tsx`, `timeline.ts`) | fluid | `tl.*` | yes (order state) |
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
