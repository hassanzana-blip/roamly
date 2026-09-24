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
