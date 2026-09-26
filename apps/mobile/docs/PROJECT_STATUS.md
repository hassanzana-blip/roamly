# HelloSky iPhone: project status (resume here)

Kept current at every milestone. A new session reads this first, then `docs/OWNER_BACKLOG_2026-09-25.md` and the
last sections of `docs/evidence/MANIFEST.md`.

## Where the work is

- **Branch:** `claude/bold-shannon-0wuhsd` (PR #8). Never push to, merge into or rebase onto `main`.
- **On GitHub:** the whole branch. The bundle up to `5e4ac0b` was pushed on 26.09 (fast-forward from `2f4ab8a`); later
  stages are pushed directly to the same branch.
- **Latest commit:** see `git log -1`; the milestone list below names each one.

## Ground rules (from Ali's briefs)

- Flights first, Norway first, Bokmål default, prices in NOK. Guests search without an account.
- Never invent prices, availability, alerts, bookings, discounts or history. Fixtures only in tests and previews,
  labelled DEMO / fixture.
- Stop for approval before: deploys, App Store/TestFlight, real bookings or payments, paid services, destructive
  database work, domains/DNS, credentials, legal policy, customer communications.
- Owned by Ali: `app.json`, `eas.json`, `package.json`, lockfiles, Expo config, Clerk, Railway, Apple Developer.
  Owned by Codex: root config, root CI, SEO, readiness and release docs. Ours: `apps/mobile/src/**`, tests, mobile
  docs, and the mobile API routes in `api/` when a feature needs them (with approval before anything is deployed).
- 44 pt targets, Dynamic Type without cut text, VoiceOver roles, labels and language, Reduce Motion.
- Strings through `src/i18n`; code comments and test names in Norwegian. No Prettier on `apps/mobile`.
- Evidence labels: BROWSER TESTED (NON-NATIVE Expo web preview) / SIMULATOR / DEVICE / NOT TESTED.

## Design direction

- **Cloud + Graphite (25.09.2026, Ali):** about 70 % light, 20 % graphite, 10 % blue. Light canvas `#F3F4F6`,
  white surfaces, graphite islands (`#181A1F`) for the search, the tab bar, route headers and the price bar; blue
  only for actions. Existing tokens are kept where they are equal or better (blue `#0754F8`: 5.8:1 on white;
  secondary text `#62656D`). Details in `DESIGN.md`.
- Before that: dark «charcoal» app (until `b5c5172`), momondo-pattern Home, Profile as settings list, floating tab
  capsule.
- **Figma** (source of truth for components): file `YE2XDmrOTFY8dRFiarPxSz`, pages Components `3:5` and Core Flow
  `3:7`, variables collections «HelloSky / Primitives» and «HelloSky / Semantic» (semantic colours `VariableID:2:42…`;
  `color/canvas` `VariableID:77:402`, `color/surfaceSoft` `77:404`, `color/blueOnDarkTint` `80:414`). Frame **P7 ·
  Cloud + Graphite** `81:653` mirrors `09404b2`: Home, results compact and open, Min side (signed in, full page), Min
  side for a new guest, welcome. New components: HubTile `79:401`, SummaryChip `79:404`, ContinueRow `79:1049`,
  SectionHead `79:1060`, ListRow `79:1063`, TabBar `80:512`. Ledger: `scratchpad/figma-state.json` in the session;
  picture: `docs/evidence/figma-p7-cloud-graphite.jpg`.

## Real-data state

- Staging answers `provider=demo, sandbox=true`: real provider data is **not proven** end to end. Live KAYAK needs
  affiliate access; Duffel live is unknown. The app labels demo and unverified prices.
- No price history, no daily prices, no price alerts in the app (proposal waiting for Ali:
  `docs/PROPOSAL_DEALS_AND_ALERTS_2026-09-25.md`).
- Hotels: behind `hotels.status`; the app shows hotels only when the server says they are on.
- Apple/Google sign-in: built and gated off until Apple's entitlement and Clerk are configured (Ali).
- **Account data through the mobile API (`mobileAccount.*`, `b9a3853`): built and tested, NOT deployed.** When the
  server has the routes, Min side shows the account's next booking, travellers, active price alerts, unread messages and
  upcoming trips; without them (production today: 404) it shows phone data and links only – never guessed numbers.
  Handoff: `docs/SERVER_MOBILE_ACCOUNT_2026-09-26.md`.
- On the phone only: recent searches (max 6), saved destinations, saved flights (snapshot + the price seen and when,
  max 30), saved routes (max 20), travel preferences, travellers for guests, usual departure airport, draft form,
  language. Saved items do not sync to the account yet (routes exist; needs deploy).

## Test state

- Jest: 784 passed, 3 skipped at the Min side + Lagret stage (TZ=UTC and Europe/Oslo). Typecheck and lint clean; iOS
  export 5 113 158 bytes and bundle check OK.
- Server: integration suite 19 files / 225 tests on a local MariaDB 10.11 (`IT_ROOT_DATABASE_URL`), root unit tests 538,
  `tsc -p tsconfig.server.json`, ESLint and `migrate:check` clean.
- Browser preview harness (session scratch only, rebuilt each session): a copy of `apps/mobile` with `react-native-web`,
  localStorage shims for the keychain and the settings file, `app.json` with `web`, a mock API on :3999 and Playwright
  scripts. NOT a simulator. The repo's `app.json` and `package.json` are never changed for it.
- Never tested on a simulator or an iPhone.

## Milestones on this branch (newest first)

| Commit | What |
|---|---|
| (this stage) | Min side as a travel hub (next trip, travellers, preferences, notifications, account and security), traveller profiles, travel preferences with «Mine preferanser» in results, Lagret with flights/routes/searches/alerts/destinations, save a flight from the details |
| `b9a3853` | Mobile API `mobileAccount.*` (hub, travellers, saved items) and migration 0009 – not deployed |
| `5e4ac0b` | Docs: Cloud + Graphite in DESIGN.md, status, backlog, review-fix evidence and Figma P7 |
| `deb7898` | Review fixes: search transformation (one stable results tree, inert list under the open editor, «Prøv igjen», heading) |
| `d62cac3` | Review fixes: Min side (usual-airport rule, status bar over sheets, name placeholder, cards grow with text) |
| `09404b2` | Search transformation: compact results header with route, date and traveller chips; editor in place; motion |
| `e7629b6` | Min side as a travel hub; status bar follows the focused tab |
| `815d35e` | Evidence for the Cloud + Graphite and welcome stages |
| `af7ed8a` | First-launch welcome with Apple, Google, e-mail and skip |
| `a264f54` … `a6ed8db` | Cloud + Graphite: Home, results and details, Explore, Saved and hotels |
| `b5c5172` | Review fixes: Profile scroll reset, account rows, password cleared, keyboard over sheets, pinned test clock |
| `70b08e6` | Proposal: deals rail and price alerts (needs Ali) |
| `21d3498` | Tab bar as a floating capsule |
| `7b92dcf` | Profile as a settings list with a sign-in card (form in its own sheet) |
| `8bea822` | Home in the big search services' pattern |
| `9c0317f` … `18193da` | Best/Cheapest/Fastest, compact cards with risks, range calendar, loading skeleton, one-scroll details, airport picker, filters, recent searches, refresh, Explore in place, Figma sync |

## The 50-feature backlog, ranked

Status: **done** (on this branch), **partial**, **open** (buildable now), **blocked** (needs data, server or Ali),
**later**. Rank: P0 now, P1 next, P2 after, P3 later.

| # | Feature | Status | Rank | Note |
|---|---|---|---|---|
| 1 | Smart airport autocomplete | done | – | Registry + server, English names, emphasis |
| 2 | City/airport distinction | done | – | Every airport its own row; never merged |
| 3 | Nearby airports | partial | P2 | Torp under Oslo; no distances (no verified coordinates per airport pair) |
| 4 | Recent airports | done | – | Before typing |
| 5 | Airport swap animation | done | – | Half turn, position exchange, spoken route; haptics wait for `expo-haptics` (Ali) |
| 6 | Flexible dates | open | P2 | ±1/±3 as extra searches costs provider calls: decide with Ali |
| 7 | Nearby-date strip | blocked | P3 | Needs daily prices |
| 8 | Fare calendar | blocked | P3 | Needs daily prices |
| 9 | Cheapest-day indicators | blocked | P3 | Needs daily prices |
| 10 | Best/Cheapest/Fastest | done | – | Plus «Tidligst» and «Senest avgang» in «Sorter» |
| 11–17 | Direct, stops, airlines, airport, time, duration, baggage filters | done | – | Only data the offers carry |
| 18 | Itinerary grouping | done | – | |
| 19 | Seller comparison | done | – | |
| 20 | Total-price clarity | done | – | Total only when the provider confirms it |
| 21 | Return-flight clarity | done | – | Both legs on the card |
| 22–24 | Layover, airport-change, next-day warnings | done | – | |
| 25 | Self-transfer indicator | blocked | P2 | Only if the provider says so |
| 26 | Price alerts | blocked | P1 | Server exists for the web; needs Ali (proposal). Lagret says so and shows the account's count when the routes are deployed |
| 27 | Saved flights | done | – | On the phone with the price seen and its date; account sync needs deploy (routes built) |
| 28 | Saved searches | partial | P2 | Recent searches and saved routes on the phone |
| 29 | Saved routes | done | – | Two airports; use, share, remove |
| 30 | Recent searches | done | – | |
| 31 | Explore Anywhere | partial | P1 | Curated destinations + map, no prices |
| 32 | Weekend finder | open | P2 | Real dates; prices only from a real source |
| 33 | Budget exploration | blocked | P2 | Needs prices (proposal) |
| 34 | Destination themes | open | P1 | Curated facts (sol, storby …), no prices |
| 35 | Norway holiday discovery | open | P2 | Needs verified school-holiday dates per municipality |
| 36–37 | Price history, good-price intelligence | blocked | P3 | Needs history |
| 38 | Shareable travel cards | partial | P2 | Share text exists; card image later |
| 39 | Personal travel dashboard (Min side) | done | – | Account data when the routes are deployed; phone data otherwise |
| 40 | Traveler profiles | done | – | Name, type, cabin; phone or account; never ID data |
| 41 | Travel preferences | done | – | On the phone; never hide results; account mapping later |
| 42 | Home airport | done | – | |
| 43 | Preferred airlines | done | – | Prefer / avoid (marked, never hidden) |
| 44 | Notification center | partial | P2 | Unread count and link on Min side (with the routes); no push (no `expo-notifications`) |
| 45–46 | Widget, Live Activities | later | P3 | Native work |
| 47 | Collaborative shortlist | later | P3 | Server has boards/match for the web |
| 48 | Natural-language search | later | P3 | |
| 49 | Comparison explanation | partial | P2 | «Best» explained; per-card «why» later |
| 50 | Personal travel graph | later | P3 | |

**Min side + Saved (26.09):** Min side is the customer's travel hub with the account's real data when the server has it;
traveller profiles and travel preferences; Lagret with flights, routes, searches, alerts and destinations. Server routes
built, not deployed.

**P0 of 25.09 is done (26.09):** Cloud + Graphite across the app, Home's graphite search island, the first-launch
welcome with Apple/Google (visible in the preview), Min side as a travel hub, the search transformation into the
results header with motion, and Figma P7 in step. Independent reviews of Min side and the transformation are fixed.

## Next priority

1. **Ali: approve deploying `mobileAccount.*` and running migration 0009** (additive). Until then Min side and Lagret
   show phone data only. Handoff: `docs/SERVER_MOBILE_ACCOUNT_2026-09-26.md`.
2. After deploy: sync Lagret (flights, routes, destinations) with the account – a union on sign-in and save/unsave
   through the API, like «Flytt til kontoen» for travellers (6.7).
3. Destination themes in Explore (curated facts, no prices) – next P1 that needs no approval.
4. VoiceOver tab roles (backlog 4.9) and a device pass (simulator/iPhone) for status bars, sheets, the traveller form
   with the keyboard, and motion.
5. Owner items: Google's logo asset, Apple capability + Clerk, `expo-haptics`, the deals/alerts proposal, preferences
   on the account (6.8).
