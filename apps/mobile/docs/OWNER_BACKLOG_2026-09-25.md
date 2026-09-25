# HelloSky iPhone: owner backlog (ranked)

25 September 2026. Written after a full read of the app source, the mobile API (`api/mobileFlights.ts`,
`api/flights.ts`), the shared contracts, the earlier backlogs (`BACKLOG.md`,
`docs/PRODUCT_QUALITY_BACKLOG_2026-09-24.md`), `DESIGN.md`, `docs/evidence/MANIFEST.md`, and a fresh
NON-NATIVE browser walk-through of every screen with labelled fixture data (Chromium, 390×844).

It merges the open items from the 60-item plan with new findings. Numbers in brackets refer to that plan.
Status is kept in this file as work lands; each shipped item names its commit and evidence in `MANIFEST.md`.

**Ranking**
- **P0**: broken, blocks a purchase decision, or a trust problem.
- **P1**: major customer value on the search → compare → provider path.
- **P2**: strong improvement.
- **P3**: polish.

**Constraints that shape every item.** No invented prices, availability, alerts, reviews or discounts. Filters
and rankings only on data the offer carries. Prices always in NOK. No new dependencies unless nothing in the
stack solves it. App source, tests and mobile docs only (config, CI and release belong to others).

## What the walk-through found

The foundations are strong: honest price states (exact / «ca.» / none), grouped sellers, expiry re-checks,
request-mismatch exclusion, 44 pt targets, typed i18n, VoiceOver language tags. The weakest parts are
**comparison speed** and **date entry**:

- A round-trip result card is ~290 pt tall at 390 pt width: 1.3 cards fit in the first view.
- There is no «Best» ranking. The default is «Cheapest», so a 13-hour overnight connection that costs
  30 kr less than a 3-hour direct flight is the second thing a customer sees.
- Sorting is behind a toolbar button; the trade-off between cheapest and fastest is invisible.
- Cards do not say where you change planes, and an overnight layover or airport change is only visible
  after opening the details.
- Dates are two separate sheets with the native wheel/calendar; picking a trip takes 6+ taps.
- Loading is a spinner in an empty dark screen for up to 20 s.

## P0

| # | Item | Status |
|---|---|---|
| 0.1 | Material itinerary risks (overnight layover, airport change, long layover) visible on the result card, not only in details [32] | done (stage «compact card») |
| 0.2 | A «Best» ranking so a long overnight connection is not presented as the top choice just because it is marginally cheaper; explained in plain words | done (stage «Best / Cheapest / Fastest») |
| 0.3 | Default ranking honest about what it optimises: the sort in effect is always visible on the list | done (same stage) |

## P1: compare flights with confidence

| # | Item | Status |
|---|---|---|
| 1.1 | Sort tabs above the list: Best / Cheapest / Fastest with each tab's top price and travel time (real data only) [28] | done (same stage) |
| 1.2 | Add «Earliest departure» sort; stable tie-breaks everywhere [28] | done (same stage) |
| 1.3 | Compact result card (target ≤ 215 pt round trip at 390 pt): whole card is the button, bags beside the price, cabin shown only when it differs from the search [22] | done (215 pt) |
| 1.4 | Layover airports on the card («1 mellomlanding · CPH») | done |
| 1.5 | One range calendar for departure + return in one sheet; one-way picks one date; month list, today/past disabled, 44 pt days, VoiceOver dates [23] | done (stage «range calendar») |
| 1.6 | The same calendar in the results «Datoer» sheet (replaces two compact pickers) | done |
| 1.7 | Loading: skeleton cards under the real header (search stays visible), stable layout, Reduce Motion respected, cancel kept [17][45] | done (stage «loading») |
| 1.8 | Details: the full journey (both legs, every segment, layovers) visible without hunting through tabs [39] | done (stage «details one scroll») |
| 1.9 | Details: baggage and fare conditions per seller visible before the handoff button without tab switching [33][34] | done |
| 1.10 | Airport picker: other airports in the same city/area offered next to the chosen one (e.g. TRF next to OSL, LGW next to LHR), never merged [14] | done: Torp as its own row under a search for Oslo; same-city airports already list together (MANIFEST «Airport picker») |
| 1.11 | Airport picker: matched text emphasised; Norwegian city names and IATA both match (server already does the search) | done: emphasis, instant registry matches, English names («Helsingfors (Helsinki)») (MANIFEST «Airport picker») |
| 1.12 | Filters: connection airports (from the offers), arrival-time bands both ways [29][31] | done: «Mellomlanding i» and «Avgang \| Ankomst» per leg (MANIFEST «Filters») |
| 1.13 | Filter state visible after the sheet closes: active filters as removable chips [29] | done: chips after «Alle», a tap removes (MANIFEST «Filters») |
| 1.14 | Price basis wording shorter on cards; full basis kept for VoiceOver and details [24] | done |
| 1.15 | Results: «N reiser» count and sort label never contradict the list after filtering | planned |
| 1.16 | Error recovery specific to the code, with the search kept (already largely true; verify copy) [18] | verify |
| 1.17 | Home: search form first view unchanged or tighter after the calendar change [45] | planned |
| 1.18 | Travellers sheet: summary line at the top, infant rule explained where it bites [24] | planned |
| 1.19 | Swap airports: animated icon and VoiceOver announcement of the new route [13] | planned |
| 1.20 | Recent searches reachable from Home in one tap without pushing destinations out of the first view [43] | planned |

## P1: trust and handoff

| # | Item | Status |
|---|---|---|
| 1.21 | Handoff bar names the seller and says the booking is completed with them (exists; keep) [40] | verified earlier |
| 1.22 | Seller comparison: airline-direct marked as such, agency marked as agency (exists) [32] | verified earlier |
| 1.23 | Expired offer: no handoff without explicit «continue anyway» (exists) [27] | verified earlier |
| 1.24 | Demo/sandbox/unverified never mistaken for live (exists) [36] | verified earlier |

## P2

| # | Item | Status |
|---|---|---|
| 2.1 | «Best» explanation sheet: what goes into it, including the stated airline-direct nudge | done (in «Sorter») |
| 2.2 | Result card: seller count tappable context («3 tilbydere – fra 1 570 kr») | planned |
| 2.3 | Details: segment list shows aircraft and operating carrier compactly | planned |
| 2.4 | Details: «Del» shares route/dates, never a price guarantee (exists) [37] | verified earlier |
| 2.5 | Filters sheet: sticky section headers, counts per option stay (exists) | planned |
| 2.6 | Results header: tapping the route opens the search form (not only the search icon) [25] | planned |
| 2.7 | Results: pull-to-refresh as an alias for «Oppdater priser» | planned |
| 2.8 | Loading copy: what we are doing, not a promise about time | planned |
| 2.9 | Explore: route context editable in place [9] | open |
| 2.10 | Explore/Lagret: consistent row density with Results | open |
| 2.11 | Empty results: suggest ±1–3 days only as a new search, never with invented prices [35] | planned |
| 2.12 | Performance: memoised cards, stable keys, no per-render regrouping in the filter sheet | partial (cards memoised, stable callback) |
| 2.13 | Performance: measure search-to-first-card on device (needs a device build) [58] | blocked (device) |
| 2.14 | Profile: guest state explains what an account adds, truthfully [48] | open |
| 2.15 | Copy review nb/en for every new string (native-sounding, no clipped labels) [52] | ongoing |
| 2.16 | Figma: new card, sort tabs and calendar components mirrored in the existing file | open |

## P3

| # | Item | Status |
|---|---|---|
| 3.1 | Pressed states and icon weights consistent across new components [54] | ongoing |
| 3.2 | Reduce Motion for every new transition [57] | ongoing |
| 3.3 | Card entrance without layout shift | planned |
| 3.4 | Tabular numerals everywhere a time or price is compared [53] | ongoing |

## Blocked outside the app

- **Server/web airport search misses English names** (found in stage 6; owner or Codex, `api/lib/airportMeta.ts`).
  `searchAirportsWorldwide` skips curated airports in the world index (`CURATED.has(e.r.i)`), so their English names
  from OurAirports are never searched: «helsinki», «munich», «vienna», «prague» and others find nothing, and
  «copenhagen» finds only Roskilde. Proposed fix, about five lines: do not skip curated codes when matching the world
  index; when a curated code matches, return the curated `Airport` (Norwegian names, time zone) with a small score
  bonus. The app now works around it with its own English names; the web is still affected.

- Real device, simulator, VoiceOver and Dynamic Type verification (no Mac or iPhone in this environment).
- Live KAYAK inventory (affiliate access); staging answers with demo data.
- Price alerts and synced saved trips (server routes exist for the web only).
- Social sign-in (owner configuration; see `social-login-handoff.md`).
