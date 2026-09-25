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

## Core-flow corrections (dad15c4)

Same method as the `d99568d` section: fixture, fresh browser profile per
width, «Søk fly» label check, simulated safe area checked inside the app,
and the traceable first-card flow (`dy_eve`, four times, bar price). It was
captured from a clean worktree at `dad15c4`, the commit that contains all
the code of this stage. Three additions:
- **320 × 568**, Results only, in Bokmål (fresh install) and English (chosen
  in Profile). The safe area is 20/0 pt, as on an iPhone SE with Display
  Zoom.
- **Grouped journey** at 393 pt: the details of `gtg_dy`, two sellers,
  captured in a tall viewport so the whole comparison shows. The script
  then switches seller and records the bar and the Baggage/Terms tabs.
- **Enlarged text** at 393 pt: CSS `zoom: 1.35` on every text block, so
  text grows and the layout reflows. This approximates larger text. It is
  not iOS Dynamic Type.

The script also scrolls each result list to the end and checks that the
last card ends above the floating bar. It checks that no text is clipped,
that nothing overflows sideways, and which controls are under 44 pt before
`hitSlop`.

| Check (pt, with the simulated safe area) | 375 × 812 | 393 × 852 | 430 × 932 | Result |
|---|---|---|---|---|
| Home: «Utforsk reisemål» above the tab bar; photo of the first card visible | 610–634 < 721; 77 | 619–643 < 761; 108 | 619–643 < 841; 132 | PASSED (≥ 40) |
| Home: «Søk fly» (52) bottom / tab bar top | 562 / 721 | 571 / 761 | 571 / 841 | PASSED |
| Home: route box / date and traveller tiles | 84 / 52 | 84 / 52 | 84 / 52 | – |
| Home: empty destination «Velg» | dark text (#111214), 22 pt | same | same | PASSED |
| Results: total and «Detaljer» pill bottom / floating bar top | 453, 469 / 712 | 462, 478 / 752 | 462, 478 / 832 | PASSED |
| Results: second card visible | 90 % | 100 % | 100 % | PASSED (≥ 90 %) |
| Results: «Om «ca.»-priser» row | 44 | 44 | 44 | PASSED |
| Results: last card fully above the bar after scrolling | yes | yes | yes | PASSED |
| Details: sticky bar height, including the 34 pt inset | 131 | 131 | 131 | PASSED (≤ 135) |
| Details: price and «Gå til tilbud» on one row; provider named | yes; «Norwegian · Bestillingen fullføres hos tilbyderen.» | same | same | PASSED |
| Clipped text / horizontal overflow | none / none | none / none | none / none | PASSED |

| Other check | Measured | Result |
|---|---|---|
| 320 × 568 nb: total and pill bottom / bar top | 477, 493 / 502 | PASSED |
| 320 × 568 en: total and pill bottom / bar top | 441, 457 / 502 | PASSED |
| 135 % text at 393 × 852 | Home: heading above the tab bar, 52 pt of photo. Details bar grows to 192 pt; texts wrap, none is cut. | PASSED |
| Grouped `gtg_dy`: seller comparison before «Reiseinformasjon»; each seller's baggage complete | Gotogate: «Håndbagasje inkludert · Innsjekket bagasje: ikke oppgitt», 2 390 kr. Norwegian: «Håndbagasje inkludert · Uten innsjekket bagasje», 2 490 kr. | PASSED |
| Switching seller (Gotogate → Norwegian) | Bar 2 390 → 2 490 kr and «Gotogate ·» → «Norwegian ·». Action name «Gå til tilbud hos Gotogate» → «… hos Norwegian». Baggage tab: checked bag «Ikke inkludert». The Terms tab disappears, because Norwegian's offer states no conditions. | PASSED |

Controls whose visible box is under 44 pt, and how they reach 44:
- **Icon buttons (40 pt):** `hitSlop` 4, inside unclipped headers, so 48.
- **Filter chips (36 pt):** `hitSlop` 4. The chip row now has 4 pt above and
  6 pt below the chips, so the whole area is inside the scroll view, which
  clips on iOS. That makes 44.
- Nothing else in the first screen is under 44.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `nb-dad15c4-375-1-home.png` | `6ae88052621d879e…` | 750×1758 |
| `nb-dad15c4-375-2-results.png` | `566d2fbfc8130e0a…` | 750×1758 |
| `nb-dad15c4-375-3-details.png` | `eae133b4d332ba96…` | 750×1758 |
| `nb-dad15c4-393-1-home.png` | `bc9899e439f27bf6…` | 786×1838 |
| `nb-dad15c4-393-2-results.png` | `260a3fa330063275…` | 786×1838 |
| `nb-dad15c4-393-3-details.png` | `7213fee5d52ad98f…` | 786×1838 |
| `nb-dad15c4-393-4-grouped-sellers.png` | `44514ca72b7a687d…` | 786×3534 |
| `nb-dad15c4-393-5-details-text135.png` | `0fa8cbde69c3192b…` | 786×1832 |
| `nb-dad15c4-430-1-home.png` | `938b6d5f8d17ea94…` | 860×1969 |
| `nb-dad15c4-430-2-results.png` | `3ea8a346db15b8bc…` | 860×1998 |
| `nb-dad15c4-430-3-details.png` | `afd78adcd535f07c…` | 860×1998 |
| `nb-dad15c4-320-2-results.png` | `ff069821a6d2621a…` | 640×1292 |
| `en-dad15c4-320-2-results.png` | `1c94dce04f803d04…` | 640×1292 |

Not checked here:
- An iPhone or simulator: SF Pro, the real safe area, VoiceOver, and real
  Dynamic Type sizes.
- Offers with more travellers or long provider names. The fixture has one
  adult and short names; the tests cover wrapping instead of clipping.

## Edge cases: four travellers, long seller names (00d18db)

Only the new edge cases; the 13 core screens above were not captured again.
Captured from a clean worktree at `00d18db`, the commit with all the code of
this stage, at 375 × 812 pt with a simulated safe area of 50/34 pt. Same
method as above: a fresh browser profile per run, the «Søk fly» label check,
Inter instead of SF Pro.

**Test data.** `src/test/edgeFixtures.ts` is labelled «TESTDATA FOR
KANTILFELLER – fiktive navn og priser». The companies do not exist. The
data is 2 adults, 1 child (8) and 1 infant (1), and four offers with
`sandbox: true`:
- One journey, flown by «Nordlys Testflyselskap Interkontinentale Ruter»,
  is sold by three sellers:
  - «Fjordreise Testbyrå med et svært langt firmanavn AS»: 18 450 kr,
    2 checked bags, refund for a fee, change allowed.
  - «Example Long-Name International Travel Agency GmbH (test)»:
    18 990 kr, checked bag not stated, change not allowed.
  - The airline itself: 19 990 kr, no checked bag, no conditions stated.
- A second journey has one offer, at 21 340 kr.

The travellers were set with the steppers on Home. The recorded search
request carried all four passengers. In this run the form kept its default
dates (8–15 Oct), while the fixture's flights are 23/30 Oct. From `be41be4`
on, the capture sets the form dates to the fixture's flights (next section).

**Runs.** Bokmål (fresh install), English (chosen in Profile), and Bokmål at
135 % text. The 135 % run uses CSS `zoom: 1.35` on every text block. That is
an approximation, not iOS Dynamic Type. In each run the script chose each
seller in turn and read the bar, the action's accessible name, the provider
note, and the Baggage and Terms tabs. It checked three things:
- **Clipped:** a text with a line cap and hidden overflow, or a text sticking
  out of a clipping parent.
- **Split word:** a word broken across two lines. Spaces and hyphens are
  allowed break points; a non-breaking space holds a word together.
- **Sideways overflow** of the page.

**Found and fixed in `00d18db`** (each measured with the edge fixtures on the code before its fix):
- **Home:** the travellers tile read «2 voksne, 1 b…», cut by a one-line cap.
  At 135 %, «By eller flyplass» was also cut. Both now wrap; «1 barn» stays
  together.
- **Details, summary and timeline:** the airline name was cut to one line.
  With the cap removed, the timeline squeezed it into a ~70 pt strip beside
  the duration («Testflysels» / «kap») even at normal text. Now the duration
  moves below a name that does not fit on one line. Short names («Norwegian»
  in the standard fixture) keep one line; this was checked in nb and en.
- **Details tabs at 135 %:** «Oversikt», «Bagasje» and «Reiseplan» were cut.
  The row now wraps.
- **Offer bar at 135 %:** the amount split mid-word («18 450 k» / «r»). When
  the amount itself wraps, the price now takes the whole row and the button
  goes below it.

| Check (375 × 812 pt) | nb | en | nb, 135 % text | Result |
|---|---|---|---|---|
| Steppers → search request | 2 / 1 / 1; 2 adults, child 8, infant 1 | same | same | PASSED |
| Travellers tile (tile height) | «2 voksne, 1 barn, 1 spedbarn» in full (90 pt) | «2 adults, 1 child, 1 infant» (70 pt) | in full (117 pt) | PASSED |
| Results: count; grouped card | «2 reiser · 4 tilbud»; «3 tilbydere», 18 450 kr | «2 journeys · 4 offers»; «3 providers», NOK 18,450 | as nb | PASSED |
| Price basis on cards and in the bar, every seller | «Totalt for 2 voksne, 1 barn, 1 spedbarn · Tur-retur» | «Total for 2 adults, 1 child, 1 infant · Return» | as nb | PASSED |
| Seller → bar price / action name / provider note | 18 450 / 18 990 / 19 990 kr; «Gå til tilbud hos ‹seller›»; «‹seller› · Bestillingen fullføres hos tilbyderen.» | NOK 18,450 / 18,990 / 19,990; «Go to offer at ‹seller›»; «‹seller› · You complete the booking with the provider.» | as nb | PASSED |
| Seller → Baggage tab, checked bag | «2 stk. inkludert» / «Ikke oppgitt» / «Ikke inkludert» | «2 included» / «Not stated» / «Not included» | as nb | PASSED |
| Seller → Terms tab | refund with fee + change allowed / change not allowed / no Terms tab | same in English | as nb | PASSED |
| Offer bar height, including the 34 pt inset | 159 (the basis and the provider note take two lines each) | 159 | 273 / 273 / 252; price alone, button below | PASSED (grows instead of cutting) |
| Details tabs | one row, 84/80/65/91 pt wide | one row | 3 + 1 rows | PASSED |
| Clipped text / sideways overflow | none / none | none / none | none / none | PASSED |
| Words split across lines | none | none | «Testflyselskap», «Interkontinentale» in the airline's seller row | FAILED (fixed in `be41be4`, next section) |

**Not accepted in review, fixed in `be41be4`.** At 135 % text the airline's
seller row split its two long words («Testflyselska» / «p»). The name
column there was ~150 pt, next to the price.

Also checked on the standard fixture at `00d18db`, 375 pt, nb and en, with no
images: the price and «Gå til tilbud» share one row, the timeline keeps
«Norwegian» and the duration on one line, and nothing is clipped or split.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `edge-nb-00d18db-375-1-home.png` | `2351fb0c17915770…` | 750×1780 |
| `edge-nb-00d18db-375-2-results.png` | `7920874b1a17844e…` | 750×1780 |
| `edge-nb-00d18db-375-3-details-sellers.png` | `567039173a6efcd9…` | 750×3985 |
| `edge-nb-00d18db-375-4-itinerary.png` | `212c787ae1db8e27…` | 750×3985 |
| `edge-en-00d18db-375-1-home.png` | `3945249102c6db41…` | 750×1780 |
| `edge-en-00d18db-375-3-details-sellers.png` | `7c0fc4c8f7526869…` | 750×3956 |
| `edge-nb-00d18db-375-5-details-text135.png` | `1a1c8909da61a965…` | 750×3979 |
| `edge-nb-00d18db-375-6-bar-text135.png` | `c4b34bb5e5dcb6af…` | 750×1832 |

Each image carries a caption bar (commit, screen, width, language, test-data
note), so its size includes the caption.

Not checked here:
- An iPhone or simulator: SF Pro, real Dynamic Type sizes, the real safe
  area.
- **VoiceOver.** `accessibilityLanguage` is checked by code tests only
  (`a11yLanguage.test.tsx`). VoiceOver itself has not been run.
- The price basis in the bar can still break between «1» and «spedbarn».
  That is ordinary wrapping, not clipping.

## Seller rows: price below when the text needs the width (be41be4)

Only the changed seller card, plus a short-name comparison. Each side was
captured from a clean worktree at its commit:
- **Before** is `0a9e781` (app code identical to `00d18db`).
- **After** is `be41be4`, rebased on Codex's `af27946` and `dabd93c`
  (docs and `.easignore` only).

Both runs are at 375 × 812 pt with a safe area of 50/34 pt.

**Method** (scratch script, not in the repo):
- **Form dates:** set to the test data's own flight dates. For the edge
  cases that is 23 and 30 Oct, so the Results header reads «23. okt. –
  30. okt.» and matches the cards. The standard fixture uses 7 and 14 Oct.
- **Edge runs:** the edge test data with 4 travellers in Bokmål and English,
  each at normal text and 135 % text (CSS zoom, an approximation, not
  Dynamic Type).
- **Short names:** the standard grouped journey `gtg_dy` (Gotogate,
  Norwegian) in Bokmål and English.
- **Split-word check:** the whole sellers card shown in a 375 × 3200
  viewport, and the detector run inside the card only.
- **Per seller:** each seller chosen in turn, recording the bar price and
  basis, the action's accessible name, the provider note, the checked bag
  and whether the Terms tab exists.

| Run (375 pt) | Split words before | Split words after | Price after (per row) | Card height before → after |
|---|---|---|---|---|
| Edge, nb | none | none | below / below / below | 646 → 600 pt |
| Edge, en | none | none | below / below / below | 752 → 618 pt |
| Edge, nb, 135 % text | «Testflyselskap», «Interkontinentale» | none | below / below / below | 1207 → 840 pt |
| Edge, en, 135 % text | «International», «Testflyselskap», «Interkontinentale» | none | below / below / below | 1450 → 883 pt |
| Short names, nb | none | none | right / right (unchanged) | 328 → 328 pt |
| Short names, en | none | none | right / right (unchanged) | 330 → 330 pt |

| Check | Result |
|---|---|
| No split words in the seller card: nb and en, normal and 135 % text | PASSED (after); FAILED before at 135 % |
| No clipped text in the seller card | PASSED (before and after) |
| Short-name card unchanged | PASSED. The before and after PNGs are byte-identical: nb `31581b795f85ec14…`, en `7bfa93efca185758…` (scratch files, not committed) |
| Choosing each seller: bar price and basis, action name, provider note, checked bag, Terms tab | PASSED; identical before and after in all six runs |
| Accessible name of every seller row | PASSED; identical before and after |

**How it works** (DESIGN.md, «Lukket i `be41be4`»):
- **Trigger.** The price moves below the bags line when the name wraps, or
  when the text column is narrower than 80 pt × the text scale. The longest
  fixed word, «Håndbagasje» at 12 pt, measures ~74 pt in Inter.
- **Where the decision lives.** In the screen, scoped to the text scale, so
  a tab switch does not show the old layout for a frame.
- **Text-size changes.** Rows and the bar amount are keyed by the text
  scale, so a text-size change gets a fresh measurement.

**Review.** An independent review (10 agents: three lenses, each finding
checked by a skeptic) confirmed six findings before commit. All are fixed
in `be41be4`:
- **Should-fix, live text size.** On a live Dynamic Type change, Fabric
  sends layout events before JS re-renders with the new scale, and does not
  re-send unchanged frames.
- **Minor, tab switch.** Returning to Overview showed the price at the
  right for one frame.
- **Test gaps** (one should-fix and three minor):
  - the name-trigger test could pass through the column handler;
  - the two-line threshold was not tested;
  - the price's position after the bags was not checked;
  - the reset on a text-size change was not tested.

The a11y-language tree test now also covers the price-below layout.

**Tests.** 218 pass (213 + 5), 3 staging tests skipped. Nine mutations of
the mechanism each fail at least one test: each trigger removed, a
2.5-line threshold, the column rule without scale, the price above the
name, the row key without scale, the bar key without scale, the decision
without scale, and the decision lost on tab switch.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `sellers-nb-be41be4-375-1-edge.png` | `47d02ba4c0dbb467…` | 1420×1499 |
| `sellers-en-be41be4-375-1-edge.png` | `2e9e87c2d89a6188…` | 1420×1711 |
| `sellers-nb-be41be4-375-2-edge-text135.png` | `04213ed351eb86b0…` | 1420×2644 |
| `sellers-en-be41be4-375-2-edge-text135.png` | `3db8500ae2f7aa34…` | 1420×3130 |
| `sellers-nb-be41be4-375-3-short-names.png` | `a8ea7161906ddd85…` | 1420×863 |

Each image shows before (left) and after (right), with the split words
the detector found and the price position per row.

Not checked here:
- An iPhone or simulator, and real Dynamic Type. The live text-size change
  path is covered by code tests only. VoiceOver was not run.
- The bar's price basis can still break between «1» and «spedbarn».
  That is ordinary wrapping.


## Requested flights and expiry (ad92afc)

Only the new states, captured from a clean worktree at `ad92afc` at 375 × 812 pt (safe area 50/34 pt), in Bokmål and English.

**Test data.** The standard demo test data, with `excluded: { count: 7, reasons: { origin: 2, destination: 2, date: 2, slices: 1 } }`, shaped as the mobile API returns it after exclusion. The filtering itself is proven by the server integration tests, not by these images. The form dates are set to the fixture's flight dates (7–14 Oct). For the expiry capture, `expiresAt` was set 40 s after the test data was written. The script opened Details, confirmed it still offered «Gå til tilbud» with no warning (expiry about 34 s ahead), then only waited.

| Check | nb | en | Result |
|---|---|---|---|
| Some held back: info line, remaining cards shown | «7 tilbud fra tilbyderen gjaldt ikke søket ditt (annen flyplass, annen dato, uten hjemreise) og vises ikke.»; 4 cards | «7 offers from the provider didn't match your search (different airport, different date, no return flight) and aren't shown.»; 4 cards | PASSED |
| All held back: truthful empty state, no cards | «Ingen reiser passet søket» + reasons + «Endre søk»; 0 cards | «No journeys matched your search» + reasons + «Edit search»; 0 cards | PASSED |
| Expired while open, with no interaction: warning, «Søk på nytt» primary, explicit continue link | before: «Gå til tilbud hos Norwegian», no warning; after: warning, «Søk på nytt», «Gå til Norwegian likevel» | before: «Go to offer at Norwegian»; after: warning, «Search again», «Continue to Norwegian anyway» | PASSED |

Covered by tests only, not by these images:
- **Server integration (`mobileFlights.it.ts`, with the real `runFlightSearch`).** The following are excluded and counted:
  - TRF instead of OSL, on the outbound or the return;
  - another destination;
  - another outbound or return date;
  - a missing return, or an extra leg on a one-way search;
  - a first segment from TRF while the slice summary says OSL.

  Kept: a layover airport change (LGW→LHR), exact kept offers, and click attribution. The web search is unchanged. The 3 exclusion tests fail on the old code.
- **App (`offerExpiry.test.tsx`).** It covers:
  - expiry while the screen is open, driven by a timer and no other re-render;
  - a tap after the clock passed expiry but before any redraw: nothing opens and nothing is tracked, and the warning shows;
  - background, then resume;
  - two sellers with different expiries;
  - «continue anyway» plus a double tap: exactly one browser and one tracking call;
  - on unmount, no timers remain and the AppState listener is removed.

  5 of the 6 fail on the old code.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `state-en-ad92afc-375-1-excluded-some.png` | `a9f7faeba0189c27…` | 750×1780 |
| `state-en-ad92afc-375-2-excluded-all.png` | `e0377133a49f03c4…` | 750×1780 |
| `state-en-ad92afc-375-3-expired-while-open.png` | `924a9d4ad4fc375a…` | 750×3185 |
| `state-nb-ad92afc-375-1-excluded-some.png` | `72b8069281d08f7a…` | 750×1780 |
| `state-nb-ad92afc-375-2-excluded-all.png` | `9971b465ecb7db7b…` | 750×1780 |
| `state-nb-ad92afc-375-3-expired-while-open.png` | `e619ff8560d36820…` | 750×3185 |

Not checked here: a device or simulator, real iOS backgrounding, VoiceOver, and real KAYAK data (staging answers with demo data). The response's `priceMode` metadata is still not checked (documented follow-up).

**Correction after review (next commit after `3be6295`).** The server's single «slices» reason covered a missing
leg, an extra leg and a leg with no flights. So «uten hjemreise» / «no return flight» in the notice above (and in the
`state-*-ad92afc-*` images) was not always true. It is now split into `missing_leg`, `extra_leg` and `incomplete`.
The app says «en strekning mangler» / «a missing leg», «en ekstra strekning» / «an extra leg» and «ufullstendige
flydata» / «incomplete flight data», without guessing which leg is missing. The images were not captured again;
the tests pin the new wording.


## Price basis: total only when KAYAK confirms it (d364212)

Captured from a clean worktree at `d364212`, at 375 × 812 pt (safe area 50/34), in Bokmål and English. The test data is the fictional edge-case offers with 2 adults, 1 child and 1 infant, marked as a KAYAK sandbox response. The price basis is set in the test data as the mobile API sends it:
- `{ kind: "unverified", reason: "per_person" }`: KAYAK answered perPerson for four travellers;
- `{ kind: "total" }`: KAYAK answered total for exactly these four.

The decision itself is proven by the server tests (`api/lib/priceBasis.test.ts`, `mobileFlights.it.ts`), not by these images. Source: KAYAK's current Flights Search API documentation, as reported by Codex from developers.kayak.com. This sandbox cannot reach that site.

| Check | nb | en | Result |
|---|---|---|---|
| Unconfirmed: card amount and label | «18 450 kr» · «Tilbyderens pris, total ikke bekreftet · Tur-retur» | «NOK 18,450» · «Provider's price, total not confirmed · Return» | PASSED |
| Unconfirmed: VoiceOver name of the card and the bar | «Pris 18 450 kroner, tilbyderens pris, total ikke bekreftet …» | «Price 18,450 Norwegian kroner, provider's price, total not confirmed …» | PASSED |
| Unconfirmed: notice on Results and Details | «Tilbyderen bekreftet ikke at prisene gjelder alle reisende. Sjekk totalprisen hos tilbyderen før du bestiller.» | «The provider didn't confirm that these prices cover all travellers. Check the total with the provider before you book.» | PASSED |
| Unconfirmed: sort label; price filter | «Laveste pris fra tilbyderen først»; no price filter | «Lowest provider price first»; no price filter | PASSED |
| Unconfirmed: «Totalt for» / «Total for» anywhere on Details | 0 | 0 | PASSED |
| Confirmed: same amount, «Totalt for …», no notice, price filter present | «18 450 kr» · «Totalt for 2 voksne, 1 barn, 1 spedbarn · Tur-retur» | «NOK 18,450» · «Total for 2 adults, 1 child, 1 infant · Return» | PASSED |

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `price-en-d364212-375-1-results-unconfirmed.png` | `f525c8299c266fac…` | 750×1832 |
| `price-en-d364212-375-2-details-unconfirmed.png` | `9c73fb082d8f4a62…` | 750×3979 |
| `price-en-d364212-375-3-results-confirmed.png` | `5e96f6c185a49581…` | 750×1803 |
| `price-nb-d364212-375-1-results-unconfirmed.png` | `ca56d491fe0fa748…` | 750×1832 |
| `price-nb-d364212-375-2-details-unconfirmed.png` | `2cf8154b917127d9…` | 750×3979 |
| `price-nb-d364212-375-3-results-confirmed.png` | `28343d780612e5fd…` | 750×1803 |

Not checked here: a live KAYAK response with several travellers, in sandbox or production (staging answers with demo data). A device or simulator. VoiceOver itself.


## Hotels: status, search, results, details (4ffbea1)

Captured from a clean worktree at `4ffbea1`. Sizes: 375 × 812 pt and 390 × 812 pt (safe area 50/34). Languages: Bokmål (fresh install) and English (the saved choice). The test data is fictional: hotels, names, amounts and links come from `src/test/hotelFixtures.ts`, served by a fake `/api/mobile/trpc`. All other network traffic is blocked, including the fixture's hotel photo URL, so the photo placeholder reads «couldn't load». Loading, error and sandbox states are captured at 375 pt only.

| Check (from the capture run's report) | nb | en | Result |
|---|---|---|---|
| Home switch | «Fly Hotell» | «Flights Hotels» | PASSED |
| Search request (both widths) | no `currency`; `language: "nb"`; `rooms: [{adults: 2}]` | the same with `language: "en"` | PASSED |
| Results card (cheapest of two providers) | «Fra 3 639 kr» · «Totalt for oppholdet · 3 netter» | «From NOK 3,639» · «Total for the stay · 3 nights» | PASSED |
| Live production detail: «Gå til/Go to» buttons | 2 | 2 | PASSED |
| Sandbox detail: booking buttons / blocked rows | 0 / 2 | 0 / 2 | PASSED |
| Disabled: form shown / API calls made | 0 / `hotels.status` only | 0 / `hotels.status` only | PASSED |

These images do not prove the behaviour; the tests do: `api/test/mobileHotels.it.ts`, `mobileClient.it.ts`, `mobileAccount.it.ts`, `src/__tests__/hotels.test.tsx` and `src/lib/__tests__/hotels.test.ts`.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `hotel-en-4ffbea1-375-1-home.png` | `46e7242eb7518291…` | 750×1780 |
| `hotel-en-4ffbea1-375-2-form.png` | `86a35db917827225…` | 750×1809 |
| `hotel-en-4ffbea1-375-3-results.png` | `b02d452dcf4353c3…` | 750×1809 |
| `hotel-en-4ffbea1-375-4-detail.png` | `47e81e70ea2d2a26…` | 750×3185 |
| `hotel-en-4ffbea1-375-5-disabled.png` | `715f1bc8da5a5308…` | 750×1809 |
| `hotel-en-4ffbea1-375-6-loading.png` | `45e7b3e4ffdf6998…` | 750×1780 |
| `hotel-en-4ffbea1-375-7-error.png` | `00f4b5a95335d928…` | 750×1780 |
| `hotel-en-4ffbea1-375-8-sandbox-detail.png` | `3f212c35805adc0d…` | 750×3156 |
| `hotel-en-4ffbea1-390-1-home.png` | `13ee6703d26196e2…` | 780×1780 |
| `hotel-en-4ffbea1-390-2-form.png` | `9847d662c08a6c1f…` | 780×1809 |
| `hotel-en-4ffbea1-390-3-results.png` | `b6eb22e94820f99a…` | 780×1809 |
| `hotel-en-4ffbea1-390-4-detail.png` | `94481c47e20d44d0…` | 780×3185 |
| `hotel-en-4ffbea1-390-5-disabled.png` | `6138b097eebeca04…` | 780×1809 |
| `hotel-nb-4ffbea1-375-1-home.png` | `6ef0bb644051683f…` | 750×1780 |
| `hotel-nb-4ffbea1-375-2-form.png` | `458192b0d50e4fda…` | 750×1809 |
| `hotel-nb-4ffbea1-375-3-results.png` | `b83b7e2778db76cc…` | 750×1809 |
| `hotel-nb-4ffbea1-375-4-detail.png` | `34a1add1c70a34b0…` | 750×3185 |
| `hotel-nb-4ffbea1-375-5-disabled.png` | `1220f2906bf08bec…` | 750×1809 |
| `hotel-nb-4ffbea1-375-6-loading.png` | `76ebb33257fdc686…` | 750×1780 |
| `hotel-nb-4ffbea1-375-7-error.png` | `5b5885c2927d7789…` | 750×1780 |
| `hotel-nb-4ffbea1-375-8-sandbox-detail.png` | `cd9d9942907c995b…` | 750×3156 |
| `hotel-nb-4ffbea1-390-1-home.png` | `95b55bc5d1ae0ad6…` | 780×1780 |
| `hotel-nb-4ffbea1-390-2-form.png` | `399bc332a79a1c30…` | 780×1809 |
| `hotel-nb-4ffbea1-390-3-results.png` | `56e9784c6eca68d1…` | 780×1809 |
| `hotel-nb-4ffbea1-390-4-detail.png` | `c75c5f3adb553a19…` | 780×3185 |
| `hotel-nb-4ffbea1-390-5-disabled.png` | `1b61ed9b9fcec3d9…` | 780×1809 |

Not checked here:
- real KAYAK Hotels data, in sandbox or production. Hotel search is not enabled in this environment, and KAYAK's hotel documentation was not reachable from this sandbox.
- whether a multi-room `totalRate` covers every room. The app tells the customer to check this with the provider.
- a device or simulator, and VoiceOver itself.
- the hellosky.no/hotell-bil request form. That page is the existing website form, which is Norwegian only.


## Utforsk: world map of destinations (12be988)

**Native iOS status: NOT TESTED.** No Mac, Xcode or iOS simulator is available here, so Apple Maps (MapKit) has not been rendered, tapped or checked with VoiceOver.

What is verified:
- `expo export --platform ios` bundles the native map (`RNMapsMapView` and `RNMapsMarker` are in the Hermes bundle; the web fallback's marker `destination-map-fallback` is not).
- Jest tests (`src/__tests__/exploreMap.test.tsx`, with react-native-maps replaced by Views) cover:
  - the List/Map switch;
  - one pin per destination, labelled «reisemål»;
  - the fit to all pins;
  - the pin card, and «Se flyreiser» calling runSearch with only the destination changed;
  - the same-airport validation;
  - English;
  - that the web fallback never imports react-native-maps.

Map and data sources:
- **Map:** react-native-maps 1.27.2 (MIT), the version Expo SDK 57 bundles. On iOS it uses the default provider, Apple MapKit: no Google Maps, no API key, no third-party tiles, no location.
- **Pin coordinates:** the exact airport of each destination's `iata`, copied from the repo's OurAirports register `api/data/airports-meta.json` (public domain). The test checks them against that file to 4 decimals.

The images below are the **web fallback** (`DestinationMap.tsx`) rendered in Chromium. They show the switch, the note, the pin card and the layout at 375/390/430 pt in both languages, plus 375 pt at 135 % text (approximation). They are not a picture of the native map. On iOS the map takes the fallback list's place.

| Check (from the capture report) | nb | en | Result |
|---|---|---|---|
| Pin card airport line | «Barcelona-El Prat (BCN)» | «Barcelona–El Prat (BCN)» | PASSED |
| Card inside the width; horizontal overflow (375/390/430, and 375 at 135 %) | yes; 0 px | yes; 0 px | PASSED |
| «Se flyreiser» / «See flights» above the tab bar | 693 ≤ 730 px | 693 ≤ 730 px | PASSED |
| After the tap: route and API calls | `/resultater`; one `flights.search` | the same | PASSED |
| Tab selection exposed as `aria-selected` in the web rendering | not set | not set | NOT SHOWN on web (the Jest test confirms the selected state) |

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `map-en-12be988-375-1-list.png` | `45213ccb000090a7…` | 750×1803 |
| `map-en-12be988-375-2-map-fallback.png` | `6379951eda138001…` | 750×1803 |
| `map-en-12be988-375-3-pin-card.png` | `a2088ab35f9df353…` | 750×1832 |
| `map-en-12be988-375-4-pin-card-scrolled.png` | `a274b3e9d4bafa31…` | 750×1803 |
| `map-en-12be988-390-1-list.png` | `73d043fa4c706d06…` | 780×1780 |
| `map-en-12be988-390-2-map-fallback.png` | `5d9113d02d74112f…` | 780×1780 |
| `map-en-12be988-390-3-pin-card.png` | `626984f221f29b93…` | 780×1780 |
| `map-en-12be988-390-4-pin-card-scrolled.png` | `a01ecf00df77819b…` | 780×1780 |
| `map-en-12be988-430-1-list.png` | `51bbeac676e6cc62…` | 860×1780 |
| `map-en-12be988-430-2-map-fallback.png` | `b0dc75284b8c4523…` | 860×1780 |
| `map-en-12be988-430-3-pin-card.png` | `80c0e6bff277e86f…` | 860×1780 |
| `map-en-12be988-430-4-pin-card-scrolled.png` | `c1cf23ffd576ede1…` | 860×1780 |
| `map-nb-12be988-375-1-list.png` | `e762d4a5b7f9c0f7…` | 750×1803 |
| `map-nb-12be988-375-2-map-fallback.png` | `b44165aead4b3ece…` | 750×1803 |
| `map-nb-12be988-375-3-pin-card.png` | `c9ddf4524125e586…` | 750×1832 |
| `map-nb-12be988-375-4-pin-card-scrolled.png` | `a5a2beb1c4f4b118…` | 750×1803 |
| `map-nb-12be988-375-large-1-list.png` | `e2c63ad128621905…` | 750×1803 |
| `map-nb-12be988-375-large-2-map-fallback.png` | `29aa21117f4ffb76…` | 750×1832 |
| `map-nb-12be988-375-large-3-pin-card.png` | `6598e9796db6548c…` | 750×1832 |
| `map-nb-12be988-375-large-4-pin-card-scrolled.png` | `7acba070fe02246a…` | 750×1832 |
| `map-nb-12be988-390-1-list.png` | `66c6fd4527e7b0e4…` | 780×1780 |
| `map-nb-12be988-390-2-map-fallback.png` | `4663ab6c549ccb3f…` | 780×1780 |
| `map-nb-12be988-390-3-pin-card.png` | `b3de6c06f5f7185c…` | 780×1780 |
| `map-nb-12be988-390-4-pin-card-scrolled.png` | `0c57d0d29c7ffa16…` | 780×1780 |
| `map-nb-12be988-430-1-list.png` | `9a9419e29bc4ba38…` | 860×1780 |
| `map-nb-12be988-430-2-map-fallback.png` | `ada7b32885852cae…` | 860×1780 |
| `map-nb-12be988-430-3-pin-card.png` | `c3f3f02c5c226e49…` | 860×1780 |
| `map-nb-12be988-430-4-pin-card-scrolled.png` | `63322d4224535dd9…` | 860×1780 |

Remaining:
- the native MapKit rendering, pin taps, the fit-to-pins, dark style and VoiceOver on a device or simulator;
- `expo-doctor` / `expo install --check` with react-native-maps (blocked by the proxy here; CI runs them);
- a native iPhone check. Expo SDK 57 includes `react-native-maps` 1.27.2 in a matching Expo Go app, so Expo Go is a possible test route for this map; an EAS development build is another route. Neither has been run for this stage.


## Profile: Google/Apple sign-in readiness (44493f5), live sign-in BLOCKED

| Level | Status |
|---|---|
| Code-only | provider capabilities (`mobileAuth.providers`); gated Profile buttons; token → `exchangeSocialToken` → SecureStore wiring; handoff in `docs/social-login-handoff.md` |
| Fixture-tested | unit and env tests (`api/lib/mobileSocial.test.ts`, `api/test/mobileSocialEnv.test.ts`); the staff check and app client contract against the real server with no Clerk (`mobileAccount.it.ts`, `mobileClient.it.ts`); app state and UI with a fake adapter (`src/__tests__/socialAuth.test.tsx`); the screenshots below |
| Real-provider-tested | **NO.** Clerk's Expo SDK needs Native API and the mobile SSO redirect allowlist in the Clerk Dashboard. Neither has been changed, so no Clerk token was ever produced by the app. |
| Native-device-tested | **NO.** No iPhone or simulator; this build has no native sign-in flow. |

Two sets of images, all web renderings (Chromium) at 375/390/430 pt in both languages:
- **REAL BUILD GATE** (green caption): this commit's code, with the server answering like production today. No Google/Apple buttons.
- **FIXTURE ONLY** (amber caption): a scratch-only preview shim (not committed, not Clerk) replaces the native adapter so the gated UI can be seen. It shows the Google button, the busy state and cancellation. Two 375 pt images show Google and Apple together, as a layout check only.

| Check (from the capture reports) | real | fixture | Result |
|---|---|---|---|
| Social buttons shown | none | Google (and Apple in «both») | PASSED |
| Email/password form present | yes | yes | PASSED |
| `mobileAuth.providers` called before Profile opens | 0 | 0 | PASSED |
| Authorization header on `mobileAuth.providers` | none | none | PASSED |
| Busy label / cancel note (nb) | – | «Logger inn med Google …» / «Innloggingen ble avbrutt. Ingenting er endret.» | PASSED |
| Busy label / cancel note (en) | – | «Signing in with Google …» / «Sign-in was cancelled. Nothing was changed.» | PASSED |
| `exchangeSocialToken` calls after cancel | – | 0 | PASSED |

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `auth-en-44493f5-375-fixture-both-1-signed-out.png` | `68dc7850b8111902…` | 750×1832 |
| `auth-en-44493f5-375-fixture-google-1-signed-out.png` | `f4d082db84fa4041…` | 750×1803 |
| `auth-en-44493f5-375-fixture-google-2-busy.png` | `c2bdbef4c7c2cbd0…` | 750×1803 |
| `auth-en-44493f5-375-fixture-google-3-cancelled.png` | `2034e18220dba7e9…` | 750×1803 |
| `auth-en-44493f5-375-real-1-signed-out.png` | `90e9ef06808f47ff…` | 750×1803 |
| `auth-en-44493f5-390-fixture-google-1-signed-out.png` | `109dc2e1ac9640c5…` | 780×1803 |
| `auth-en-44493f5-390-fixture-google-2-busy.png` | `aaa2d0e4e83d38ea…` | 780×1803 |
| `auth-en-44493f5-390-fixture-google-3-cancelled.png` | `5da954c73aaf2e3d…` | 780×1803 |
| `auth-en-44493f5-390-real-1-signed-out.png` | `e538073e6145ded7…` | 780×1803 |
| `auth-en-44493f5-430-fixture-google-1-signed-out.png` | `63594d54ad371231…` | 860×1780 |
| `auth-en-44493f5-430-fixture-google-2-busy.png` | `e0c653dd9d4ae107…` | 860×1780 |
| `auth-en-44493f5-430-fixture-google-3-cancelled.png` | `437d99924b1be207…` | 860×1780 |
| `auth-en-44493f5-430-real-1-signed-out.png` | `bffda6eead6276c4…` | 860×1780 |
| `auth-nb-44493f5-375-fixture-both-1-signed-out.png` | `e56263d2d5198130…` | 750×1832 |
| `auth-nb-44493f5-375-fixture-google-1-signed-out.png` | `328da14949aa6ea5…` | 750×1803 |
| `auth-nb-44493f5-375-fixture-google-2-busy.png` | `6702e8a5d5a02c02…` | 750×1803 |
| `auth-nb-44493f5-375-fixture-google-3-cancelled.png` | `86e70f9a2402c35f…` | 750×1803 |
| `auth-nb-44493f5-375-real-1-signed-out.png` | `27771aa75f9a50a6…` | 750×1803 |
| `auth-nb-44493f5-390-fixture-google-1-signed-out.png` | `ca89b7e7899d5e3e…` | 780×1803 |
| `auth-nb-44493f5-390-fixture-google-2-busy.png` | `f3e42f0989f30d15…` | 780×1803 |
| `auth-nb-44493f5-390-fixture-google-3-cancelled.png` | `599faa8e83c2d56f…` | 780×1803 |
| `auth-nb-44493f5-390-real-1-signed-out.png` | `2ba13cad859cf77b…` | 780×1803 |
| `auth-nb-44493f5-430-fixture-google-1-signed-out.png` | `1e7a7ea854569ebc…` | 860×1780 |
| `auth-nb-44493f5-430-fixture-google-2-busy.png` | `1f016e99aa23dc87…` | 860×1780 |
| `auth-nb-44493f5-430-fixture-google-3-cancelled.png` | `db45b5c49edd83bb…` | 860×1780 |
| `auth-nb-44493f5-430-real-1-signed-out.png` | `eddad57211743ad8…` | 860×1780 |


## Clerk Google sign-in adapter (eac3e73): gated off, NOT live-tested

| Level | Status |
|---|---|
| Code | Google via `@clerk/expo` 4.6.9 `useSSO` (`oauth_google`, redirect `hellosky://sso-callback`) → `getToken` → `exchangeSocialToken` → HelloSky session in SecureStore → `clerk.signOut`. Apple is unsupported in this build (Sign in with Apple entitlement not present). |
| Bundle | `expo export --platform ios` contains the Clerk flow (`oauth_google`, `hellosky://sso-callback`, `clerk_not_ready`, `sso_incomplete`); the web fallback string is absent. `check:bundle` passes with the tightened key check (a key-shaped `sk_live_`/`sk_test_` value still fails it). |
| Jest (Clerk mocked) | `src/__tests__/clerkSocial.test.tsx` (11) and `socialAuth.test.tsx` (10): gating, lazy Clerk loading, file resolution, redirect URI, success, cancel, incomplete, refused exchange (Clerk still signed out), duplicate taps. |
| Real Clerk / Google | **NOT TESTED.** No Clerk instance has the redirect allowlisted, staging has no Clerk configuration, and `MOBILE_CLERK_NATIVE_PROVIDERS` is unset everywhere. |
| Native iPhone | **NOT TESTED.** No device or simulator, and no EAS development build. |

The images below are **non-native browser renderings** at 375/390/430 pt in Bokmål and English.
- **Green captions:** the browser build does not show Google even when the fixture server says Google is available.
- **Amber captions:** a scratch-only fake adapter (not Clerk) shows the gated layout, busy state and cancel message.
- Neither set shows the iOS Clerk flow.

| Check (capture reports) | browser build | fixture | Result |
|---|---|---|---|
| Social buttons with server = Google available | none | Google | PASSED |
| Email/password form present | yes | yes | PASSED |
| `mobileAuth.providers` before Profile opens / token on it | 0 / none | 0 / none | PASSED |
| Requests to hosts other than the fake API | 0 | 0 | PASSED |
| Exchange calls after cancel | – | 0 | PASSED |

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `clerk-en-eac3e73-375-fixture-both-1-signed-out.png` | `4de35aca42b8761c…` | 750×1832 |
| `clerk-en-eac3e73-375-fixture-google-1-signed-out.png` | `122a1e6869dbace2…` | 750×1803 |
| `clerk-en-eac3e73-375-fixture-google-2-busy.png` | `6576ad1db4ff5877…` | 750×1803 |
| `clerk-en-eac3e73-375-fixture-google-3-cancelled.png` | `aaa5641bccc2806d…` | 750×1803 |
| `clerk-en-eac3e73-375-real-1-signed-out.png` | `87880d69eb3d9d02…` | 750×1803 |
| `clerk-en-eac3e73-390-fixture-google-1-signed-out.png` | `0264c6290d03923f…` | 780×1803 |
| `clerk-en-eac3e73-390-fixture-google-2-busy.png` | `c54c1d57b237033a…` | 780×1803 |
| `clerk-en-eac3e73-390-fixture-google-3-cancelled.png` | `80cc1f5837c0ecd4…` | 780×1803 |
| `clerk-en-eac3e73-390-real-1-signed-out.png` | `65e28e2148d95cb5…` | 780×1803 |
| `clerk-en-eac3e73-430-fixture-google-1-signed-out.png` | `058cc6130085bc2a…` | 860×1780 |
| `clerk-en-eac3e73-430-fixture-google-2-busy.png` | `01c527b01c00ad29…` | 860×1780 |
| `clerk-en-eac3e73-430-fixture-google-3-cancelled.png` | `cc346cc60c86d467…` | 860×1780 |
| `clerk-en-eac3e73-430-real-1-signed-out.png` | `831e368ea538939b…` | 860×1803 |
| `clerk-nb-eac3e73-375-fixture-both-1-signed-out.png` | `72894f97b55ff1dd…` | 750×1803 |
| `clerk-nb-eac3e73-375-fixture-google-1-signed-out.png` | `65f48b6c7fea2964…` | 750×1803 |
| `clerk-nb-eac3e73-375-fixture-google-2-busy.png` | `e4bb2033469b49f0…` | 750×1803 |
| `clerk-nb-eac3e73-375-fixture-google-3-cancelled.png` | `52dbae1e08969129…` | 750×1803 |
| `clerk-nb-eac3e73-375-real-1-signed-out.png` | `b56bf9d1095c4df0…` | 750×1803 |
| `clerk-nb-eac3e73-390-fixture-google-1-signed-out.png` | `2ee7f61652c54d86…` | 780×1803 |
| `clerk-nb-eac3e73-390-fixture-google-2-busy.png` | `bf5cf469eeae6056…` | 780×1803 |
| `clerk-nb-eac3e73-390-fixture-google-3-cancelled.png` | `4c4cda18ec65f992…` | 780×1803 |
| `clerk-nb-eac3e73-390-real-1-signed-out.png` | `abd7625e8988ece1…` | 780×1803 |
| `clerk-nb-eac3e73-430-fixture-google-1-signed-out.png` | `e7577f7eb469b6e6…` | 860×1780 |
| `clerk-nb-eac3e73-430-fixture-google-2-busy.png` | `e46db9e861981c8e…` | 860×1780 |
| `clerk-nb-eac3e73-430-fixture-google-3-cancelled.png` | `d5a9a23067034d9a…` | 860×1780 |
| `clerk-nb-eac3e73-430-real-1-signed-out.png` | `07a58bf6777d377d…` | 860×1803 |

## Airport picker with the keyboard open (browser approximation)

**NON-NATIVE.** These are Chromium renderings of Expo web, not an iPhone.
The keyboard is simulated by cutting the viewport to 476 pt, which is 812 pt minus a typical keyboard of about 336 pt.
The images cannot show iOS keyboard insets (`automaticallyAdjustKeyboardInsets`); that prop has no effect on web.
They show only the layout that decides what can be scrolled into view above the keyboard.

- **Code.** "Before" is `flyplass.tsx` at `736ec7e`. "After" is the working tree committed with this section (blob `a5261f21`).
- **Data.** Demo data served by an in-browser fake API. The query `no` returns 12 real Norwegian airports; `zzz` returns none.
- **Checks passed at 375, 390 and 430 pt, and at 375 pt with 135 % text.** The capture script checked each of these in every run (after mode):
  - the last suggestion and the last result can be scrolled into view above the simulated keyboard and clicked;
  - "Tøm søket" can be reached and clicked;
  - choosing TRF puts TRF (not OSL) in the origin field.
- **The difference, at 375 pt with 135 % text.**
  - Before: the caption and the "Husk" row stay pinned under the search field, so one result row fits above the simulated keyboard.
  - After: they scroll away with the list, so about three rows fit.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `kbd-after-375-large-results-end.png` | `497c3440265b0ce1…` | 750×1076 |
| `kbd-after-375-large-suggestions.png` | `24c5055c04f3606d…` | 750×1076 |
| `kbd-after-375-no-results.png` | `df7b11f040b1688e…` | 750×1076 |
| `kbd-after-390-results-end.png` | `6fc27cf6b0f66e93…` | 780×1076 |
| `kbd-after-430-suggestions-end.png` | `85c8d1f9fcf662a8…` | 860×1076 |
| `kbd-before-736ec7e-375-large-results-end.png` | `57d01e1595296567…` | 750×1076 |

## Explore map on iPhone: areas, decluttered pins, card over the map (browser approximation)

**NON-NATIVE: not Apple Maps and not an iPhone.** The iPhone component (`DestinationMap.ios.tsx`) runs in Chromium (Expo web). A scratch-only stand-in replaces `react-native-maps`:
- a dark 10° grid, with no map tiles, coastlines or Apple branding;
- pins placed by the app's own `src/lib/mapGeometry.ts` (Web Mercator);
- a line of text showing where Apple's logo and "Juridisk" (Legal) label would sit.

The stand-in, the web switch to the iPhone branch and the preview text scale exist only in the scratch copy, not in the repository. Real MapKit rendering, gestures, animation and VoiceOver on a device are **not** shown here.

- **Before** is the map code at `fa4066c`, which the user installed.
- **After** is the commit that adds this section. It corrects `1883e5c`: that commit let pins overlap the selected pin, and Tromsø stretched its Europe view.
- Destinations come from the app's own data. Nothing is fetched and there are no prices.

What the capture measured in every after run (375, 390 and 430 pt in Norwegian, 390 pt in English, 375 pt at 135 % text). Each run covers seven states: opened, Barcelona selected, Tromsø via its button, London selected, Midtøsten, group tapped, and whole world.
- **No overlaps:** no two visible pins, groups or buttons overlap; 0 across 35 states.
- **Card:** the map frame keeps its height when the card opens (445/445/461/445/400 pt), and the selected pin stays above the card.
- **Tromsø:** tapping "↑ Tromsø (TOS)" opens the card for Tromsø lufthavn (TOS).
- **Nothing sent:** no search or other network call is made.

**Known limit (375 pt, 135 % text):** London is reached through its group; after that zoom, Paris is already a separate pin. Once London is selected, Paris sits behind the card. It is a separate pin and appears when the card closes.

**Before (`fa4066c`, 390 pt):**
- all 24 airports are fitted into one view;
- a click at the centre of the Barcelona pin selected **Málaga**, because another pin covered it;
- the card shrank the map from 501 to 271 pt.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `map-before-fa4066c-390-1-all-24.png` | `3bc8e28e28a15a29…` | 780×1773 |
| `map-before-fa4066c-390-2-click-bcn-selects-agp.png` | `21f84594b7833958…` | 780×1798 |
| `map-after-375-1-europe.png` | `d76ff9d77bbb8c72…` | 750×1798 |
| `map-after-375-2-selected-bcn.png` | `53a889576926fb94…` | 750×1798 |
| `map-after-375-3-tromso.png` | `218751307a90d447…` | 750×1798 |
| `map-after-375-4-selected-lhr.png` | `1231dbe2fe0d5f20…` | 750×1798 |
| `map-after-375-large-1-europe.png` | `7ae81539f54965f4…` | 750×1798 |
| `map-after-375-large-2-selected-bcn.png` | `2a8d74e0c34af7b8…` | 750×1773 |
| `map-after-375-large-4-selected-lhr.png` | `0838573d56cd2bd0…` | 750×1798 |
| `map-after-390-1-europe.png` | `98250deb2a0c82f2…` | 780×1798 |
| `map-after-390-2-selected-bcn.png` | `5c35f56879c86a7e…` | 780×1798 |
| `map-after-390-3-tromso.png` | `d4b1c2e3b701eb59…` | 780×1773 |
| `map-after-390-4-selected-lhr.png` | `3cc40609a569913d…` | 780×1773 |
| `map-after-390-5-middle-east.png` | `e01788d3c150b21b…` | 780×1773 |
| `map-after-390-6-group-tapped.png` | `6399dbf53f0b08c9…` | 780×1773 |
| `map-after-390-7-world.png` | `502fc8b53887d167…` | 780×1773 |
| `map-after-430-1-europe.png` | `ca74685bb82ddf23…` | 860×1798 |
| `map-after-430-2-selected-bcn.png` | `6b2944dd39fa445d…` | 860×1773 |
| `map-after-430-3-tromso.png` | `62e104f375082841…` | 860×1773 |
| `map-after-en-390-1-europe.png` | `eb1346265b638501…` | 780×1773 |

## Home first view: compact photo header (browser preview)

**NON-NATIVE: not an iPhone.** These are Chromium renderings of Expo web. Safe areas are simulated (top/bottom pt: 375×812 → 50/34, 390×844 → 47/34, 430×932 → 59/34), system fonts are replaced by Inter, and large text is a 135 % browser zoom of text only. The "Hjem" tab bar is measured from its top edge. Nothing is fetched and there are no prices.

- **Before** is `20e3cc8`.
- **After** is the commit that adds this section.

| Viewport | Hero before → after | «Søk fly» bottom before → after | Tab bar top | First destination card visible before → after |
|---|---|---|---|---|
| 375×812 | 252 → 198 | 610 → 556 | 726 | 34 → 92 of 132 |
| 390×844 | 249 → 195 | 607 → 553 | 758 | 69 → 127 of 132 |
| 430×932 | 261 → 207 | 619 → 565 | 846 | 132 → 132 (fully visible) |
| 390×844, text 135 % | 255 → 195 | 657 → 597 | 758 | 13 → 77 of 132 |

In every capture, route, dates, travellers/class and «Søk fly» are fully above the tab bar, both before and after.

After the change:
- no touch target in the first view is under 44 pt;
- the smallest text is 11 pt, as before (the caption style);
- no network call leaves the preview.

**What changed:**
- the photo header is lower;
- the headline uses the 22 pt title style instead of 28 pt;
- the generic time-of-day greeting is shown only with a name (signed in);
- the white sheet has tighter spacing;
- the account button and the Fly/Hotell chips are a full 44 pt.

**Tradeoff:** the full-size Fly/Hotell chips cost 8 pt of the destination teaser (135 → 127 pt at 390).

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `home-first-view-after-375.png` | `d9bc142e84bc29aa…` | 750×1798 |
| `home-first-view-after-390-large.png` | `c3dfce217521d464…` | 780×1862 |
| `home-first-view-after-390.png` | `b75d1e4435e02148…` | 780×1862 |
| `home-first-view-after-430.png` | `58c7cebebd21b2a4…` | 860×2013 |
| `home-first-view-before-375.png` | `d487c85c02147e55…` | 750×1798 |
| `home-first-view-before-390-large.png` | `1f460fb3fc8d8808…` | 780×1862 |
| `home-first-view-before-390.png` | `0b6c4eff4d509fdb…` | 780×1862 |
| `home-first-view-before-430.png` | `b2205cf5cbf7cf89…` | 860×2013 |

## Lagret (Saved) tab and four-tab navigation (browser preview)

**NON-NATIVE: not an iPhone.** These are Chromium renderings of Expo web:
- safe areas are simulated (375×812 → 50/34, 390×844 → 47/34, 430×932 → 59/34);
- Inter replaces the system font;
- large text is a 135 % browser zoom of text only;
- offers are not fetched (the preview API answers 503), and no prices appear.

**Versions:** before is `6971bbe`; after is the commit that adds this section. Images are JPEG (quality 82).

**Flow captured at each size:**
1. Home.
2. Explore: save Barcelona (BCN) and Tromsø (TOS).
3. Lagret.
4. Home → tap the Barcelona card (one search) → back to Home.
5. Lagret again.

**Measured in every after run (375, 390, 430 and 390 at 135 %):**
- **Tabs:** four tabs, each 48 pt tall (94 / 98 / 108 pt wide), with no clipped labels.
- **Safe area:** the bar ends 34 pt above the screen bottom, above the simulated home indicator.
- **Selected tab:** exactly one, matching the screen (Hjem, Utforsk, Lagret).
- **Nothing sent:** no blocked outbound request.

| Viewport | One recent search on Home, before | Destination card visible after one search, before | Home first view after (card visible) |
|---|---|---|---|
| 375×812 | 122 pt block | 7 of 132 | 92 of 132 (unchanged) |
| 390×844 | 122 pt block | 7 of 132 | 127 of 132 (unchanged) |
| 430×932 | 122 pt block | 73 of 132 | 132 of 132 |
| 390×844, 135 % | 141 pt block | 0 of 132 | 77 of 132 |

After the change, a search adds nothing to Home; recent searches are listed in Lagret.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `saved-after-375-1-home.jpg` | `199d3d17f7575eff…` | 750×1823 |
| `saved-after-375-2-explore.jpg` | `2c5d9bc6369721e3…` | 750×1798 |
| `saved-after-375-3-lagret.jpg` | `5271fd98d9140ceb…` | 750×1798 |
| `saved-after-390-1-home.jpg` | `1a713317919c391c…` | 780×1887 |
| `saved-after-390-2-explore.jpg` | `5470eaf5de52cb65…` | 780×1862 |
| `saved-after-390-3-lagret.jpg` | `bb48e45454d76d83…` | 780×1862 |
| `saved-after-390-large-1-home.jpg` | `ed471d81f30393c3…` | 780×1887 |
| `saved-after-390-large-2-explore.jpg` | `b80d25fe6ac4b2be…` | 780×1862 |
| `saved-after-390-large-3-lagret.jpg` | `36f4451e238d0d34…` | 780×1862 |
| `saved-after-430-1-home.jpg` | `e459e4b35a95d98c…` | 860×2038 |
| `saved-after-430-2-explore.jpg` | `b9ca6cabf6de409b…` | 860×2038 |
| `saved-after-430-3-lagret.jpg` | `e7b6b886703dabe5…` | 860×2038 |
| `saved-before-375-home-after-one-search.jpg` | `aea8dc9bafcfdafd…` | 750×1798 |
| `saved-before-390-home-after-one-search.jpg` | `459ba7b37922eb8b…` | 780×1862 |
| `saved-before-390-large-home-after-one-search.jpg` | `9e8b81f6c93cf353…` | 780×1862 |
| `saved-before-430-home-after-one-search.jpg` | `5f9993f82b6d4014…` | 860×2038 |

## Lagret, compacted (browser preview)

**NON-NATIVE: not an iPhone.** These are Chromium renderings of Expo web, measured with the same flow as the saved-* set: save Tromsø and Barcelona in Explore, run one search from Home, then open Lagret. Positions are the top–bottom edge in pt from the top of the screen.

- **Before** is `a784b68`.
- **After** is the commit that adds this section.
- Images are JPEG (quality 82).

| Viewport | Note before → after | Saved row height before → after | First recent row before → after | Tab bar top |
|---|---|---|---|---|
| 375×812 | 102–200 (boxed) → 108–126 (one line) | 124 → 74–75 | 572–706 → 395–506 | 726 |
| 390×844 | 99–197 → 105–123 | 124 → 74–75 | 569–703 → 392–503 | 758 |
| 430×932 | 111–209 → 117–135 | 124 → 74–75 | 581–715 → 404–497 | 846 |
| 390×844, 135 % | 99–246 → 105–154 | 130 → 93–95 | 629–783 (cut by tab bar) → 462–605 (fully visible) | 758 |

With «Om Lagret» open (the full explanation), the first recent row is still fully visible: 470–581 at 390 pt and 591–734 at 135 %.

Every control is at least 44 pt (the row buttons are ≥ 74 pt tall). No outbound request left the preview.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `lagret-after-375.jpg` | `29fbed2bc8210e8d…` | 750×1823 |
| `lagret-after-390-info-open.jpg` | `7e1e3527e5190643…` | 780×1862 |
| `lagret-after-390-large-info-open.jpg` | `382ae3cc0a3b07a6…` | 780×1887 |
| `lagret-after-390-large.jpg` | `37a657c9873f3b32…` | 780×1862 |
| `lagret-after-390.jpg` | `72b84edd1a29a69b…` | 780×1862 |
| `lagret-after-430.jpg` | `4da2e575c051eb17…` | 860×2038 |
| `lagret-before-375.jpg` | `cc65bc4e6426d884…` | 750×1823 |
| `lagret-before-390-large.jpg` | `9fd02724168b099d…` | 780×1887 |
| `lagret-before-390.jpg` | `4bd00eb69c3178e4…` | 780×1862 |
| `lagret-before-430.jpg` | `691b1ead8bb8ed18…` | 860×2038 |

## Explore: destination search (browser preview)

**NON-NATIVE: not an iPhone.** These are Chromium renderings of Expo web:
- no keyboard is shown, and the orange ring is Chromium's focus outline;
- Inter replaces the system font, and large text is a 135 % browser zoom;
- the browser shows the map as its list fallback, so pin clustering and fitting are covered by Jest only.

**Versions:** before is `d0c01e9`; after is the commit that adds this section. Images are JPEG (quality 82).

**Search scope:** only the 24 curated destinations, never other places, prices or availability. A query matches:
- the city, country and exact airport name, in Bokmål and English;
- the destination's own IATA code.

| Viewport | First card before → after | Cards fully visible before → after | Search input / clear |
|---|---|---|---|
| 375×812 | 192 → 248 | 6 → 4 | 303×44 / 44×44 |
| 390×844 | 189 → 245 | 6 → 4 | 318×44 / 44×44 |
| 430×932 | 201 → 257 | 6 → 4 | 358×44 / 44×44 |
| 390×844, 135 % | 195 → 251 | 6 → 4 | 318×44 / 44×44 |

**Measured searches (same at every size):**
- «tromso» → 1 of 24 (Tromsø);
- «lhr» → 1 of 24 (London Heathrow Airport (LHR));
- «spain» in the Bokmål UI → 2 of 24 (Barcelona BCN, Málaga AGP);
- «zzz» → 0 of 24, with an empty state and a 44 pt «Tøm søket» that brings back all 24;
- map view «kurd» → 2 of 24 (Erbil, Sulaymaniyah).

The List/Kart buttons stay 44 pt tall. No outbound request left the preview.

**Tradeoff:** the search field costs 56 pt above the unsearched grid. The first view shows 4 full cards instead of 6, and 3 rows are still started.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `explore-search-after-375-1-list.jpg` | `0da768195617600a…` | 750×1823 |
| `explore-search-after-375-2-lhr.jpg` | `b2dd6409d46e845b…` | 750×1798 |
| `explore-search-after-375-3-spain.jpg` | `18a5c13abc1a7875…` | 750×1798 |
| `explore-search-after-375-4-empty.jpg` | `8e95f7687772594e…` | 750×1798 |
| `explore-search-after-375-5-map-kurd.jpg` | `d7959e7322688f01…` | 750×1823 |
| `explore-search-after-390-1-list.jpg` | `cf9eb587b52397b7…` | 780×1862 |
| `explore-search-after-390-2-lhr.jpg` | `f41efc4df615e4b0…` | 780×1862 |
| `explore-search-after-390-3-spain.jpg` | `2bbae2153f378593…` | 780×1862 |
| `explore-search-after-390-4-empty.jpg` | `ac90ceb472fff594…` | 780×1862 |
| `explore-search-after-390-5-map-kurd.jpg` | `b4c3c0b7f1d53b81…` | 780×1887 |
| `explore-search-after-390-large-1-list.jpg` | `94dd80f8976c97bc…` | 780×1887 |
| `explore-search-after-390-large-2-lhr.jpg` | `b4ac7f2d114feb7c…` | 780×1887 |
| `explore-search-after-390-large-3-spain.jpg` | `c72c3d833eb75a96…` | 780×1887 |
| `explore-search-after-390-large-4-empty.jpg` | `b69c383f7a188674…` | 780×1862 |
| `explore-search-after-390-large-5-map-kurd.jpg` | `8c97e7b2a638a790…` | 780×1912 |
| `explore-search-after-430-1-list.jpg` | `f524f780be937e7b…` | 860×2013 |
| `explore-search-after-430-2-lhr.jpg` | `a8d1e2bc7eb1400f…` | 860×2013 |
| `explore-search-after-430-3-spain.jpg` | `abd2898fd4b7b696…` | 860×2013 |
| `explore-search-after-430-4-empty.jpg` | `c16ed0a77bae40d6…` | 860×2013 |
| `explore-search-after-430-5-map-kurd.jpg` | `92fe49c3a585e242…` | 860×2038 |
| `explore-search-before-375-list.jpg` | `c6452de5387654d7…` | 750×1823 |
| `explore-search-before-390-large-list.jpg` | `40c9506e4d3f646a…` | 780×1887 |
| `explore-search-before-390-list.jpg` | `aa4414dc670ee4b2…` | 780×1862 |
| `explore-search-before-430-list.jpg` | `946442e161d41246…` | 860×2013 |

## Results: Best / Cheapest / Fastest (browser preview)

**NON-NATIVE: not an iPhone.** Chromium renderings of Expo web (production bundle), with the fake-server fixture:
- safe areas are simulated (375×812 → 50/34, 390×844 → 47/34, 430×932 → 59/34);
- Inter replaces the system font; «135 %» is a simulated text size (every text and `fontScale` scaled, as Dynamic Type does);
- flights, prices and sellers are **hand-made demo data** (`provider: "demo"`, so the app itself shows DEMO). Airline and
  seller names are labels only. Airport search answers from the server's real airport registry.

**Versions:** before is `2f4ab8a`; after is the commit that adds this section. Images are JPEG (quality 82).

**What changed**
- A **Best** ranking, now the default. It is the web's own «Best totalt» formula (`src/lib/offers.ts`), with the same
  weights: price against the cheapest journey in the answer (0.6), total travel time against the fastest (0.3), most stops
  on one leg (0.15 each), +0.1 for a layover over 5 hours, and +0.05 when the seller is not the airline. The yardstick is
  the whole answer, so switching a filter never reshuffles what remains. Offers without a NOK price or with an unknown
  travel time cannot be weighed and stay last.
- **Earliest departure** sort (outbound local time; equal times fall back to price).
- **Sort tabs** above the list: Best / Cheapest / Fastest. Each shows the price and the per-leg travel time of the journey
  that tops the list with that sort and the current filters (real numbers from the answer). VoiceOver hears «Raskest,
  3 500 kroner, i snitt 2 timer 30 minutter per vei». The other two sorts stay in «Sorter».
- The sort sheet explains Best in plain words, including the airline-direct nudge, and says no one pays to be ranked.
- The count row now explains the current sort («Pris, reisetid og bytter veid sammen»).
- Large text: the tabs stay side by side while the price and time fit on one line; if an amount would wrap, they stack
  for that text size (measured, as in the details bar). Accessibility sizes (≥ 1.6) always stack.

**Measured first view** (pt from the top of the screen; «cards visible» counts the part of each card above the toolbar):

| Viewport | First card top before → after | Cards visible before → after | Tabs height |
|---|---|---|---|
| 375×812 | 254 → 352 | 1.55 → 1.21 | 74 |
| 390×844 | 251 → 331 | 1.67 → 1.39 | 74 |
| 430×932 | 263 → 343 | 1.93 → 1.66 | 74 |
| 390×844, text 135 % | 323 → 446 | 1.05 → 0.76 | 93 |

**Tradeoff, recovered by the next stage:** the tabs cost ~80 pt of the first view. The compact card that follows this
commit is what brings the card count up; this stage is not pushed on its own.

**Fixture facts used in the images:** Best 1 720 kr (Norwegian, direct, 3 t 16 min each way); Cheapest 1 530 kr
(Lufthansa via Munich, 12 t 56 min each way, overnight layover); Fastest = Best.

**Tests:** `resultsView.test.ts` (+6: the web's weights, the airline nudge, a stable yardstick under filters, unweighable
offers last, earliest departure with tie-breaks, the tab tops under filters) and `filters.test.tsx` (+3: default Best and
the tab numbers/VoiceOver label; the sort sheet's five choices and explanation; measured stacking at large text). Existing
price-basis and layout tests now reach «Billigst» through its tab.

**Not verified:** real iPhone rendering, SF Pro widths, VoiceOver reading of the tab list, real Dynamic Type sizes, and
live KAYAK answers (staging returns demo data).

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `sort-after-375.jpg` | `b20c9556bde586cd…` | 750×1824 |
| `sort-after-390-cheapest.jpg` | `4af7807f10e0262f…` | 780×1916 |
| `sort-after-390-en.jpg` | `de9bf94296821e46…` | 780×1888 |
| `sort-after-390-large.jpg` | `44a34eaf6ab513b2…` | 780×1916 |
| `sort-after-390-sheet.jpg` | `ac64397a59338be0…` | 780×1888 |
| `sort-after-390.jpg` | `765a5de59284bee1…` | 780×1888 |
| `sort-after-430.jpg` | `f62b649f335539c1…` | 860×2036 |
| `sort-before-2f4ab8a-390.jpg` | `a9dabb347737c29b…` | 780×1888 |

## Results: compact card with stop airports and risks (browser preview)

**NON-NATIVE: not an iPhone.** Same method and fixture as «Results: Best / Cheapest / Fastest» above (Chromium, Expo web
production bundle, simulated safe areas and text size, Inter instead of SF Pro, hand-made demo fares marked DEMO).

**Versions:** before is `2f4ab8a` (what the last preview build showed) and `18193da` (tabs only); after is the commit that
adds this section. Images are JPEG (quality 82). The before images are `sort-before-2f4ab8a-390.jpg` and `sort-after-390.jpg`.

**What changed on the card** (the owner's outbound/return labels and route line are kept):
- Each leg is two lines instead of three: «UT · 9. OKT.» on the left and «3 t 16 min · Direkte» on the right, then
  departure time, airport code, route line, airport code and arrival time. The date labels stay; nothing else repeats.
- The stop airport is on the card: «1 mellomlanding · CPH» (VoiceOver: «1 mellomlanding i København»). «Direkte» is green
  text (a word, never colour alone).
- Material risks are on the card, from the same rules as the details warning box: change of airport, overnight
  connection and waits of 6 h or more. One connection is named once («Bytte over natten i München (8 t 55 min)»), and an
  identical outbound/return risk is not repeated. Warning colour plus an icon plus words.
- Bags sit beside the price instead of on their own row. The amount still carries «Totalt for 1 voksen»; the trip type is
  not repeated there because both legs are on the card. VoiceOver and the details bar keep the full basis
  («… · Tur-retur»).
- The whole card is the button; the separate «Detaljer» pill is gone (it was hidden from VoiceOver already).
- The airline line names the carriers that fly the journey («SAS · Vueling»), and the cabin appears only when it differs
  from the one searched for. Long names wrap; no text on the card has a line limit.
- Narrow screens (< 360 pt) and text above 135 %: each leg stacks, left-aligned, with «OSL → BCN · 3 t 16 min · Direkte».
- Cards are memoised with a stable open callback, so filtering and sorting do not re-render unchanged cards.

**Measured first view** (pt; same flow as above):

| Viewport | Card height 2f4ab8a → after | Cards visible 2f4ab8a → 18193da → after |
|---|---|---|
| 375×812 | 289 → 215 | 1.55 → 1.21 → 1.63 |
| 390×844 | 289 → 215 | 1.67 → 1.39 → 1.88 |
| 430×932 | 289 → 215 | 1.93 → 1.66 → 2.18 |
| 390×844, text 135 % | 393 → 267 | 1.05 → 0.76 → 1.08 |

A card with a risk line is 232 pt. With live data the demo notice (≈ 75 pt) is replaced by the one-line price status, so
the live first view has more room than these demo captures.

**Tests:** `offerCard.test.tsx` (new, 7): stop airport and spoken city; one merged overnight risk with the wait; airport
change and carrier names; no risk line on a plain direct flight and green «Direkte»; cabin only when it differs; the
whole card opens its own offer and has no inner «Detaljer»; English; large text stacks without line limits. Existing
card tests now expect the short basis on the card and the full basis in the VoiceOver label.

**Not verified:** real iPhone rendering and SF Pro widths (Inter is wider, so real wrapping should be the same or
better), VoiceOver reading order, real Dynamic Type sizes, and live KAYAK answers.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `card-after-320.jpg` | `6091606a3bc63257…` | 640×1336 |
| `card-after-375.jpg` | `01499416cef11693…` | 750×1852 |
| `card-after-390-cheapest.jpg` | `24ba5704736198d1…` | 780×1888 |
| `card-after-390-en.jpg` | `49430eadc4d1f554…` | 780×1888 |
| `card-after-390-large.jpg` | `b0aa950905032b01…` | 780×1888 |
| `card-after-390-oneway.jpg` | `d6fcd99d92463298…` | 780×1860 |
| `card-after-390.jpg` | `a6c27d4c9b107dcf…` | 780×1888 |
| `card-after-430.jpg` | `2142f7c509d8792b…` | 860×2036 |

## Dates: one range calendar for departure and return (browser preview)

**NON-NATIVE: not an iPhone.** Chromium renderings of Expo web (production bundle); simulated safe areas and text size;
Inter instead of SF Pro. The preview's «today» is 25.09.2026. No flight data is involved except the results sheet image,
whose search behind the sheet is the hand-made demo fixture.

**Versions:** before is `9b71bac`; after is the commit that adds this section. There is no before image: the native iOS
date picker does not exist in a browser (the old captures showed a web stand-in). Before, a round trip took two sheets:
open «Avreise», pick, close; open «Retur», pick, close (6 taps). The results «Datoer» sheet had two compact pickers.

**What changed**
- One sheet for both dates, on Home and in the results «Datoer» sheet (which keeps «Søk på nytt»). A round trip is
  open → tap departure → tap return → Ferdig (4 taps, one sheet). One way is one tap.
- The top shows both dates and the number of nights; tapping «Avreise» or «Retur» decides what the next day sets.
  Opening from «Retur» (or «Legg til» retur) starts on the return.
- The form is valid after every tap (`lib/calendar.ts`, `applyPick`): a new departure keeps the return when it is still
  after, otherwise moves it by the same trip length; a return tapped before the departure becomes the new departure.
  Same-day return is allowed.
- Monday-first weeks (Norwegian and British convention), the current month plus twelve (no invented booking horizon:
  the search itself answers if a provider does not sell that far ahead). Past days are visibly disabled and not pressable.
- Day cells are 47 × 46 pt at 375 pt. Rows grow with the text size (the numbers scale up to 2×, the largest that fits
  seven columns). VoiceOver hears the full date and its role: «fredag 9. oktober 2026, avreise», «mandag 12. oktober 2026,
  mellom avreise og retur», «torsdag 24. september 2026, kan ikke velges, har passert», with a hint for what a tap sets.
- New theme token `textDisabled` (#B4B7BE) for the past days (disabled text is exempt from the contrast minimum).
- Hotels keep their existing date fields for now (not part of the flight path).

**Tests:** `lib/__tests__/calendar.test.ts` (new, 11: months over New Year, Monday-first grids, leap day, month index,
nights across the DST change, every pick rule, day roles) and `calendar.test.tsx` (new, 5, clock fixed to 25.09.2026:
two-tap range with nights and spoken roles; opening on return and a return before departure; past days disabled and
today marked; one way and «Legg til» retur; English). The results dates test now picks a day in the calendar.

**Not verified:** real iPhone rendering and scrolling feel, VoiceOver navigation through a month grid, real Dynamic Type
at accessibility sizes, and one-handed reach on a device.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `cal-after-375.jpg` | `ccb1d91dde4c26e4…` | 750×1824 |
| `cal-after-390-1-open.jpg` | `106225081ef118a5…` | 780×1888 |
| `cal-after-390-2-depart.jpg` | `73c7d965d0a6c9fe…` | 780×1888 |
| `cal-after-390-3-range.jpg` | `986c5ebc99b038d0…` | 780×1888 |
| `cal-after-390-4-home.jpg` | `c3dd2c0296930205…` | 780×1888 |
| `cal-after-390-en-return.jpg` | `3f746585c2008a28…` | 780×1888 |
| `cal-after-390-large.jpg` | `f8d621697d36bb4b…` | 780×1888 |
| `cal-after-390-results.jpg` | `4487db0128a00c81…` | 780×1916 |
| `cal-after-430.jpg` | `51d4e0c65342cb70…` | 860×2036 |

## Results: loading with placeholder cards (browser preview)

**NON-NATIVE: not an iPhone.** Chromium renderings of Expo web (production bundle), simulated safe areas and text size,
Inter instead of SF Pro. The fake server holds the search open (12 s) so the loading state can be captured.

**Versions:** before is `2f4ab8a` (the loading state was unchanged up to `e619332`); after is the commit that adds this
section. Images are JPEG (quality 82).

**What changed**
- The search (route, dates, travellers, class) stays at the top while providers answer, as before.
- Under it: one status line («Vi sammenligner priser …» with the existing expectation text; after 8 s the existing
  «Noen tilbydere bruker lenger tid …») and three placeholder cards in the shape of the compact result card, so the list
  does not jump when the answer arrives. The placeholders are grey shapes only: no prices, times or airlines. They are
  hidden from VoiceOver; the status line is one readable progress element and a polite live region.
- «Stopp søket» sits where the Filtrer/Sorter/Datoer bar appears, within thumb reach (before: under the spinner at the
  top half of the screen). It still cancels the request and goes back, and the form is kept.
- The placeholders pulse gently (opacity 1 → 0.72, 0.8 s). With Reduce Motion they stand still.

**Tests:** `resultsLoading.test.tsx` (new, 4): the search in the header while loading; the spoken status; placeholders
hidden from VoiceOver and without any text; the slow message after 8 s; «Stopp søket» aborts and goes back; no pulse with
Reduce Motion.

**Not verified:** perceived speed on a real iPhone with a live provider (staging answers in demo mode), and VoiceOver's
reading of the progress element on device.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `loading-after-375.jpg` | `fdf422210347192b…` | 750×1796 |
| `loading-after-390-large.jpg` | `85d48d6b4598b6a7…` | 780×1888 |
| `loading-after-390-slow.jpg` | `58259be03f87651b…` | 780×1888 |
| `loading-after-390.jpg` | `1cd43490aa09a5bb…` | 780×1916 |
| `loading-after-430.jpg` | `9b295c70722c87a3…` | 860×2036 |
| `loading-before-2f4ab8a-390.jpg` | `8aeef44c14aa350c…` | 780×1888 |

## Flight details: the whole journey on one scroll (browser preview)

**NON-NATIVE: not an iPhone.** Chromium renderings of Expo web (production bundle) with the hand-made demo fixture. The
two full-page images use a 390×2900 viewport so the whole scroll fits in one picture (not a real screen size).

**Versions:** before is `2f4ab8a` (details were unchanged up to `0923612`); after is the commit that adds this section.
Both full-page images show the same journey (Vueling, two sellers).

**What changed**
- No tabs. Before, only «Oversikt» was visible; baggage, terms and the itinerary each needed a tap on a tab, so a customer
  could reach the provider without ever seeing the layovers or the baggage.
- One scroll in decision order: sellers (when more than one) → the itinerary for every leg (each flight, layover time,
  airport change, +1 day, operating carrier, aircraft) → baggage for the chosen seller → terms for the chosen seller
  (only when the provider stated any) → price (basis, «ca.» explanation, service fee, seller, expiry).
- The «Reiseinformasjon» card is gone: everything in it (flight numbers, operator, aircraft, durations, stops) is in the
  itinerary, and the cabin is in the summary.
- The sticky bar (price, basis, «Gå til tilbud», seller, «Bestillingen fullføres hos tilbyderen.») is unchanged, so the
  action is always one tap away.
- Unused strings for the tabs and the removed card are deleted.

**Tests:** the details tests no longer press tabs; they assert that sellers, itinerary, baggage, terms and price appear in
that order on one screen (`coreFlowLayout.test.tsx`), that there is no tab list (`edgeCases.test.tsx`), and that the
itinerary is always present (`screens.test.tsx`). VoiceOver language coverage now walks the whole scroll at once.

**Not verified:** scrolling and VoiceOver order on a real iPhone.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `details-after-390-first-view.jpg` | `e2b740d4a6d79696…` | 780×1916 |
| `details-after-390-full.jpg` | `de754c1247d72a6a…` | 780×6056 |
| `details-before-2f4ab8a-390-full.jpg` | `95865c099d185d4b…` | 780×6028 |

## Review fixes for the five stages above (independent review)

An independent review of `18193da..470a38d` (read-only, with its own probe tests) found ten problems. All are fixed in
the commit that adds this section, each with a test that fails on the previous code (checked by swapping the old file in):

1. **The calendar could open on the wrong month.** Opening from «Retur» with a return months away showed the departure's
   months, and reopening kept the last mode. The mode is now reset in the same render the sheet opens, so the list mounts
   on the right month; tapping «Avreise»/«Retur» at the top scrolls to that month.
2. **At large text on small phones the calendar's footer could be pushed off-screen.** The month list now gives way
   (`flexShrink`, with a minimum of a heading and two weeks), so «Ferdig»/«Søk på nytt» stays visible.
3. **Month headings were clipped at large text.** Their height now follows the text size (capped with the day numbers
   at 2×), and the list's layout offsets use the same height.
4. **Filter counts sorted every offer ~30 times per render** once «Best» became the default. Counts now use
   `journeyCount` (filter + group, no sort), measured equal to the list's grouping in tests.
5. **«Best» favoured HelloSky's own tickets.** Offers without a `booking` (HelloSky sells them; they cannot be booked in
   the app) scored like airline-direct. The nudge now applies to everything that is not the airline itself, and the
   explanation says «foran andre selgere (reisebyråer, også HelloSky)». This deliberately differs from the web.
6. **The tab times were an unlabelled average.** On return searches a line under the tabs now says «Reisetiden er
   snittet per vei.»
7. **Card risk lines did not say which leg.** Return trips now say «Ut: …», «Hjem: …» or «Begge veier: …».
8. **The cabin could be cut on the details screen** (its only place after the info card went): the line limit is removed.
9. **A day before the departure said «Velger returdato»** in return mode; the hint now says what the tap does
   («Velger avreisedato»).
10. **Day cells were 40 pt wide at 320 pt.** On narrow screens the grid uses the sheet's side margin, giving 44 pt.

Also: the calendar unit tests pass under `TZ=Europe/Oslo` (where 24–26 October 2026 is 49 hours), `America/Santiago` and
UTC; Jest cannot switch time zone inside a test file, so the Oslo run is done from the command line. The full suite passes
under both UTC and `TZ=Europe/Oslo` (450 passed, 3 skipped).

**Not verified:** the same on a real iPhone (Dynamic Type accessibility sizes, VoiceOver in the calendar).

## Airport picker: instant matches, English names, highlighting, Torp under Oslo (browser preview)

**NON-NATIVE: not an iPhone.** Chromium renderings of Expo web (production bundle). The airport answers come from a
local mock that runs the server's real search (`api/lib/airportMeta.ts`) **without** KAYAK's autocomplete fallback.
In production that fallback can fill in when the registry finds fewer than three airports, but the sandbox allows
only 100 calls an hour, so it cannot be relied on.

**Versions:** before is `2f4ab8a` (the picker was unchanged up to `2e8156f`); after is the commit that adds this
section.

**Problem found:** the shared registry only has Norwegian names («København», «Helsingfors», «Wien», «Roma»), and the
server's world search skips those airports' English names. «helsinki», «munich», «vienna», «prague», «lisbon»,
«athens», «venice», «geneva» and «gothenburg» found nothing. «copenhagen» found only Roskilde, «warsaw» found Modlin
and Radom but not Chopin, and «rome» found Ciampino plus unrelated airports but not Fiumicino. The same gap is in
the web app (same server). The server fix is outside the app's scope and is listed in the owner backlog.

**What changed (app only)**
- **Instant matches.** The picker shows matches from the app's copy of the curated registry as you type. Previously it
  waited 250 ms plus a network round trip, with an empty list. The server's world matches are added *below* when they
  arrive, so the rows above never move. A slow server shows «Ser etter flere flyplasser …» under the matches. A
  failing server leaves the matches selectable, with «Fikk ikke hentet flere flyplasser. …» underneath instead of an
  error over an empty list.
- **Both languages.** English names for the registry airports whose names differ (Copenhagen, Helsinki, Munich,
  Vienna, Rome, Milan, Venice, Athens, Lisbon, Prague, Warsaw, Geneva, Gothenburg and others) are searched in both
  languages. A row shows the app's language. When only the other language matched, it says so: «København
  (Copenhagen)», «Helsingfors (Helsinki)». In English the rows and the chosen airport use English names («Copenhagen»,
  «Denmark»). The server's airports get English country names from their country code.
- **What you typed is emphasised** (semibold) in the city and in the airport line, as in iOS' own search lists. An
  exact code («bcn») shows the code chip inverted. Matching and emphasis use the same rule: each word typed must start
  a word; accents and æ/ø/å do not matter. The emphasis is visual only; VoiceOver reads the row as before.
- **Ordering.** Exact code, then city, airport name and country. Ties put the cities the registry marks as popular
  first and keep a city's airports together, so «lon» gives London (LHR, LGW, STN) before Longyearbyen.
- **Torp under Oslo (backlog 1.10).** A search for the *city* Oslo adds Sandefjord Torp (TRF) as its own row directly
  under OSL, captioned «Annen flyplass nær Oslo» (also read by VoiceOver). It has its own code and choosing it searches
  TRF only. It is never merged with OSL. Typing «OSL» or «Gardermoen» gives OSL alone. The registry itself calls Torp
  «den andre inngangen til Oslo-området». Other cities' airports already share the city name and show up together.
- Torp is also among «Flyplasser i Norge» before you type, in the registry's order (OSL, BGO, TRD, SVG, TRF, TOS …).

**Architecture:** the app still imports only *types* from `contracts/` (Metro sees only `apps/mobile`). A first
attempt imported the registry's values and failed to bundle; the browser preview caught it before commit. The
registry is now copied into `src/lib/airportRegistry.ts`, like the destinations. A test fails if the copy drifts from
`contracts/airports.ts`, and another fails if any app file imports values from `contracts/`.

**Tests:** `textMatch.test.ts` (folding, ranges, æ → ae), `airportIndex.test.ts` (English names, ordering, Torp rule,
merge with server answers, names per language), `airportRegistry.test.ts` (drift + import rule) and
`airportPicker.test.tsx` (instant rows before the server answers, server rows appended without moving the others,
soft failure, emphasis styles, inverted code, Torp row and label, English names in the form). The existing keyboard
and stale-answer tests pass unchanged, apart from one wait that now waits for the server's row.

**Performance:** iOS Hermes bundle 4 880 709 → 4 898 770 bytes (+18 kB, +0.37 %), measured with `expo export` on
`2e8156f` and on this commit. The local search runs over 103 airports per keystroke (pre-folded words).

**Not verified:** a real iPhone (keyboard, VoiceOver reading the emphasised rows, Dynamic Type accessibility sizes),
and KAYAK's live autocomplete.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `airport-before-390-helsinki.jpg` | `46e87cbfab84bef3…` | 780×1826 |
| `airport-after-390-helsinki.jpg` | `a8c577142ada8975…` | 780×1860 |
| `airport-before-390-copenhagen.jpg` | `4bce5dfdc4324839…` | 780×1826 |
| `airport-after-390-copenhagen.jpg` | `c3e26d375effab97…` | 780×1860 |
| `airport-before-390-oslo.jpg` | `e5452f9f48503b9f…` | 780×1826 |
| `airport-after-390-oslo.jpg` | `4b258c9ad6ba56a9…` | 780×1860 |
| `airport-before-390-slow-server.jpg` | `0a4e1f74fa2692d1…` | 780×1860 |
| `airport-after-390-slow-server.jpg` | `6a8729666642b4ce…` | 780×1860 |
| `airport-after-375-oslo.jpg` | `10d7e1ee716c1fac…` | 750×1790 |
| `airport-after-430-oslo.jpg` | `8c9726dd4a0da005…` | 860×2002 |
| `airport-after-390-large-oslo.jpg` | `572a7aa68f8470e4…` | 780×1826 |
| `airport-after-390-en-copenhagen.jpg` | `03afadf0a08a9120…` | 780×1826 |
| `airport-after-390-bcn.jpg` | `a755000fca0652f9…` | 780×1860 |
| `airport-after-390-london.jpg` | `ef0d3530cce48dfd…` | 780×1826 |
| `airport-after-390-gar.jpg` | `b2ff0711cf6cbd72…` | 780×1860 |

## Filters: arrival times, connecting airports, active filters as chips (browser preview)

**NON-NATIVE: not an iPhone.** Chromium renderings of Expo web (production bundle) against the local mock with
demo data (labelled DEMO on screen).

**Versions:** before is `2e8156f` (the results screen and filters are unchanged up to `24f52c6`); after is the
commit that adds this section.

**What changed**
- **Active filters stay visible (backlog 1.13).** Before, a filter set in the sheet (times, airlines, price, travel
  time) vanished when the sheet closed; only a number on «Filtrer» and «N skjult av filtre» hinted at it. Now each one
  is a blue chip with «×» right after «Alle» («Avgang ut: morgen», «Ankomst hjem: kveld», «Norwegian, SAS», «Ikke via
  CPH», «Opptil 3 000 kr», «Reisetid opptil 4 t»). A tap removes that filter; VoiceOver says «Fjern filter: …».
  «Direkte», «Maks 1» and «Bagasje» keep their own chips, so nothing is shown twice.
- **Arrival times (backlog 1.12).** Each leg («Utreise», «Hjemreise»; «Tider» on one-way searches) has an
  «Avgang | Ankomst» switch over the same four time bands. Departure and arrival can both be on. A dot on the other
  choice (and «…, filter på» for VoiceOver) shows that it has a filter too, so nothing hides behind the switch. The
  times are local at the airport, as the provider gave them, including a landing after midnight.
- **Connecting airports (backlog 1.12).** «Mellomlanding i» lists the airports the offers actually connect in (both
  airports on an airport change), with the provider's city names, most journeys first. All are ticked; untick one
  to hide journeys that connect there. Direct flights always stay. Each row counts the journeys that connect there
  under the other filters; rows with none are disabled. Ticked is the default, so rows are not highlighted. The one
  that stands out is the one the customer switched off.
- Counts, «Vis N reiser», the badge and «Nullstill filtre» include the new filters. A new search starts with none,
  as before.

**Tests:** `connectionFilters.test.ts` covers connection airports (airport change, direct flights always pass,
counts), arrival bands (overnight landing, return only) and the chips (labels in both languages, ordering, «N
tidsrom», VoiceOver text, each chip clears only its own filter). `filters.test.tsx` walks the sheet: untick CPH, close,
the chip right after «Alle», remove it; arrival switch, disabled empty bands, dot and spoken state; the return leg's own
switch.

**Performance:** iOS Hermes bundle 4 898 770 → 4 910 293 bytes (+11.5 kB). Counting per airport walks the offers
once per airport row while the sheet is open.

**Not verified:** a real iPhone (VoiceOver reading the chips row and the switch, Dynamic Type accessibility sizes in
the sheet).

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `filters-before-390-active.jpg` | `a4ff87487b9f0df5…` | 780×1860 |
| `filters-after-390-active.jpg` | `878362a2847aecbb…` | 780×1860 |
| `filters-after-375-active.jpg` | `961a0e6b57280628…` | 750×1762 |
| `filters-after-430-active.jpg` | `23803b729bb4d7ba…` | 860×2002 |
| `filters-after-390-large-active.jpg` | `c67b0389e1f9ea31…` | 780×1860 |
| `filters-before-390-sheet.jpg` | `ed135173a1654a65…` | 780×1860 |
| `filters-after-390-times.jpg` | `a0978f479242056a…` | 780×1860 |
| `filters-after-390-via.jpg` | `6b02dc79f5a3fcaf…` | 780×1860 |
| `filters-after-390-en-times.jpg` | `9d9a2baf739003c7…` | 780×1860 |
| `filters-after-390-large-times.jpg` | `c0630d34b2599ab3…` | 780×1826 |

## Home: other recent searches in one tap, «bytt» that speaks, traveller rules where they bite (browser preview)

**NON-NATIVE: not an iPhone.** Chromium renderings of Expo web (production bundle) against the local mock.

**Versions:** before is `568020a`; after is the commit that adds this section.

**What changed**
- **Recent searches from Home (backlog 1.20).** Coming back to Home after searching, the other recent searches (not
  the one already in the form, and none whose dates have passed) show as small chips under «Søk fly»: «OSL‑LHR
  9.–16. okt.». They replace the line «Du trenger ikke logge inn for å søke.», which is for new customers, who have no
  recent searches. One tap searches again with exactly those details and opens the results. VoiceOver: «Søk igjen:
  Bergen → London, fre. 9. okt. – fre. 16. okt. · 1 voksen · Økonomi». The full list, including searches with past
  dates, is still in Lagret. Measured first view (destination cards still visible above the tab bar): 390 pt 122 →
  96 pt, 375 pt 87 → 61 pt, 430 pt 198 → 172 pt, and only when the row is shown. The earlier list here (122 pt per
  search) pushed them out.
- **Swap (backlog 1.19).** The arrows turn half a round (not with Reduce Motion), and VoiceOver hears the new route:
  «Byttet. Fra Barcelona, til Oslo.»
- **Travellers sheet (backlog 1.18).** A summary on top follows the choices («2 voksne, 2 spedbarn · Økonomi»). The
  infant rule is said where it stops a button: «Høyst ett spedbarn per voksen …» under Spedbarn when «+» stops. Adults
  can no longer drop below infants, which before silently removed an infant; «−» stops with «Hvert spedbarn trenger en
  voksen. Ta bort et spedbarn først.» At nine travellers: «Høyst 9 reisende i ett søk.» The notes are also in
  VoiceOver's hint for the adjustable control.
- New i18n strings in both languages; three unused Home strings removed.

**Tests:** `homeQuickActions.test.tsx` covers which recents show (not the form's, not past), the one-tap search with
the exact slices, the login line when there is none, the date span in both languages, the swap announcement with and
without Reduce Motion, and the traveller rules: summary, the infant note and disabled «+», adults blocked at the number
of infants with nothing removed silently, and the nine-traveller note. The Home order test is unchanged; with no other
recent searches the login line is where it was.

**Not verified:** a real iPhone (VoiceOver announcement timing after swap, the chips' scroll with Dynamic Type
accessibility sizes).

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `home-before-390-after-searches.jpg` | `e8d52d357e9ea494…` | 780×1860 |
| `home-after-390-recent.jpg` | `00101a25f9d6c5b1…` | 780×1860 |
| `home-after-375-recent.jpg` | `80c3f2a9be3e3659…` | 750×1762 |
| `home-after-430-recent.jpg` | `ce8614f7591cbf1d…` | 860×2002 |
| `home-after-390-large-recent.jpg` | `ce75860c0b599db7…` | 780×1860 |
| `home-after-390-fresh.jpg` | `f7c50b5c52bd227b…` | 780×1860 |
| `travellers-before-390.jpg` | `c953bae3283d9a49…` | 780×1798 |
| `travellers-after-390-infant.jpg` | `d74c3894325455c7…` | 780×1832 |
| `travellers-after-390-two.jpg` | `2a563c5d509a2900…` | 780×1832 |
| `travellers-after-390-large-infant.jpg` | `8caaec60efa97aa1…` | 780×1826 |

## Review fixes for the airport picker, filters and Home stages (independent review)

Two independent reviewers read `2e8156f..99c67b9` (read-only, in their own worktrees, each with probe tests). One
covered the picker and Home, the other the filters. They found 18 problems, none severe. All are fixed in the commit
that adds this section. The ones that could be written as tests have a regression test, and each of those tests fails
on the previous code.

**Picker**
1. **Torp came and went while typing.** «os» → OSL, TRF; «osl» → OSL; «oslo» → OSL, TRF. The rule now follows
   whether the query is the start of the city's name (so «os», «osl» and «oslo» give the same rows), and «oslo torp»
   (the airlines' own name) finds Torp. «Gardermoen» and «Oslo Gardermoen» still give OSL alone.
2. **The caption claimed «nær»** (Torp is about 110 km from Oslo). Now «Brukes også for Oslo-området» / «Also serves
   the Oslo area», which matches what the registry says. The image `airport-after-390-oslo.jpg` was re-shot with the
   new caption and its hash updated above.
3. **Recent picks kept the language they were made in.** «Recent» in English showed and stored «København …,
   Danmark». Recents, suggestions and Home chips now use the app's language for registry airports.
4. **«Stockholm Arlanda flyplass» in English.** Now «Stockholm Arlanda».
5. **«aalesund», «tromsoe», «goeteborg», «zuerich» found nothing.** Alternative spellings are indexed.
6. **Highlighting split a letter from its accent** when the server sends decomposed text (NFD). The accent now goes
   with its letter.
7. **The code chip could spill at large text** (white text on a white row). It now grows with the text
   (`airport-after-390-xl-osl.jpg`).
8. **The import guard missed common shapes** (re-export, `export *`, bare import, `require`, `import()`,
   `./`-prefixed paths, `.js` files). It now lists every import with TypeScript's own pre-processor, after removing
   `import type`/`export type`. A test runs it against all ten shapes.

**Home**
9. **A chip could overwrite the form with a search whose date had passed** (the app left open over midnight). Such a
   tap now gives the route with new dates, like «Velg nye datoer» in Lagret. It does not search and shows no error.
10. **Chips that search differently looked and sounded the same.** They now show what differs from a plain search
    («· 3 reisende · Business», «· Direkte»). VoiceOver also hears «Bare direktefly» and «Én vei».
11. **The form error stayed after a chip search.** An error now belongs to the form it was found in.
12. **A same-day return read «9.–9. okt.»** It now reads «9. okt.».

**Filters**
13. **The filter sheet's counts ran on every render of the list, even with the sheet closed.** The reviewer measured
    ~10–20 ms per render with 200 offers on a desktop CPU, with Hermes on a phone likely slower. The sheet is now its
    own component. It counts only while open, keeps its last content while it slides away, and does not exist until
    first opened. «Vis N reiser» uses the list's own count.
14. **The travel-time chip left out «each way».** Now «Maks 4 t per vei» / «Max 4h each way».
15. **VoiceOver could not tell the two «Avgang | Ankomst» switches apart.** Each option now says its leg
    («Hjemreise: Ankomst, filter på»).
16. **An «Opptil … kr» chip was drawn once when a repeated search came back with an unconfirmed total.** The screen
    now removes the price filter in the same render (`view` is derived), not only in the effect afterwards.
17. **Removing a chip lost VoiceOver's place, and the chip said «valgt».** Removing now announces «Fjernet: … N
    reiser.», and a removable chip no longer carries the selected state.
18. **Two small wording bugs.** A one-way return-arrival filter was labelled «Avgang», which could not happen yet. The
    empty-filter message counted offers as «reiser»; it now counts journeys.

**Checks:** typecheck and lint clean. Jest: 530 passed, 3 skipped, under both UTC and `TZ=Europe/Oslo`.
`expo export` (iOS) OK: 4 924 689 bytes. Bundle check OK.

**Not verified:** a real iPhone (VoiceOver announcement after removing a chip, and the switch labels).

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `airport-after-390-xl-osl.jpg` | `eeca19b15b743869…` | 780×1860 |
| `airport-after-390-oslo-torp.jpg` | `b19c4cc3f6474e27…` | 780×1860 |
| `airport-after-390-oslo.jpg` | `4b258c9ad6ba56a9…` | 780×1860 |

## Results: nothing found → «Prøv datoene rundt»; the search in the header can be tapped (browser preview)

**NON-NATIVE: not an iPhone.** Chromium renderings of Expo web (production bundle) against the local mock returning
an empty answer.

**Versions:** before is `2e8156f` (the empty state is unchanged up to `44ab435`); after is the commit that adds this
section.

**What changed**
- **A search that finds nothing offers the dates around it (backlog 2.11).** It shows «Prøv datoene rundt» with the
  same trip three and one day earlier and later, keeping the trip length («6.–13. okt.», «8.–15. okt.» …), and never
  a date that has passed. Each chip is a new search of exactly the search shown, with the new dates. There are no
  prices on the chips; we have none until it is searched. The web does the same («Prøv datoene rundt»). The chips
  also show when the provider answered but nothing matched the search. VoiceOver: «Søk med avreise tor. 22. okt. og
  retur tor. 29. okt.».
- **No price notes on an empty answer.** «Om «ca.»-priser» and «Ekte priser · sjekket kl. …» no longer sit above
  «Ingen fly funnet». There are no prices to explain.
- **The search in the header can be tapped (backlog 2.6)** to open the search form, like the search button next to
  it. For VoiceOver the route stays a heading, and the button does the job, so nothing is announced twice.

**Tests:** `nearbyDates.test.ts` (shifts, trip length kept, never before today, month change and summer time) and
`resultsEmpty.test.tsx` (the four chips and their spoken labels, a tap searching the shown query with new dates,
one-way with a weekday, past dates left out, the provider-mismatch case, no chips when there are journeys, no price
notes on an empty answer, the header tap and its accessibility).

**Checks:** Jest 540 passed, 3 skipped (UTC and Oslo). Typecheck and lint clean. iOS bundle 4 927 237 bytes. Bundle
check OK.

**Not verified:** a real iPhone.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `empty-before-390.jpg` | `658e6cb0cd102983…` | 780×1860 |
| `empty-after-390.jpg` | `de40b7227a4a0d69…` | 780×1860 |
| `empty-after-375.jpg` | `f117945e61476aee…` | 750×1762 |
| `empty-after-390-large.jpg` | `c350e6d7a37444fd…` | 780×1826 |
| `empty-after-390-en.jpg` | `7048f0da52498ca1…` | 780×1826 |

## Figma: the 6935d1d screens and components in the editable file (design specification)

**Not the app and not an iPhone.** The top row of the image is a NON-NATIVE browser preview (Expo web, Chromium,
393 × 852) against the local mock with demo data; the bottom row is the Figma file. FIXTURE numbers, not live prices.

**Versions:** app `6935d1d`; Figma file `YE2XDmrOTFY8dRFiarPxSz`, frame P6 (node `65:226`), 25.09.2026.

**What changed (backlog 2.16)**
- **Components:** OfferCard (compact) with Trip = Return/One way and properties for airline, price, basis, seller
  count, risk line and «+1»; SortTab; FilterChip; RecentSearchChip; AirportRow (Suggestion, Match, Exact code,
  Nearby); CalendarDay (seven roles); eight icons. New text styles for the card's airport code, «Direkte», the airport
  picker's code box, the logo fallback and the filter badge. The old OfferCard set is marked as superseded.
- **P6:** results with active-filter chips and sort tabs, the range calendar, the airport picker for «oslo» with Torp
  as its own row, the filter sheet at «Utreise» (Avgang | Ankomst •) and at «Mellomlanding i», and the empty answer
  with «Prøv datoene rundt». Built from library instances, with the counts the app shows for the same filters.
- **Checked:** each frame against a browser capture of the same state. Automated pass: no unbound fills or strokes,
  no unstyled text and no default layer names in the new components or P6, apart from three sheet scrims that use the
  code literal `rgba(0, 0, 0, 0.5)`.
- **Left out on purpose:** the demo notice box on screen A (the DEMO badge stays), the keyboard, the iOS clear button
  and the browser's focus box.

**Not verified:** a real iPhone; Figma does not run the app's measurements (large text, narrow screens).

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `figma-p6-parity.jpg` | `17926f4c2173dc28…` | 1520×1296 |

## Results: updating the prices keeps the list; pull down on iPhone; loading says what we do (browser preview)

**NON-NATIVE: not an iPhone.** Chromium renderings of Expo web (production bundle) against the local mock with demo
data (labelled DEMO). Pull-to-refresh does not exist on the web: the captures run the same path through «Søk på nytt»
with the same dates.

**Versions:** before is `a67a9bc` (the app is unchanged since `6935d1d`); after is the commit that adds this section.

**What changed**
- **Updating the prices keeps the list (backlog 2.7).** Running the same search again – pulling down the list (new,
  iOS' own refresh control), «Oppdater prisene», or «Søk på nytt» with unchanged dates – no longer swaps the journeys
  for placeholders. The list, the chosen sort and the filters stay; a line above the tabs says «Oppdaterer prisene …»
  (after the review: «Oppdaterer prisene fra kl. 22:10 …», so the age of the prices shown stays visible; VoiceOver
  hears «Oppdaterer prisene.»), and the new prices replace the old ones in place. VoiceOver then hears «Prisene er
  oppdatert. 12 reiser.» – the number shown, with the filters that stay.
- **A failed update keeps the previous prices,** with the reason and their age: «Fikk ikke oppdatert prisene.
  Leverandøren svarer ikke akkurat nå. Prisene under er fra kl. 21:39.» Before, every journey disappeared behind an
  error. A new search (other dates, airports or travellers) still starts from placeholders, and a first search that
  fails still shows «Prøv igjen».
- **Flight details stay open during an update:** the open journey is still there until the new answer arrives.
- **Loading says what we do, not how long it takes (backlog 2.8):** «Vi henter tilbudene og samler like reiser, så du
  ser hver reise én gang.» instead of «Det kan ta opptil 20 sekunder.»

**Tests:** `resultsRefresh.test.tsx` (the list and sort stay while refreshing, new prices land in the same list, the
spoken result, a failed update with reason and time, recovery on the next pull, «Søk på nytt» with the same dates,
new dates show placeholders, a failed first search, details during an update); `filterSheetCost.test.tsx` (the price
filter belongs to the previous answer while it is shown and never flashes for an unconfirmed new one);
`resultsLoading.test.tsx` (new copy).

**Checks:** Jest 547 passed, 3 skipped (UTC and Oslo). Typecheck and lint clean. iOS bundle 4 929 964 bytes. Bundle
check OK.

**Not verified:** a real iPhone, including the native pull-to-refresh gesture and its VoiceOver three-finger scroll.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `refresh-before-390-same-search.jpg` | `951717d5ced63267…` | 780×1860 |
| `refresh-before-390-failed.jpg` | `afaa36e735faabc8…` | 780×1860 |
| `refresh-after-390-refreshing.jpg` | `a668a69731a08520…` | 780×1950 |
| `refresh-after-390-failed.jpg` | `c259afc1dc4416b6…` | 780×1860 |
| `refresh-after-390-new-search.jpg` | `3fd5f1ef9efa5b74…` | 780×1894 |
| `refresh-after-375-refreshing.jpg` | `d9fc4d7e48db4c7e…` | 750×1762 |
| `refresh-after-430-failed.jpg` | `ad8fe1378999aca9…` | 860×2002 |
| `refresh-after-390-large-failed.jpg` | `6e155e5be3292e59…` | 780×1860 |
| `refresh-after-390-en-failed.jpg` | `36efa5050303f185…` | 780×1826 |

## Review fixes for the refresh stage (independent review)

**NON-NATIVE: not an iPhone.** Same setup as the section above; the three images marked there were captured again after
these fixes.

**Found by an independent reviewer (2 medium, 5 low; no high), all fixed:**
- **Open flight details no longer say «Tilbudet er borte» after an update.** The metasearch gives every offer a new id
  on each search, so the details screen now follows the open journey by its flights and times, with the new price and
  the seller the customer had chosen.
- **VoiceOver hears the update start** («Oppdaterer prisene.»); the line over the tabs is not spoken by itself on iOS.
- **Pull down and «Oppdater prisene» refresh the search on screen,** not dates picked in the sheet without searching.
- **The spoken count is the number shown** with the filters that stay («Prisene er oppdatert. 1 reise.»).
- **A failed update of an empty answer says nothing about prices:** «Fikk ikke søkt på nytt. …».
- **iOS' own spinner shows only after a pull, below the status bar** (`progressViewOffset`); started from the link or
  the sheet, the line over the tabs is enough and the list does not jump.
- **The age of the prices stays visible while updating:** «Oppdaterer prisene fra kl. 22:10 …».
- **Tests clear the announcement mock first and count every announcement,** and cover new offer ids, a chosen
  seller, edited dates, an empty answer and English.

**Checks:** Jest 553 passed, 3 skipped (UTC and Oslo). Typecheck and lint clean.

**Not verified:** a real iPhone (the spinner offset and the pull gesture in particular).


## Explore: from-airport, dates and travellers changed in place; Saved rows one line shorter (browser preview)

**NON-NATIVE: not an iPhone.** Chromium renderings of Expo web (production bundle) against the local mock with demo
data.

**Versions:** before is `d4e9448`; after is the commit that adds this section.

**What changed**
- **Explore: the search it uses can be changed there (backlog 2.9).** The line «Fra Oslo (OSL) · 9. okt. – 16. okt. ·
  1 voksen» is now three buttons in one row that scrolls sideways: «Fra Oslo (OSL)» opens the airport search,
  «9.–16. okt.» opens the same range calendar as Home, and «1 voksen» opens the same travellers-and-cabin sheet (the
  cabin and «Bare direktefly» are added to the button when they are not the default). A destination then searches
  with exactly that. Before, all of it had to be changed on Home. The buttons are 36 pt with 44 pt targets; VoiceOver
  hears e.g. «Avreise fredag 9. oktober 2026, retur fredag 16. oktober 2026, 7 netter» and what a tap opens. With
  larger text the row scrolls instead of wrapping, so the destinations stay as high as before.
- **The travellers sheet is one component** (`TravellersSheet`), used by Home and Explore; Home is unchanged.
- **Saved: recent searches one line shorter (backlog 2.10).** The dates read «9.–16. okt.» as on Home instead of
  «fre. 9. okt. – fre. 16. okt.», which wrapped at 390 pt. VoiceOver still hears the full dates.

**Tests:** `exploreContext.test.tsx` (the three buttons, labels, hints and 44 pt targets; the airport search route;
new dates and travellers from Explore reach the search; the map view; no from-airport; one way; English) and
`savedLibrary.test.tsx` (the short span, full dates for VoiceOver).

**Checks:** Jest 560 passed, 3 skipped (UTC and Oslo). Typecheck and lint clean. iOS bundle 4 935 878 bytes. Bundle
check OK.

**Not verified:** a real iPhone.

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `explore-context-before-390.jpg` | `549f8274acd3d8dd…` | 780×1860 |
| `explore-context-after-390.jpg` | `7cb628f3b4f8706f…` | 780×1860 |
| `explore-context-after-390-dates.jpg` | `de6d940c90da620f…` | 780×1860 |
| `explore-context-after-390-travellers.jpg` | `a4c95136112a26af…` | 780×1860 |
| `explore-context-after-390-changed.jpg` | `b84dbc5f6bbc66ec…` | 780×1860 |
| `explore-context-after-375.jpg` | `6170ec3e86e8f66a…` | 750×1762 |
| `explore-context-after-430.jpg` | `803ad462afefe4de…` | 860×2002 |
| `explore-context-after-390-large.jpg` | `5e31d2fdb15465a9…` | 780×1860 |
| `explore-context-after-390-en.jpg` | `eee4a7937d54820f…` | 780×1826 |
| `saved-rows-before-390.jpg` | `20d5a40ec2324135…` | 780×1860 |
| `saved-rows-after-390.jpg` | `bf2cfff53cb0fe4b…` | 780×1860 |

## Review fixes for the Explore stage (independent review)

**Found by an independent reviewer (1 medium, 2 low; no high), all fixed:**
- **Explore's error goes away when the search is fixed there.** A destination tap with a passed departure date or no
  from-airport showed an error that stayed after the dates or the airport were corrected with the new buttons. The
  error now belongs to the search it was raised for, as on Home.
- **With the keyboard up, the first tap on a button works** (the row keeps taps like the page around it), instead of
  only closing the keyboard.
- **Saved rows keep each date on one line** («30. okt. – 6. nov.» only breaks at the dash), and a one-way search says
  «Én vei», so it no longer looks like a same-day round trip. Explore's date button says «Én vei» the same way.
- **Tests:** the error clearing after new dates and after choosing an airport in the real picker, taps with the
  keyboard up, the row padding that keeps the 44 pt targets, and Saved rows for one way, same day and two months.

**Checks:** Jest 563 passed, 3 skipped (UTC and Oslo). Typecheck and lint clean.

**Not verified:** a real iPhone.

## Filter sheet: headings stay at the top and are VoiceOver headings (browser preview)

**NON-NATIVE: not an iPhone.** Chromium renderings of Expo web (production bundle) against the local mock with demo
data (labelled DEMO).

**Versions:** before is `e133bf3`; after is the commit that adds this section.

**What changed (backlog 2.5)**
- **The filter sheet is long** (stops, bags, both legs' times, airlines, stop airports, price, longest leg). Each
  part's heading now stays at the top of the sheet while that part scrolls past, and the next heading pushes it away,
  so it is always clear which part a row belongs to. The headings sit on white, so rows never show through.
- **The headings are headings for VoiceOver** (they were plain text), so the rotor can jump between the parts. The
  counts per option, the order and the spacing are unchanged.

**Tests:** `filters.test.tsx` (headings in the sheet's order with the header role, exactly those headings stuck,
white behind them).

**Checks:** Jest 564 passed, 3 skipped (UTC and Oslo). Typecheck and lint clean. iOS bundle 4 937 030 bytes. Bundle
check OK.

**Not verified:** a real iPhone (sticky headers inside the sheet's scroll view, and VoiceOver's rotor).

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `sheet-heads-before-390.jpg` | `96f7fe47f64e27e9…` | 780×1860 |
| `sheet-heads-after-390.jpg` | `6680bab021c912fd…` | 780×1860 |
| `sheet-heads-after-390-via.jpg` | `82f613e7a39b1305…` | 780×1894 |
| `sheet-heads-after-390-large.jpg` | `259a220273f96d4f…` | 780×1826 |

## Home in the big search services' pattern (browser preview)

**NON-NATIVE: not an iPhone.** Chromium renderings of Expo web (production bundle) against the local mock. Home
itself shows no offer data; the shots after a search use demo data (labelled DEMO).

**Versions:** before is `9c0317f`; after is the commit that adds this section.

**Why:** Ali sent five momondo screenshots (25 Sep) and asked for the same UX, done better. We took the pattern,
not their colours, copy, prices or features we do not have (see DESIGN.md, «Momondo-skjermbilder», status 25.09).

**What changed (owner backlog 4.1)**
- **One calm dark panel** instead of a photo header and a white sheet: the question «Hvor vil du reise?» (signed
  in: «God kveld, Kari») with a round profile button, then Flights and Hotels as two equal tiles. The chosen tile
  has the same faint blue as the chosen tab at the bottom; solid blue is used only on «Søk fly».
- **Trip type as text tabs** (the chosen one light, with a blue line under it – not colour alone).
- **From and to stacked in one white field** with the swap button on the divider, like the reference. Each row
  has a takeoff or landing icon, so the fields need no labels; «Oslo (OSL)», or «Til hvor?» when empty. VoiceOver
  still hears «Til: ikke valgt».
- **Departure ▸ return in one white field** («fre. 23. okt. › fre. 30. okt.»); each half opens the calendar on
  its own date. One way: the return half becomes «+ Legg til retur». VoiceOver now hears the whole date
  («Avreise: fredag 23. oktober 2026»), not the abbreviation.
- **Travellers and cabin as chips** (40 pt, with hitSlop to 44 pt; 8 pt between rows, so the slop never reaches a
  neighbour). Both open the existing travellers sheet; «Bare direktefly» shows on the cabin chip when on.
- **Destinations as white cards** (photo, city, country and code, «Se flyreiser ›») – no prices, because we have
  no checked price before a search. Names wrap instead of being cut.
- **Not built: the collapsed «Finn fly» bar.** Home is about 1.3 screens (1020 pt of content at 390 × 844), so
  the form never scrolls out of view at normal text sizes and the bar would never show. It comes with a longer
  Home (backlog 4.6). A tap on the status bar already scrolls to the top.
- **Smaller app:** the header photo (`hero-wing.jpg`, 59 131 bytes) is no longer bundled; checked in the export.

**Tests:** `homeFirstView.test.tsx` (order, title and profile button for guests and signed-in customers, 44 pt
including the chips' hitSlop, empty field copy and colour, whole dates for VoiceOver, one way, tabs, tiles,
chips, destination cards and their search, the passed-date error above the cards), `edgeCases.test.tsx` (four
travellers and «Til hvor?» without line caps, nb and en), `coreFlowLayout.test.tsx`.

**Checks:** Jest 572 passed, 3 skipped. Typecheck and lint clean. iOS bundle 4 942 623 bytes (+5 593). Bundle check
OK.

**Not verified:** a real iPhone (SF Pro instead of Inter, real Dynamic Type sizes, VoiceOver on the tabs and
chips).

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `home-v2-before-390.jpg` | `ab33e9d46c18b5a7…` | 780×1860 |
| `home-v2-before-390-en.jpg` | `e7c6144d476eecb4…` | 780×1826 |
| `home-v2-after-375.jpg` | `d782c6848f2ebd91…` | 750×1830 |
| `home-v2-after-390.jpg` | `8010171913f04368…` | 780×1860 |
| `home-v2-after-430.jpg` | `91b1fc8eeec11eb2…` | 860×2002 |
| `home-v2-after-390-scrolled.jpg` | `89a8ab68cf219c95…` | 780×1860 |
| `home-v2-after-390-filled.jpg` | `2a5ad800c6b268ca…` | 780×1860 |
| `home-v2-after-390-recent.jpg` | `c4cab6de98adfe0b…` | 780×1860 |
| `home-v2-after-390-oneway.jpg` | `db848a3fa87722e0…` | 780×1860 |
| `home-v2-after-390-travellers.jpg` | `0e308bcd9e661235…` | 780×1860 |
| `home-v2-after-390-large.jpg` | `cc5d68821b6604f6…` | 780×1860 |
| `home-v2-after-390-xlarge.jpg` | `42828e6cf2fc19a0…` | 780×1860 |
| `home-v2-after-390-en.jpg` | `41a4a0bc08337bb3…` | 780×1826 |

## Profile as a settings list (browser preview)

**NON-NATIVE: not an iPhone.** Chromium renderings of Expo web (production bundle) against the local mock. The
signed-in shots use a preview test customer (Kari Nordmann, `kari@example.no`) that exists only in the local mock;
on the web the token sits in the browser's session storage instead of the iOS keychain (a preview-only patch).

**Versions:** before is `8bea822` (captured at `9c0317f`; the Profile screen did not change in between); after is the
commit that adds this section.

**What changed (owner backlog 4.3 and 2.14)**
- **Guests see a settings list, not a login form.** The title «Profil», then a white sign-in card: «Logg inn eller
  opprett en konto», what an account is («Én konto for appen og hellosky.no») and that search needs none, with
  «Logg inn» and «Opprett konto». Nothing is promised that the app does not do.
- **The form opens in its own sheet** (on iPhone the system page sheet, which can be dragged down; a drag closes it
  like «Lukk»). «Opprett konto» opens it on a new account. «Glemt passordet?» lies over the form in the same sheet.
  Closing clears the password; the e-mail stays. A successful login closes the sheet and shows the account.
- **Groups like iOS settings:** a heading on charcoal and a white card with rows. Innstillinger: the language as a
  choice in the row (one tap), and the currency as information – «Valuta · NOK · Alle priser vises i norske
  kroner» – with no arrow, because it cannot be changed. Hjelp og juridisk: the four hellosky.no pages as links. The
  app's version at the bottom (from app.json; hidden when not known).
- **Signed in:** «Hei, Kari», then Konto (name, e-mail, phone as rows, «Endre profil»), the same groups, and «Logg
  ut» and «Slett konto» as actions without an arrow (delete in red, with its text).
- **Large text:** «Norsk (bokmål)» in the language choice now wraps instead of being cut to «Norsk (bok…» (the
  segmented control had a one-line limit; it affected every segmented choice).
- Auth, the social buttons (still hidden until approved), forgot password, edit and delete are unchanged; the tests
  that fill the form now open the sheet first.

**Tests:** `profileList.test.tsx` (new: the card before any form, the sheet opening on login or a new account, the
page sheet with swipe-to-close, the password cleared on close, the sheet closing after login, settings rows,
links, version, the signed-in order and the red delete row), plus the existing account, social, Apple, Clerk,
language and VoiceOver-language tests through the sheet.

- **Fixed from the Home stage:** its signed-in test expected «God …» and failed between 00:00 and 05:00, when the
  greeting is «Hei». It now accepts every greeting the clock can give.

**Checks:** Jest 581 passed, 3 skipped (UTC and Oslo). Typecheck and lint clean. iOS bundle 4 948 283 bytes
(+5 660). Bundle check OK.

**Not verified:** a real iPhone (the page sheet, dragging it down, the keyboard in it, VoiceOver in the sheet).

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `profile-v2-before-390.jpg` | `ecab0d3bf74636f8…` | 780×1894 |
| `profile-v2-after-375.jpg` | `2a085642464d6268…` | 750×1796 |
| `profile-v2-after-390.jpg` | `0cabfcc504fcb1e4…` | 780×1860 |
| `profile-v2-after-430.jpg` | `2b09e8033c76a002…` | 860×2002 |
| `profile-v2-after-390-scrolled.jpg` | `dfd97e55804737a2…` | 780×1894 |
| `profile-v2-after-390-login.jpg` | `3c5f7040ecb02307…` | 780×1894 |
| `profile-v2-after-390-login-error.jpg` | `b39b2e90301b4cdb…` | 780×1860 |
| `profile-v2-after-390-register.jpg` | `3e2fec4b93c68f56…` | 780×1860 |
| `profile-v2-after-390-signed-in.jpg` | `580f54a87e4a0a93…` | 780×1860 |
| `profile-v2-after-390-signed-in-scrolled.jpg` | `4d7cca5448367da5…` | 780×1860 |
| `profile-v2-after-390-large.jpg` | `a6ae05da30fac630…` | 780×1860 |
| `profile-v2-after-390-large-settings.jpg` | `70bd28e70b1c31c3…` | 780×1860 |
| `profile-v2-after-390-en.jpg` | `2a7cda05e6fda699…` | 780×1826 |
| `profile-v2-after-390-en-login.jpg` | `bc2c7044f2b3b18d…` | 780×1826 |

## Tab bar as a floating capsule (browser preview)

**NON-NATIVE: not an iPhone.** Chromium renderings of Expo web (production bundle) against the local mock.

**Versions:** before is `8bea822` (the flat bar is unchanged in `7b92dcf`); after is the commit that adds this
section.

**What changed (owner backlog 4.4)**
- **The tab bar is a floating capsule**, like the reference and newer iOS: the raised charcoal surface, fully
  rounded, 16 pt from the screen edges, with a soft shadow and a hairline edge. The chosen tab keeps its blue pill
  behind the icon and its blue label; every tab is still at least 48 pt tall.
- **Above the home indicator:** the capsule ends 26 pt above the bottom edge on phones with a home indicator (8 pt
  without), clear of the system gesture. The whole bar is 88 pt at 390 × 844 (it was 90).
- **Nothing hides under it:** the screens still end above the bar, so no screen needed new bottom padding and the
  last row of every list stays reachable. No glass: a blurred background needs a new dependency, and a see-through
  surface without blur looks muddy on photos.

**Tests:** `savedLibrary.test.tsx` («fire faner»: the capsule's shape and margins, at least 24 pt from the bottom
with a home indicator; the tabs, selection and 44 pt as before).

**Checks:** Jest 581 passed, 3 skipped (UTC and Oslo). Typecheck and lint clean.

**Not verified:** a real iPhone (the shadow and the gap above the home indicator on a device).

| File | SHA-256 (prefix) | Size (px) |
|---|---|---|
| `tabs-v2-before-390-bottom.jpg` | `00a9bf456305cfa7…` | 780×660 |
| `tabs-v2-after-390-bottom.jpg` | `2ed9f97fc78c4fe1…` | 780×660 |
| `tabs-v2-after-375-home.jpg` | `248b15e1d5e78db7…` | 750×1762 |
| `tabs-v2-after-430-home.jpg` | `d0ee7477e7760cf1…` | 860×2002 |
| `tabs-v2-after-390-explore.jpg` | `d96f20480503e0ba…` | 780×1826 |
| `tabs-v2-after-390-explore-map.jpg` | `7da69d9262e8ec02…` | 780×1860 |
| `tabs-v2-after-390-saved.jpg` | `7eeb27e47e7b84a5…` | 780×1826 |
| `tabs-v2-after-390-profile.jpg` | `deab2495672824a0…` | 780×1826 |

## Review fixes for the Home, Profile and tab bar stages (independent review)

**Found by an independent reviewer (3 medium, 7 low; no high), all fixed except where noted:**
- **Profile starts at the top after login, logout, deletion and an ended session.** Both states used the same
  scroll view, so after deleting from the bottom of the list the «Kontoen din er slettet» message and the sign-in
  card were above the screen. Each state now has its own list.
- **Account rows give the value the full width:** «Kari Nordmann» over «Navn», the e-mail over «E-post», so a
  long name or address no longer squeezes the label to nothing; VoiceOver hears «Navn: Kari Nordmann». A value
  at the right (NOK) takes at most 55 % of the row.
- **Tests no longer expire:** six suites (the new Home tests and five older ones) searched with 23–30 October and the
  real clock, so the suite would have failed from 24 October. The clock is now pinned in those suites
  (`src/test/clock.ts`: only `Date`, timers run normally). Checked by running the whole suite with the clock moved
  to 24 Oct 2026 and to 1 Jun 2027: all pass.
- **A typed password is cleared on every sign-in,** also with Google or Apple, which do not go through the form.
- **While a sign-in runs,** «Glemt passordet?» and switching to a new account do nothing (no sheet over a sheet
  that is about to close).
- **Sheets move up for the keyboard** (forgot password, edit profile, delete account): the field and the button were
  under the keyboard.
- **Home:** the swap button stays on the divider when a city name wraps; a long travellers or cabin chip wraps
  inside the chip; a date never breaks between «23.» and «okt.»; the guest button is called «Din profil», because
  it opens Profile. The tab bar now has the role «tabbar», which gives it iOS' tab-bar trait («tablist» gives none), so VoiceOver
  can read the tabs as tabs («fane, 1 av 4»; not checked on a device).
- **Tests made stricter:** the tab bar's exact distance from the bottom (26 pt with a home indicator, 8 without),
  and the check for staff words now also covers the sign-in sheet.
- **Docs:** README and the Home rows in DESIGN.md (H2–H5, re-measured: «Søk fly» ends at 539 / 548 / 548 pt with
  the bar at 724 / 764 / 844; 59 / 90 / 170 pt of the first destination photo above it).
- **Not changed:** `assets/photos/hero-wing.jpg` and `scripts/make-photos.mjs` (outside the app source; the photo
  is no longer bundled). The in-page tab roles (backlog 4.9).

**Tests:** `profileList.test.tsx` (the list starts at the top after login and logout, the password cleared after a
Google sign-in, the guards while a sign-in runs, the capped value), `homeFirstView.test.tsx` (the swap button on
the divider, «Din profil»), `savedLibrary.test.tsx` (exact distances, «tabbar»), and the pinned clock in six suites.

**Checks:** Jest 586 passed, 3 skipped (UTC and Oslo; also with the clock at 24 Oct 2026 and 1 Jun 2027).
Typecheck and lint clean. iOS bundle 4 949 335 bytes. Bundle check OK.

**Not verified:** a real iPhone (the keyboard over the sheets, VoiceOver's reading of the tab bar).
