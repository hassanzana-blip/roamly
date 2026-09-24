# HelloSky iOS app: the 60-item backlog

Status on 2026-09-23. It is based on a read-only audit (7 agents,
file:line evidence) plus the work done since. Branch
`claude/bold-shannon-0wuhsd`, updated with the account and security batch.
`local` means committed or in progress here but not pushed yet.

**Statuses**
- **verified:** done, with tests, at the named commit.
- **partial:** some of it works; the gap is listed.
- **missing:** nothing yet.
- **blocked:** needs access or a decision outside this repo.

**Owners:** app and mobile API are Claude's. Release, EAS, CI and SEO are
Codex's (ChatGPT).

**Commits referred to below**

| Commit | What it did | Status |
|---|---|---|
| `3046d65` | English by default and truthful result status | pushed |
| `2b8ee6f` | "unverified" status; timeouts cover the response body | pushed |
| `ca5ffb9` | Jest live-test transport | pushed |
| `5230535` | Conditions: "allowed for a fee" | pushed |
| `96f6c9f` | Screenshot evidence | pushed |
| `83ce160` | Unknown bag restriction reads "not stated" | pushed |
| `a7b7537` | Airline, price, longest-leg and return-time filters | pushed |
| `d8c3e68` | hellosky.no hand-off for HelloSky-sold offers; share link; Edit search | pushed |
| `4947657` | Release checks, SEO fixes (Codex) | pushed |
| `79565c3` | Calendar date validation; MySQL job clock (Codex) | pushed |
| `677da1e` | Icon repair; mobile CI job (Codex) | pushed |
| `8325293` | Web route scrolling; result card totals (Codex) | pushed |
| `60b052a` | Expo SDK 57 config and dependency alignment (Codex) | pushed |
| `5f8567a` | Clicks on KAYAK offers are recorded (web + app) | pushed |
| `83398da` | Register returns the real referral code | pushed |
| `8610e32` | Click dedupe (offer + IP, 10 min) and per-IP / per-offer caps | pushed |
| `0962f90` | Account services over Bearer, with the review's security fixes; **today's deletion scope** | pushed |
| `3285865` | App account screens, expired session, draft restore | pushed |
| `b4ff05b` | Accessibility: 44pt, reduced motion, modal sheets, stepper, announcements | pushed |
| `dbb5bb2` | Denser result cards | pushed |
| `5b30529` | No cross-surface bypass: verified phone change and fresh-login deletion on web and app | pushed |
| `13fe57c` | Recent searches, usual departure airport, airport suggestions | pushed |

## Needs Ali's approval (nothing here is pushed)

1. **Account deletion beyond today's policy.** Today the web deletes the
   account, saved travellers, price alerts, bonus, identities, login codes
   and community posts. It revokes sessions and keeps bookings, with the
   account link removed, as accounting records. A reviewed extension also:
   - deletes sessions instead of revoking them;
   - deletes price alerts, price watches, travel profile, saved items,
     search history, notifications, trip plans, documents (with their
     encrypted files), social posts, friendships, group memberships and
     polls, ReiseMatch data and trip boards;
   - moves owned travel groups to the oldest active member;
   - removes the account link from checkout sessions, provider clicks,
     consents and fraud flags (consents keep the e-mail);
   - deletes account-only e-mail events;
   - clears the first-name label in the audit log;
   - deletes reports the customer filed;
   - deletes the Clerk user in the background (Apple token revocation is
     still unconfirmed);
   - adds a one-off cleanup for accounts deleted earlier (written, not run).

   It is held in a separate commit marked HELD (local branch
   `facade-gated-on-main-trial`, `fddfddc`, 103/103 integration tests). It
   needs yes or no per line, new wording on the web and in the app, and a
   check with Clerk that deleting the user also revokes the Apple token.
   What shipped (`0962f90`) keeps today's scope exactly; tests fail if it
   deletes more.
2. **Privacy policy and terms for the app.** hellosky.no's privacy and terms
   pages do not mention the iOS app. That is legal text and Ali's call.
3. **Contact channels.** The phone and e-mail in the web config come from
   environment fallbacks and are unverified, so the app links only to
   hellosky.no/hjelp.

Staging deploys are already covered by Ali's development mandate; Codex
runs them from a green CI candidate.

## Mobile API map (item 1)

`/api/mobile/trpc` uses the same Railway backend, database and services as
the web, with a Bearer token instead of a cookie.

**On the facade today (pushed):**
- `ping`
- `mobileAuth`: register, login, requestLoginCode, verifyLoginCode,
  exchangeSocialToken, me, logout, logoutAll. These are the web's own
  registerCustomer, passwordLogin, socialLogin and verifyLoginCodeLogin
  services.
- `mobileAuth` (`0962f90`): requestPasswordReset, updateProfile,
  requestPhoneChange, confirmPhoneChange, deleteAccount, using the web's
  reset, profile and deletion services.
- `flights`: airports and trackProviderClick (the same procedure objects as
  the web), and search (runFlightSearch in NOK, with Norges Bank
  comparison prices).

**Deliberately not exposed:**
- staff, admin and owner routes (the staff boundary is tested);
- checkout, orders and in-app booking (the app hands off to providers);
- `account.saved` / search history, and `watch.*` price alerts (see items 37
  and 39).

## Items

| # | Item | Status | Evidence / gap / next |
|---|---|---|---|
| 1 | Customer API inventory vs mobile | verified | See the map above. |
| 2 | Mobile search and airports against deployed staging | verified (by Codex) | The app's client passes against Railway staging: OSL airports 200, anonymous `me` = null, OSL→BCN 16 offers. The Jest live suite passes 3/3 after `ca5ffb9`. Staging answers `provider=demo, sandbox=true`, so real provider data is **not** proven. This container can't reach Railway (proxy 403). |
| 3 | Same customer records; staff isolated | verified | Shared services; `api/test/mobileAuth.it.ts` (staff cannot sign in, no staff route). Staging, 23 Sep 21:42 UTC (Codex, `docs/RELEASE_EVIDENCE.md`, «Shared-account checks»), source `18ad2ea`: nine HTTP checks PASSED with the actual mobile client and the web cookie API. Registration on either side reaches the same customer ID. Profile edits show up across both. A mobile token cannot bypass phone verification through the web route. Logout-all and single-session logout revoke exactly the right sessions. The fixtures are two `example.invalid` accounts, with no mail transport. Not covered there: native SecureStore and the interactive screens. |
| 4 | Original HTTPS hand-off; one click per tap | verified | One tap = one tracking call = one browser (`3046d65`). KAYAK clicks are recorded (`5f8567a`), deduplicated per offer and IP, and capped (`8610e32`); integration tests in `mobileFlights.it.ts`. Known limit: the click store is per process, so a restart or another replica gives `clickRef: null` (the link still opens). |
| 5 | Demo / sandbox / partial / live shown truthfully | verified | `2b8ee6f`: "live" only with a known provider and `sandbox: false`, otherwise "unverified". Tests: `resultStatus.test.ts`, `languageTrust.test.tsx`.. `ad92afc`: the mobile search shows only offers for the requested airports, dates and legs. Provider offers that start or end at another airport (e.g. TRF for OSL), depart on another day, or have a missing, extra or empty leg are excluded and counted (each with its own reason, never guessing which leg is missing); a layover airport change within a leg is kept. Results says how many were held back and why, and shows no stand-in fares. Tests: `mobileFlights.it.ts` (the 3 exclusion tests fail on the old code) and `requestMismatch.test.tsx`. Web and provider adapters are unchanged |
| 6 | Price freshness, expired offers | partial | Results warn after 15 min and can refresh; an expired offer gets "search again" or "continue anyway" (`3046d65`). No revalidation is invented. `ad92afc`: Details re-checks exactly when the chosen seller's offer expires (screen left open), when the app returns to the foreground, and at the tap itself. A tap that finds the offer expired opens and tracks nothing and shows the warning; only the explicit «continue anyway» goes on. `offerExpiry.test.tsx` (5 of its 6 tests fail on the old code). |
| 7 | Passenger totals and NOK FX provenance | partial | `priceMode: total`; Norges Bank rate and date shown; "approx." marked. `d364212`: KAYAK's current docs say PriceMode is total/perPerson (default perPerson) and PollResponse carries priceMode and passenger counts. «Totalt for …» is now shown only when the response says «total» and its counts match the searched party exactly (perPerson only for exactly one matching traveller). Everything else keeps the amount but is labelled «Tilbyderens pris, total ikke bekreftet», with a notice, a neutral sort label and no price filter. Nothing is ever multiplied. Not verified against a live multi-traveller KAYAK response (staging is demo). |
| 8 | Norwegian Bokmål first, typed dictionary, English as a saved choice | verified | `3046d65` + `2b8ee6f`: `nb: typeof en` catches missing keys at compile time. Owner brief (23 Sep): a fresh install starts in Bokmål, and a saved choice (English or Bokmål) is kept. The default is never written as a choice, on the phone or on the account: a profile save sends `locale` only when the customer chose one (`languageTrust.test.tsx`, `account.test.tsx`). iOS `CFBundleLocalizations` lives in app.json (Codex); `CFBundleDevelopmentRegion` is `nb` since `6b400fd` (native fallback language, needs a dev build to check). `00d18db`: a prefs file from another app version is kept byte for byte. Its known keys are still read, so a saved English choice keeps working. Only a deliberate language choice is merged in, keeping `v` and the unknown fields. A file that cannot be read is never overwritten, and a failed write never crashes (`localStore.test.ts`, `languageTrust.test.tsx`). |
| 9 | Language switch persists, before login and in Profile, no restart | verified | `languageTrust.test.tsx` (switch, remount, same request in both languages). Saving the profile also stores the language on the account (`3285865`). |
| 10 | Localized dates, plurals, a11y labels, validation, errors | partial | Formatters take the locale; errors map by code. Gap: some server messages are Norwegian only (e.g. VALIDATION details). |
| 11 | Account locale on registration | verified | `3046d65`: register sends the app language (`api.test.ts`, `mobileClient.it.ts`). |
| 12 | Password recovery through the web's safe flow | verified | `0962f90`: the web's reset flow over the mobile API. The lookalike-address takeover (review blocker) is fixed: the link goes only to the stored, exactly matching address, ASCII only, with a per-account cap and a timing floor (`mobileAccount.it.ts`). `3285865`: the app sheet gives a neutral answer (`account.test.tsx`). |
| 13 | In-app account deletion | partial | Shipped (`0962f90`, `3285865`): password, or DELETE/SLETT with a login under 10 min old; a wrong password changes nothing; idempotent under a double tap; the token is cleared. Scope is today's web policy. Held for approval: the full data purge and Clerk/Apple cleanup (approval 1). |
| 14 | Profile editing | verified | `3285865`: name and language, with the server's rules shown at the field and an immediate refresh. The phone number is a login key, so it changes only through the SMS-verified flow (`0962f90`, server). The app UI for that flow is not built; the web has it (Codex, `3290525`). New accounts register with e-mail only (see "Phone registration"). |
| 15 | Session expiry, offline, relaunch keep the search | verified | `3285865`: a session that has ended (at launch, while saving or while deleting) signs out with "your search is still here"; the token lives only in the keychain; after an offline launch the account is fetched again when the app returns to the foreground. Gap: no offline banner before a request fails. |
| 16 | Privacy, terms, help, contact | partial | `3285865`: hellosky.no/hjelp, /personvern, /vilkar and /om-oss open in a Safari view, marked "in Norwegian" in English. Blocked: app-specific legal text and verified contact channels (approvals 2–3). |
| 17 | Plain explanation of HelloSky | verified | Home (`2b8ee6f`), the details hand-off note, and "How HelloSky works" in Profile (`3285865`). |
| 18 | No inert primary controls | verified | `d8c3e68`: HelloSky-sold offers now open the same search on hellosky.no; an unsafe link gets no button; "Edit search" always reaches the form (tested). |
| 19 | Recent searches stored locally, with remove and clear | verified | `13fe57c`: on the phone only, at most 6, the same journey moved up; one tap searches again; remove each or clear all; past dates roll forward; no account data or prices stored (tests). |
| 20 | Draft restored after relaunch without stale dates | verified | `3285865`: `parseDraft`; past dates roll forward with the same trip length (tested); no token, name or e-mail is stored. |
| 21 | Preferred departure airport | verified | `13fe57c`: only when the customer turns on "Remember as my usual departure airport"; shown with "Forget"; a new form starts from it (tests). |
| 22 | Airport autocomplete: recent and popular | verified | `13fe57c`: before typing, the picker shows recent airports, then Norway's main airports (From) or the app's destinations (To), labelled as what they are, never "popular" without data. No matches: "Clear the search". |
| 23 | Calendar bounds | partial | Minimum date only; no maximum (the provider horizon isn't known). Codex fixed web date validation in `79565c3`. |
| 24 | Traveller and cabin sheets | partial | Caps and infant rules exist; no UI test of the sheet. |
| 25 | Edit the search from results | partial | `d8c3e68`: "Edit search" goes to the form with the search kept. Gap: the results header reads the current form, which can differ from the results if the form is changed without searching. |
| 26 | Airline filter | verified | `a7b7537`: airlines from the answer with counts; a journey matches when any of its flights is by a chosen airline (unit + screen tests). |
| 27 | Maximum price filter (NOK totals) | verified | `a7b7537`: limits from the quartiles of the actual NOK totals; offers without a NOK price are hidden while a limit is set, and the sheet says so. |
| 28 | Duration filter (unknown handled) | verified | `a7b7537`: longest leg, each way, in whole hours; unknown durations are hidden while a limit is set. |
| 29 | Outbound and return time filters | partial | `a7b7537`: departure bands both ways. Gap: no arrival-time filters. |
| 30 | Airport-change, overnight and long-layover warnings before hand-off | verified | `3046d65`: warning box above the hand-off button (tested). |
| 31 | Bag and refund/change: included / not included / unknown / fee | verified | `5230535`: "allowed for a fee" (KAYAK, Duffel, demo, web + app); `83ce160`: unknown bag restriction = "not stated". |
| 32 | Compare all providers for the same journey | partial | Sellers are grouped within one search, with price, bags and terms kept in step; different providers are not merged. |
| 33 | Sort labels explained, stable | partial | Summaries on each option. Gap: nothing explains how estimated "approx." prices rank. |
| 34 | Filters persist within a search, live counts, clear all | partial | Filters are lost when the search is re-run. |
| 35 | Cancellable slow search, race-safe | partial | Cancel, abort, sequence guard; the timeout covers the body (`2b8ee6f`). Gap: `retryable` is ignored in the UI. |
| 36 | Empty, error and offline states keep the input | partial | The input is kept; recovery is generic. |
| 37 | Saved flights / shortlist | missing | The server has saved items (web only); exposing them is a later facade step. Never implies a fare is reserved. |
| 38 | Native share with a safe web fallback | verified | `d8c3e68`: the share text says the price may have changed and carries the same search on hellosky.no (no token, session or provider link; tested). |
| 39 | Price alerts only if real | blocked | The server has `watch.*` (web only). The worker, live Duffel and SMTP can't be checked from here, so no switch is shown. |
| 40 | Explore: search and context | partial | Static list of 24 destinations; no search or filter. |
| 41 | Compact hierarchy | verified (web, simulated safe area) | `dbb5bb2`: result cards 359 → 243 pt. `dad15c4` (measured, `docs/evidence`): at 375/393/430 the Home destinations show 77/108/132 pt of photo above the tab bar, the next journey is 90/100/100 % visible, and the Details bar is 131 pt. The demo warning stays visible. Not yet checked on a device. |
| 42 | Small and large phones, keyboard, long strings | partial | Safe areas on every screen. Gaps: no keyboard handling in the airport picker; fixed widths and one-line labels can clip long English strings; nothing checked on a device (web captures only). `dad15c4`: the offer bar and primary buttons wrap instead of clipping; at 135 % text nothing is cut and nothing overflows sideways (web approximation, not Dynamic Type). `00d18db` + `be41be4`: four travellers and long seller names at 375 pt, nb and en, normal and 135 % text. Nothing is cut and no word is split: the seller price moves below text that does not fit beside it (web approximation; MANIFEST). |
| 43 | VoiceOver order, roles, announcements | partial | `b4ff05b`: modal sheets with the escape gesture; the backdrop hidden from VoiceOver; an adjustable stepper with a value and actions; results announced; the wordmark no longer a heading (`a11y.test.tsx`). `00d18db`: explicit `accessibilityLanguage` (nb-NO/en-GB) on every text, button, switch, field, accessible group and sheet root. The language names in Profile use their own language. A tree test checks every focusable element on Home, Results, Details, the airport picker and Profile, in both languages (`a11yLanguage.test.tsx`). Not yet checked with VoiceOver on a device. |
| 44 | Dynamic Type, contrast, touch targets, reduced motion | partial | Theme contrast ≥ 4.5:1 (disabled text 4.37, exempt). `b4ff05b`: 44pt minimum on secondary buttons, segments and tabs; Reduce Motion makes sheets fade and photos appear without a transition. Gap: Dynamic Type never tested at large sizes. `dad15c4`: «Om «ca.»-priser» is a real 44 pt row; filter chips reach 44 pt inside their scroll view. |
| 45 | Loading and tap feedback | partial | No skeletons. |
| 46 | Performance measured | partial | Nothing measured yet. |
| 47 | Settings layout: credits below help | verified | `3285865`: account, language, help and legal, log out, delete account; photo credits collapsed at the bottom. |
| 48 | Icon, splash, logo | partial | Icon repaired (`677da1e`); splash via the SDK 57 `expo-splash-screen` plugin (`60b052a`), both by Codex. Gap: three brand blues; the white splash against the dark app. |
| 49 | End-to-end tests | partial | 146 app Jest tests (screens with a mocked router), 516 root unit, 180 integration; env-gated live suite. No device end-to-end. |
| 50 | Private preview (EN + NB, fixtures labelled) | partial | PNG evidence in `docs/evidence`, re-captured at `79c2730` as one traceable first-card → details flow (offer `dy_eve`, checked automatically). Interactive preview being republished from `79c2730`. |
| 51 | EAS configuration | partial (Codex) | `60b052a`: SDK 57 config and dependencies aligned; Expo Doctor 21/21; native config introspection passes. Not verifiable here: that owner, bundle ID and ASC app ID match the registered accounts. |
| 52 | Signed build and real-device smoke test | in progress (Codex) | A simulator build within the free quota, to catch native compile errors. A signed device build and TestFlight need Ali's approval; nothing is submitted. |
| 53 | CI green | verified (Codex) | `8325293`: full CI green, including 40/40 E2E. `60b052a`: mobile CI job (types, lint, tests, assets, iOS export, bundle scan, Doctor) green. |
| 54 | Safe analytics | partial | search_events and provider_clicks on the server. No filter analytics. |
| 55 | Crash reporting | partial | Server Sentry is optional. The app has none; no paid service without approval. |
| 56 | Web crawlability (Codex) | partial | Codex's assessment. |
| 57 | Route and destination pages | partial | Codex. |
| 58 | EN/NB web metadata, hreflang | partial | The web is Norwegian only; no hreflang without real equivalents. |
| 59 | App Store copy and privacy labels | missing | After approvals 1–3. |
| 60 | Final handover | partial | This file plus `docs/evidence`; handover with the top 10 at the end. |

## Known risks

- Staging answers with demo data. The first real-provider run of the app is
  still to come.
- The KAYAK click store is in memory: after a restart or on another replica
  a click is not recorded, but the link still opens.
- Accounts registered with a phone number before registration was closed
  still have that unverified number as a login key. See "Phone
  registration" below.

## Phone registration (security; closed for new accounts)

**The problem** (Codex's review). Registration accepted a phone number and
made it a login key at once, with a password, without proof that the
number was yours. Anyone could register someone else's number first. When
the owner later signed in with an SMS code, they would land in an account
the other person holds the password for.

**What this change ships (the narrow option):**
- New accounts are created with an e-mail address only, on the web and in
  the app. Both call the same server function. A phone number gets
  `VALIDATION` with `reason: "phone_registration_unavailable"` before any
  lookup, so a taken number and a free number get the same answer.
- Accounts that already have a phone keep working. Password login and
  SMS-code login are unchanged. No customer data is changed and no
  "verified" flag is added.
- A number is added or changed only through the SMS-verified flow
  (`requestPhoneChange`/`confirmPhoneChange` on both routers, `5b30529`).
  The account's other phone writes only keep the same number or remove it.
- The app never offered phone registration: its field accepts only an
  e-mail address, and a test now pins that.
- Tests: 4 in `api/test/mobileAccount.it.ts` (the two security tests fail
  on the old code) and 1 in the app.

**Web copy (closed; the earlier warning here was stale).** Checked on this
branch: since `6b400fd` (Codex), `src/pages/Auth.tsx` in register mode shows
- the e-mail label (`common.email`), `type="email"` and the e-mail
  placeholder (`common.emailph`);
- the hint "Use an e-mail address you can access…" (`au.identifier.hint`);
- the subtitle "Name, e-mail and password. You can add a phone number with
  SMS verification in your profile." (`au.register.sub`).

"E-mail or phone number" (`au.identifier`, `au.identifier.ph`) is used for
login only. No web code was changed here.

**Remaining risk.** Accounts registered with a phone number before this
change keep it as a login key. The audit log records them as
`customer.registered` with `via: "phone"`, so they can be counted without
changing any data. That count has not been done. What to do about them is
a product decision. For example: ask for an SMS code once before the next
password login, or send the number's owner a notice.

**Proposed SMS-verified registration (not built; needs review).**
1. `requestRegistrationCode({ phone })`: rate limits per IP and per number,
   and the answer is always `{ ok: true }`. A free number gets a 6-digit
   code. A number that already has an account instead gets an SMS saying
   "you already have an account, sign in with a code". Only the number's
   owner sees the difference.
2. The pending code is stored hashed, with a 10-minute expiry and an
   attempt limit. This needs a new table (an additive migration). A sealed
   stateless challenge would avoid the migration, but it cannot be made
   single-use without storage.
3. `confirmRegistration({ phone, code, password, names })` creates the
   account and a session only if the code matches. If the number was taken
   in the meantime, it returns the same generic error.
4. UX: a code step in register mode, on the web (Codex) and in the app.
5. Cost: one SMS per registration attempt, through the existing SMS
   provider. That raises volume, so it needs Ali's OK before it goes live.
