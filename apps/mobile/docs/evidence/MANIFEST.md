# iOS app: before/after screenshots (fixture data)

**These are not live results and not an iOS build.** Every image is a web
rendering of the app's own code (`apps/mobile`, Expo for web in Chromium),
fed with hand-made demo data. The caption bar on each image says so.

| | Commit | Languages |
|---|---|---|
| Before | `bc7ffab` (black/white/blue design) | Norwegian only; the app had no English then |
| After | `5230535` | English (the default) and Norwegian (a saved choice in Profile) |

Screens: 1 home, 2 results (Oslo → Barcelona), 3 flight details (Norwegian
DY1872, first seller), 4 profile, signed out.

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

## What changed (bc7ffab → 5230535)

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

Not in these images yet: the account screens (edit profile, forgot
password, delete account, help and legal links). They wait on the backend
account endpoints, which are still being fixed after the security review.
They will be added as a new "after" set once pushed.

## Files

| File | SHA-256 (prefix) |
|---|---|
| `before-bc7ffab-nb-1-home.png` | `355d958de04d2eab…` |
| `before-bc7ffab-nb-2-results.png` | `dc6b01f687da7381…` |
| `before-bc7ffab-nb-3-details.png` | `0d48432444a636c3…` |
| `before-bc7ffab-nb-4-profile.png` | `8c6d8b9efc410e6c…` |
| `after-5230535-en-1-home.png` | `e7e31436e49d5878…` |
| `after-5230535-en-2-results.png` | `1abe60860208357e…` |
| `after-5230535-en-3-details.png` | `fdb9ac43e16b6161…` |
| `after-5230535-en-4-profile.png` | `ad4eacf9516f8677…` |
| `after-5230535-nb-1-home.png` | `7a415b4239019b8c…` |
| `after-5230535-nb-2-results.png` | `fcf5c04fc493b66e…` |
| `after-5230535-nb-3-details.png` | `9222f85498d0ee27…` |
| `after-5230535-nb-4-profile.png` | `3a034a0653959ae7…` |

Each image is 786×1809 px: a 2× capture of a 393×852 viewport plus the
caption bar.
