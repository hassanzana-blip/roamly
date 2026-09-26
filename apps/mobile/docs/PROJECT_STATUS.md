# HelloSky iPhone: project status (resume here)

Kept current at every milestone. A new session reads this first, then `docs/OWNER_BACKLOG_2026-09-25.md` and the
last sections of `docs/evidence/MANIFEST.md`.

## Where the work is

- **Branch:** `claude/bold-shannon-0wuhsd` (PR #8). Never push to, merge into or rebase onto `main`.
- **Base on GitHub:** `2f4ab8a`. Everything after it is local to the session and delivered as a git bundle, because
  pushing from the cloud session is refused (403: the session's GitHub access does not include writing to
  `hassanzana-blip/roamly`). Ali can grant it or push the bundle himself.
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
  `3:7`, variables collection «HelloSky» (semantic colours `VariableID:2:42…`). Ledger:
  `scratchpad/figma-state.json` in the session.

## Real-data state

- Staging answers `provider=demo, sandbox=true`: real provider data is **not proven** end to end. Live KAYAK needs
  affiliate access; Duffel live is unknown. The app labels demo and unverified prices.
- No price history, no daily prices, no price alerts in the app (proposal waiting for Ali:
  `docs/PROPOSAL_DEALS_AND_ALERTS_2026-09-25.md`).
- Hotels: behind `hotels.status`; the app shows hotels only when the server says they are on.
- Apple/Google sign-in: built and gated off until Apple's entitlement and Clerk are configured (Ali).
- On the phone only: recent searches (max 6), saved destinations, usual departure airport, draft form, language.

## Test state

- Jest: 586 passed, 3 skipped at `b5c5172` (UTC and Oslo, also with the clock at 24 Oct 2026 and 1 Jun 2027).
  Typecheck and lint clean; iOS export and bundle check OK.
- Browser preview harness (session only): `/home/claude/preview` (`harness/sync.sh`, `harness/metro-restart.sh`,
  mock API on :3999, Playwright scripts). NOT a simulator.
- Never tested on a simulator or an iPhone.

## Milestones on this branch (newest first)

| Commit | What |
|---|---|
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
| 5 | Airport swap animation | partial | P1 | Half turn + spoken route; add position exchange and haptics |
| 6 | Flexible dates | open | P2 | ±1/±3 as extra searches costs provider calls: decide with Ali |
| 7 | Nearby-date strip | blocked | P3 | Needs daily prices |
| 8 | Fare calendar | blocked | P3 | Needs daily prices |
| 9 | Cheapest-day indicators | blocked | P3 | Needs daily prices |
| 10 | Best/Cheapest/Fastest | done | P1 | Add «Senest avreise» |
| 11–17 | Direct, stops, airlines, airport, time, duration, baggage filters | done | – | Only data the offers carry |
| 18 | Itinerary grouping | done | – | |
| 19 | Seller comparison | done | – | |
| 20 | Total-price clarity | done | – | Total only when the provider confirms it |
| 21 | Return-flight clarity | done | – | Both legs on the card |
| 22–24 | Layover, airport-change, next-day warnings | done | – | |
| 25 | Self-transfer indicator | blocked | P2 | Only if the provider says so |
| 26 | Price alerts | blocked | P1 | Server exists for the web; needs Ali (proposal) |
| 27 | Saved flights | open | P1 | Server `saved_items` exists for the web; mobile route needed |
| 28 | Saved searches | partial | P1 | Recent searches on the phone |
| 29 | Saved routes | open | P1 | With 27 |
| 30 | Recent searches | done | – | |
| 31 | Explore Anywhere | partial | P1 | Curated destinations + map, no prices |
| 32 | Weekend finder | open | P2 | Real dates; prices only from a real source |
| 33 | Budget exploration | blocked | P2 | Needs prices (proposal) |
| 34 | Destination themes | open | P1 | Curated facts (sol, storby …), no prices |
| 35 | Norway holiday discovery | open | P2 | Needs verified school-holiday dates per municipality |
| 36–37 | Price history, good-price intelligence | blocked | P3 | Needs history |
| 38 | Shareable travel cards | partial | P2 | Share text exists; card image later |
| 39 | Personal travel dashboard (Min side) | open | **P0** | Real local data now; server data next |
| 40 | Traveler profiles | open | P1 | Server `saved_travelers` exists; mobile route needed; no ID data |
| 41 | Travel preferences | partial | P1 | Home airport only |
| 42 | Home airport | done | – | |
| 43 | Preferred airlines | open | P2 | With 41 |
| 44 | Notification center | open | P2 | Server `customer_notifications` exists |
| 45–46 | Widget, Live Activities | later | P3 | Native work |
| 47 | Collaborative shortlist | later | P3 | Server has boards/match for the web |
| 48 | Natural-language search | later | P3 | |
| 49 | Comparison explanation | partial | P2 | «Best» explained; per-card «why» later |
| 50 | Personal travel graph | later | P3 | |

**P0 right now (25.09):** Cloud + Graphite design system across the app → Home with a graphite search island →
first-launch welcome with Apple/Google (visible in the preview) → Min side as a travel hub → search
transformation into the results header → Figma in step.

## Next priority

See the task list in the session and the P0 line above. After P0: saved flights/routes and traveler profiles
through the mobile API (server routes exist for the web), «Senest avreise», destination themes in Explore.
