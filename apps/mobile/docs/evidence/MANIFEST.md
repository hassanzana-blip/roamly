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
