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

## Result-card density and small screens (0271bb6 → dbb5bb2 → 3f3d884)

Same harness and fixture. The first card is offer `dy_eve`. Values are in
points at the viewport size. "Bar" is the top edge of the floating
Filter/Sort/Dates bar: anything below it is covered until you scroll.

| Viewport, language | Commit | First card top → bottom | «Details» label text bottom | Bar top | Total and Details clear of the bar? |
|---|---|---|---|---|---|
| 393×852, en | 0271bb6 | 274 → 633 (359 tall) | – | 786 | yes; next card 35% visible |
| 393×852, en | dbb5bb2 | 274 → 517 (243 tall) | 491 | 786 | yes; next card 100% visible |
| 393×852, en | 3f3d884 | 216 → 459 (243 tall) | 433 | 786 | yes; next card 100% visible |
| 320×568, en | dbb5bb2 | 310 → 553 | 527 | 502 | **no** |
| 320×568, en | 3f3d884 | 234 → 477 | 451 | 502 | yes, the whole card |
| 320×568, nb | dbb5bb2 | 292 → 571 | 537 | 502 | **no** |
| 320×568, nb | 3f3d884 | 250 → 529 | 495 | 502 | total yes; the «Detaljer» pill **no**, 5 pt under the bar (see the second correction) |

**Correction.** The earlier version of this section said that at 320 pt
"the first card now fits" (dbb5bb2). That was wrong: the floating bar
covered its total and Details (Codex's review). 3f3d884 fixes it:
- When every price was converted, the FX explanation starts collapsed
  behind a labelled, accessible "Om «ca.»-priser" / 'About "approx."
  prices' disclosure. Each affected card still shows "approx." and the
  Norges Bank rate and date.
- Slightly tighter spacing in the header rows.
- The subtitle may wrap instead of being cut off.

The demo warning is not shortened or hidden.

**Second correction (23 Sep, found by the verification pass).** The
«Details» column above measured the label text, not the 44 pt pill around
it, which ends 12 pt lower. Measured again at `d99568d` (the same result
layout as `3f3d884`), with zero insets like the table above:
- 320 × 568 nb: the pill is at 463–507 and the bar starts at 502, so the
  pill is **5 pt under the bar**. The total (453–483) is clear. The earlier
  "yes" for this row was wrong.
- 320 × 568 en: the pill ends at 463, clear.
- 393 × 852: the pill ends at 445, clear.

Files: `density-before-393-en.png` and `density-before-320-nb.png`
(0271bb6); `density-after-393-en.png`, `density-after-320-nb.png` and
`density-after-320-en.png` (3f3d884).

## Three screens at 375, 393 and 430 pt, fresh install (d99568d)

Same fixture (5 offers, Oslo → Barcelona, `provider: "demo"`) and the same
rules as above. Differences from the sets above:
- One clean git worktree at `d99568d`. Only scratch-only web settings were
  changed:
  - `app.json` gets the `web` platform and the Metro web bundler;
  - `metro.config.js` resolves the date-input shim (`preview-shims/`);
  - `expo start` rewrote `tsconfig.json`, which affects type checking only.
- A new browser profile per width, so nothing is saved on the "phone". The
  script touches nothing before it checks that the search button says
  «Søk fly». English was the default before this commit, so this proves a
  fresh install now starts in Bokmål.
- Viewports 375 × 812, 393 × 852 and 430 × 932, all captured at 2×. Real
  iPhones at these sizes render at 3×.
- **Simulated iPhone safe area.** Top/bottom insets are 50/34 pt at 375
  (iPhone 13 mini) and 59/34 at 393 and 430 (iPhone 15 Pro / Pro Max).
  - The app reads the insets from a hidden element
    (react-native-safe-area-context on the web). The script overrides that
    element and fails unless the app received exactly these values.
  - No status bar or home indicator is drawn.
  - Not measured on an iPhone.
- Each image has a caption bar above the screen. The measurements are in
  points from the top of the screen, not the image.

A first pass without insets (0 pt), taken before this commit was rebased, was
replaced by this one. It made the first screen look roomier than it would
on a phone.

**One traceable flow per width.** Home → pick Barcelona → search → tap the
first card. The first card was `dy_eve` at every width: Norwegian, OSL
18:40 → BCN 22:00, back BCN 06:55 → OSL 10:15, «1 990 kr · Totalt for 1
voksen · Tur-retur». The script fails if any of these checks fails:
- the details route is `/tilbud/dy_eve`;
- the card's four times appear on the details screen;
- the sticky bar shows the card's price (1 990 kr).

Only `flights.airports` and `flights.search` were called, both answered
inside the page. `flights.search` came from the fixture and
`flights.airports` from a one-airport stub (BCN) in the capture script.

| Measure (pt, with the simulated insets) | 375 × 812 | 393 × 852 | 430 × 932 |
|---|---|---|---|
| Home: photo header bottom | 276 | 285 | 285 |
| Home: «Søk fly» (52 tall) bottom / tab bar top | 628 / 721 | 637 / 761 | 637 / 841 |
| Home: «Utforsk reisemål» top / first destination card visible | 766 / 0 of 132 | 775 / 0 of 132 | 757 / 50 of 132 |
| Results: first card top → bottom | 266 → 509 | 275 → 518 | 275 → 518 |
| Results: «Detaljer» pill (113 × 44) bottom / floating bar top | 495 / 712 | 504 / 752 | 504 / 832 |
| Results: second card visible above the bar | 68 % | 79 % | 100 % |
| Details: summary / tabs (44 tall) | 110–393 / 457–501 | 119–402 / 466–510 | 119–402 / 466–510 |
| Details: «Reiseinformasjon» top / sticky bar top (height) | 533 / 643 (169) | 542 / 683 (169) | 542 / 763 (169) |
| Horizontal overflow on any screen | none | none | none |

Touch targets:
- Icon buttons are 40 pt with `hitSlop` to 48; chips are 36 pt with
  `hitSlop` to 44.
- «Om «ca.»-priser» is 18 pt + 2 × 8 = 34 pt, which is **below 44**.
- At 320 × 568 in Bokmål the «Detaljer» pill is 5 pt under the floating bar
  (second correction above).

See DESIGN.md, «Gap å vurdere».

| File | SHA-256 (prefix) |
|---|---|
| `nb-d99568d-375-1-home.png` | `88b95e3e5782e05a…` |
| `nb-d99568d-375-2-results.png` | `86564fd9c14cfb46…` |
| `nb-d99568d-375-3-details.png` | `a5ccc1f0d0d9abca…` |
| `nb-d99568d-393-1-home.png` | `1df6ac1f83d4e471…` |
| `nb-d99568d-393-2-results.png` | `4d70970cb9ff89d9…` |
| `nb-d99568d-393-3-details.png` | `23edd5aa9f1da1eb…` |
| `nb-d99568d-430-1-home.png` | `283ad98471efa5d1…` |
| `nb-d99568d-430-2-results.png` | `9776dc676e10a95b…` |
| `nb-d99568d-430-3-details.png` | `f9c4c29b2c2e1ff3…` |

Sizes: 750 × 1758, 786 × 1838 and 860 × 1998 px (the screen at 2× plus the
caption bar).

The "after" and density sets above were made while English was the default
(`79c2730` to `3f3d884`). The "before" set predates English.
