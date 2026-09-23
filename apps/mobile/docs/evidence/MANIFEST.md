# iOS app: before/after screenshots (fixture data)

**These are not live results and not an iOS build.** Every image is a web
rendering of the app's own code (`apps/mobile`, Expo for web in Chromium),
fed with hand-made demo data. The caption bar on each image says so.

| | Commit | Languages |
|---|---|---|
| Before | `bc7ffab` (black/white/blue design) | Norwegian only; the app had no English then |
| After | `79c2730` | English (the default) and Norwegian (a saved choice in Profile) |

Screens: 1 home, 2 results (Oslo → Barcelona), 3 the details of the first
result card, 4 profile, signed out.

**One traceable flow.** In every set, screen 3 is the first card on
screen 2: offer `dy_eve`, Norwegian DY1878/DY1879, OSL 18:40 → BCN 22:00,
back BCN 06:55 → OSL 10:15, total NOK 1,990 (1 adult, return). The
capture script clicks the first card, not a chosen offer. It then checks
that the route is `/tilbud/dy_eve` and that the details screen shows all
four times and the same price, and it fails the capture if anything
differs. The recorded facts per language (`flow.json` in the capture run):

| Set | Language | First card | Times on card = details | Price on card = details |
|---|---|---|---|---|
| before `bc7ffab` | nb | `dy_eve` | 18:40, 22:00, 06:55, 10:15 | 1 990 kr |
| after `79c2730` | en | `dy_eve` | 18:40, 22:00, 06:55, 10:15 | NOK 1,990 |
| after `79c2730` | nb | `dy_eve` | 18:40, 22:00, 06:55, 10:15 | 1 990 kr |

**Correction.** The first version of this set (after = `5230535`)
opened a hard-coded offer (`gtg_dy`, Gotogate, 10:25, NOK 2,390) for
screen 3, not the first card, and wrongly called it the first seller.
Codex spotted it. Those images are replaced, and the app's own selection
was right: the card opens the details of its cheapest seller.

## How they were made

1. One clean git worktree per commit, with `app.json` locally set to allow
   `web`. That change is only in the scratch copy; this repository's
   `app.json` is untouched. A date-input shim was also added, because the
   native date picker has no web version.
2. `expo start --web --clear`, one server at a time. Before each run the
   script checks that the served code is the expected commit, by reading
   the search button's label ("Search flights" after, "Søk fly" before).
3. Playwright (Chromium) with an iPhone 15 Pro profile, a 393×852 viewport
   at 2× scale and the Europe/Oslo time zone. Inter stands in for SF Pro,
   which is not available on Linux.
4. Every API call is answered inside the page from one fixture: 5 offers,
   Oslo → Barcelona, marked `provider: "demo"`, so the app itself shows
   "Demo data: not real flights or prices". Provider links point to
   `example.com`. Nothing reaches a HelloSky server, a provider or Railway.
5. A caption bar with before/after, commit, language, screen and the
   fixture notice is added above each capture.

Airline and seller names in the fixture (Norwegian, KLM, Gotogate, …) are
only labels in test data. They are not offers from those companies.

No account is signed in. The images contain no personal data, tokens or
server addresses.

## What changed (bc7ffab → 79c2730)

- **Language:** English by default, Norwegian as a choice in Profile that
  is saved on the phone. Prices stay in NOK in both languages.
- **Home:** a plain line explaining that HelloSky compares prices and that
  you book and pay on the provider's own site. The photo credit line is
  translated.
- **Results and details:** the demo, test-environment and live wording is
  set by what the server says. "Live prices" appears only when the server
  names a real provider and sends `sandbox: false`; otherwise results are
  marked "couldn't confirm live prices". The fixture here is demo data.
- **Details:** refund and change terms can read "allowed for a fee".
  Warnings for airport changes, overnight arrivals and long layovers show
  before you continue to the provider (not triggered by this fixture).
- **Profile:** a language switch.
- **Results:** filters for airline, total price, longest flight time and
  return departure (`a7b7537`).
- **Details:** tickets HelloSky sells itself now say "Continue on
  hellosky.no" instead of showing a disabled button. Shares carry the same
  search as a hellosky.no link (`d8c3e68`).

Not in these images yet: the account screens (edit profile, forgot
password, delete account, help and legal links). They wait on the backend
account endpoints, which are still being fixed after the security review.
They will be added as a new "after" set once pushed.

## Files

| File | SHA-256 (prefix) |
|---|---|
| `before-bc7ffab-nb-1-home.png` | `355d958de04d2eab…` |
| `before-bc7ffab-nb-2-results.png` | `f10a622fe64250c3…` |
| `before-bc7ffab-nb-3-details.png` | `fe1735d9a14f0d8c…` |
| `before-bc7ffab-nb-4-profile.png` | `8c6d8b9efc410e6c…` |
| `after-79c2730-en-1-home.png` | `c19ee0cc504384c7…` |
| `after-79c2730-en-2-results.png` | `2e0bd89f4f1c9806…` |
| `after-79c2730-en-3-details.png` | `dd0a3eaef1962cdc…` |
| `after-79c2730-en-4-profile.png` | `38734ea06f167897…` |
| `after-79c2730-nb-1-home.png` | `c1389ba2f295ca25…` |
| `after-79c2730-nb-2-results.png` | `e32cda8e088c201a…` |
| `after-79c2730-nb-3-details.png` | `3003783be74f96a0…` |
| `after-79c2730-nb-4-profile.png` | `0ac3adba1530cddf…` |

Each image is 786×1809 px: a 2× capture of a 393×852 viewport plus the
caption bar.

## Result-card density (0271bb6 → dbb5bb2)

Same harness and fixture. The first card is offer `dy_eve`. Heights are
in points at the viewport size. "Next card visible" is how much of the
second journey shows above the floating Filter/Sort/Dates bar before
scrolling.

| Viewport | Language | Card height before → after | Next card visible before → after |
|---|---|---|---|
| 393×852 | en | 359 → 243 | 35% → 100% (start of a third) |
| 320×568 | en | 359 → 243 | 0% → 0%; the first card now fits |
| 320×568 | nb | 397 → 279 | 0% → 0%; the first card now fits |

At 320 pt the header, filter chips and the demo/FX notices take the top
half of the screen. They are not shortened, because the demo warning must
stay visible.

Files: `density-before-393-en.png`, `density-after-393-en.png`,
`density-before-320-nb.png`, `density-after-320-nb.png`.
