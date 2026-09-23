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
| 3 | Same customer records; staff isolated | verified | Shared services; `api/test/mobileAuth.it.ts` (staff cannot sign in, no staff route). Live proof so far is anonymous only. |
| 4 | Original HTTPS hand-off; one click per tap | verified | One tap = one tracking call = one browser (`3046d65`). KAYAK clicks are recorded (`5f8567a`), deduplicated per offer and IP, and capped (`8610e32`); integration tests in `mobileFlights.it.ts`. Known limit: the click store is per process, so a restart or another replica gives `clickRef: null` (the link still opens). |
| 5 | Demo / sandbox / partial / live shown truthfully | verified | `2b8ee6f`: "live" only with a known provider and `sandbox: false`, otherwise "unverified". Tests: `resultStatus.test.ts`, `languageTrust.test.tsx`. |
| 6 | Price freshness, expired offers | partial | Results warn after 15 min and can refresh; an expired offer gets "search again" or "continue anyway" (`3046d65`). No revalidation is invented. Gap: on the details screen, expiry is checked only when it renders. |
| 7 | Passenger totals and NOK FX provenance | partial | `priceMode: total`; Norges Bank rate and date shown; "approx." marked. Gap: the response's `priceMode` is not checked. |
| 8 | English default, typed dictionary, Norwegian alternative | verified | `3046d65` + `2b8ee6f`: `nb: typeof en` catches missing keys at compile time. iOS `CFBundleLocalizations` lives in app.json (Codex). |
| 9 | Language switch persists, before login and in Profile, no restart | verified | `languageTrust.test.tsx` (switch, remount, same request in both languages). Saving the profile also stores the language on the account (`3285865`). |
| 10 | Localized dates, plurals, a11y labels, validation, errors | partial | Formatters take the locale; errors map by code. Gap: some server messages are Norwegian only (e.g. VALIDATION details). |
| 11 | Account locale on registration | verified | `3046d65`: register sends the app language (`api.test.ts`, `mobileClient.it.ts`). |
| 12 | Password recovery through the web's safe flow | verified | `0962f90`: the web's reset flow over the mobile API. The lookalike-address takeover (review blocker) is fixed: the link goes only to the stored, exactly matching address, ASCII only, with a per-account cap and a timing floor (`mobileAccount.it.ts`). `3285865`: the app sheet gives a neutral answer (`account.test.tsx`). |
| 13 | In-app account deletion | partial | Shipped (`0962f90`, `3285865`): password, or DELETE/SLETT with a login under 10 min old; a wrong password changes nothing; idempotent under a double tap; the token is cleared. Scope is today's web policy. Held for approval: the full data purge and Clerk/Apple cleanup (approval 1). |
| 14 | Profile editing | verified | `3285865`: name and language, with the server's rules shown at the field and an immediate refresh. The phone number is a login key, so it changes only through the SMS-verified flow (`0962f90`, server). The app UI for that flow is not built; the web still changes it directly (web UI needed). |
| 15 | Session expiry, offline, relaunch keep the search | verified | `3285865`: a session that has ended (at launch, while saving or while deleting) signs out with "your search is still here"; the token lives only in the keychain; after an offline launch the account is fetched again when the app returns to the foreground. Gap: no offline banner before a request fails. |
| 16 | Privacy, terms, help, contact | partial | `3285865`: hellosky.no/hjelp, /personvern, /vilkar and /om-oss open in a Safari view, marked "in Norwegian" in English. Blocked: app-specific legal text and verified contact channels (approvals 2–3). |
| 17 | Plain explanation of HelloSky | verified | Home (`2b8ee6f`), the details hand-off note, and "How HelloSky works" in Profile (`3285865`). |
| 18 | No inert primary controls | verified | `d8c3e68`: HelloSky-sold offers now open the same search on hellosky.no; an unsafe link gets no button; "Edit search" always reaches the form (tested). |
| 19 | Recent searches stored locally, with remove and clear | missing | Next (batch E): on-device only. |
| 20 | Draft restored after relaunch without stale dates | verified | `3285865`: `parseDraft`; past dates roll forward with the same trip length (tested); no token, name or e-mail is stored. |
| 21 | Preferred departure airport | missing | Batch E. |
| 22 | Airport autocomplete: recent and popular | partial | Server lookup with KAYAK fallback. No recent or popular; no one-tap recovery. |
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
| 41 | Compact hierarchy | partial | Before/after images: `docs/evidence`. |
| 42 | Small and large phones, keyboard, long strings | partial | Safe areas on every screen. Gaps: no keyboard handling in the airport picker; fixed widths and one-line labels can clip long English strings; nothing checked on a device (web captures only). |
| 43 | VoiceOver order, roles, announcements | partial | `b4ff05b`: modal sheets with the escape gesture; the backdrop hidden from VoiceOver; an adjustable stepper with a value and actions; results announced; the wordmark no longer a heading (`a11y.test.tsx`). Not yet checked with VoiceOver on a device. |
| 44 | Dynamic Type, contrast, touch targets, reduced motion | partial | Theme contrast ≥ 4.5:1 (disabled text 4.37, exempt). `b4ff05b`: 44pt minimum on secondary buttons, segments and tabs; Reduce Motion makes sheets fade and photos appear without a transition. Gap: Dynamic Type never tested at large sizes. |
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
- Registering with a phone number never verifies the number (pre-existing,
  web and app). Fixing it needs SMS-verified registration and a product
  decision.
