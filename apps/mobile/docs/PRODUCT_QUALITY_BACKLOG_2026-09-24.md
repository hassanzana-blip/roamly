# HelloSky iPhone: experience improvement plan

24 September 2026. This is a prioritized **proposal**, not a list of features claimed to be shipped. It follows the installed `fa4066c` preview feedback and the current source. The user has not supplied a screenshot of an app screen from that build, so native visual problems beyond the reported poor experience remain to be verified on-device. Keep Bokmål first, saved English, NOK, and flights from Norway to worldwide airports. Never show a fare, availability, booking, review or price alert unless backed by the real service.

Several rows refine a feature that already exists in code; they are still listed because implementation alone is not proof of good interaction on the phone. The acceptance signal identifies the behavior to improve or verify. Do not count all 60 as new features delivered.

## Implementation evidence, not a completion score

- Map rows 1–7: `1883e5c` and correction `fc85cbf` implemented regional views, grouping, exact-airport selection, a list alternative and a destination card over the map. Codex independently reproduced the original selected-pin overlap, then ran the corrected 44 map/Explore tests. The 375/390/430 pt map images in `docs/evidence` are **browser approximations with no Apple MapKit tiles**. Real iPhone gestures, labels and VoiceOver remain unverified.
- Home row 45 and touch target row 55: `6971bbe` reduced the measured 390×844 browser-preview hero from 249 to 195 pt and moved the Søk fly bottom edge from 607 to 553 pt. The first destination card visible above the tab bar grew from 69 to 127 of 132 pt. Codex reviewed the before/after images and ran the nine new Home tests. Native layout remains unverified.
- Navigation/saved rows 41–43: `a784b68` added a fourth functional Lagret tab, exact-airport saved destinations and explicit past-date handling for recent searches, tested with device-local storage fixtures. `6f91619` compacted the Saved layout; Codex compared 390 pt before/after captures and independently passed 75 targeted tests plus typecheck and lint. Do not mark this as native-verified or as account-synced.
- Sorting row 28 (25 Sep): «Best» (the web's own weights, now the default), «Tidligst avgang», and Best / Billigst / Raskest tabs with real top price and travel time. Arrival-time sorting is not added. Browser preview and Jest only; see MANIFEST «Results: Best / Cheapest / Fastest».
- Result card rows 21, 22 and 32 (25 Sep): compact card (289 → 215 pt at 390), stop airports, and overnight/airport-change/long-wait risks on the card. Browser preview and Jest only; see MANIFEST «Results: compact card…».
- Dates (row 11 area, rows 12 and 20; 25 Sep): one range calendar for departure and return on Home and in results; past days disabled; no invented provider horizon. Browser preview and Jest only; see MANIFEST «Dates: one range calendar…».
- Row 17 (25 Sep): results loading keeps the search visible, shows placeholder cards without data and puts «Stopp søket» at thumb reach. Browser preview and Jest only; see MANIFEST «Results: loading…».
- Rows 33, 34 and 39 (25 Sep): flight details are one scroll without tabs – sellers, the whole itinerary, baggage and terms for the chosen seller, price. Browser preview and Jest only; see MANIFEST «Flight details: the whole journey…».
- The public staging API readiness probe still reports `mobileAuth.providers` as 404 (8 of 9 checks passed at 11:20 UTC), so Google/Apple customer sign-in is not demonstrated in the installed app. KAYAK provider access remains subject to affiliate approval; no fabricated live fare is used to fill that gap.

The immediate sequence is map usability, the search-to-offer journey, then navigation/account polish. Each stage needs a current 375/390/430 pt visual review, functional checks and a new signed iPhone build before it is called device-verified. The 403 from KAYAK is an affiliate-access dependency, not a UX task.

The app already ships the open-source `react-native-maps` package with Apple's MapKit on iOS. Its [documented region and camera controls](https://github.com/react-native-maps/react-native-maps/blob/master/docs/mapview.md) support the map work below; a new map SDK is not the first fix. This is a source-based implementation choice, not evidence that the resulting map has passed an iPhone test.

## P0 — make the core journey useful

| # | Improvement | Acceptance signal |
|---|---|---|
| 1 | Start the iOS map at a useful regional scale instead of fitting all 24 worldwide airports. | Norwegian-origin customer can recognize nearby destinations without first zooming. |
| 2 | Add explicit geographic region controls, including a world view. | Every supported destination stays reachable in two taps. |
| 3 | Recenter map to the chosen region. | A pan can be undone without leaving Explore. |
| 4 | Keep selected destination visible without shrinking the map to a narrow strip. | Map and search action remain usable at 375 pt. |
| 5 | Declutter nearby airport pins at broad zoom. | Oslo-area/European pins can be selected individually after zooming. |
| 6 | Show city and airport identity for the selected pin. | Selection never silently converts one airport to another. |
| 7 | Retain a full list alternative to the map. | Every pin destination is reachable without gestures. |
| 8 | Add a real destination search in Explore. | Typing a city or IATA narrows the 24 curated destinations. |
| 9 | Make Explore route context editable without returning to Home. | Origin, dates and travelers are obvious before a destination search. |
| 10 | Show a clear map-empty state when a region has no curated destinations. | The user can switch region or list. |
| 11 | Keep the flight search action above the keyboard on small phones. | Airport, date and passenger pickers remain tappable at 375 pt. |
| 12 | Make one-way/return selection immediately update relevant fields. | Return date disappears for one-way and reappears intact for return. |
| 13 | Make airport swap preserve exact airport identities. | OSL and TRF never merge; the draft remains valid. |
| 14 | Explain city versus airport results in the airport picker. | A city selection's airport scope is explicit before search. |
| 15 | Restore form state when returning from results. | No re-entry of airports, dates or passenger counts. |
| 16 | Keep result header tied to the executed search, not a newer unsubmitted draft. | Route and passenger label always describe displayed offers. |
| 17 | Give search loading a stable, useful layout and cancel/retry. | No layout jump or duplicate search after tapping twice. |
| 18 | Make failed/empty search recovery specific to the error. | Customer knows whether to retry, edit a field or wait for provider. |
| 19 | Never replace a failed live request with fixture fares. | Failure is visible, with the search retained. |
| 20 | Validate departure/return dates against the actual provider horizon when known. | No silent impossible search; no invented cutoff. |

## P1 — compare flights with confidence

| # | Improvement | Acceptance signal |
|---|---|---|
| 21 | Fit both outbound and return summaries into each round-trip result. | Duration, stops and times are scanable before opening details. |
| 22 | Reduce result-card visual noise while preserving critical facts. | Route, time, stops, baggage, seller and price have an unambiguous hierarchy. |
| 23 | Keep seller offers grouped per itinerary. | Same flights do not appear as duplicate trips. |
| 24 | Show price basis next to each amount. | Per person versus all travelers and one-way versus return are explicit. |
| 25 | Show unverified total price neutrally. | No multiplication or implied total when provider price mode is unknown. |
| 26 | Explain approximate NOK conversion in place. | FX source/date are discoverable without crowding the card. |
| 27 | Surface availability/offer age and refresh options. | An old or expired offer cannot look freshly confirmed. |
| 28 | Allow sorting by price, duration, departure and arrival with stable tie breaks. | Repeated sort gives predictable ordering. |
| 29 | Keep filter count and clear action visible. | Applied restrictions never become invisible after sheet close. |
| 30 | Preserve supported filters across a refresh of the same search. | Refresh does not unexpectedly reset comparisons. |
| 31 | Add arrival-time filtering if the itinerary data supports it. | Outbound and return can be constrained independently. |
| 32 | Expose airport changes, overnight stops and long layovers on results. | Material itinerary risks are visible before provider handoff. |
| 33 | Show baggage as included, paid, excluded or unknown. | Unknown is never rendered as included. |
| 34 | Compare seller-specific terms within one itinerary. | Baggage and fare conditions never leak between sellers. |
| 35 | Make date flexibility useful only with real priced offers. | No decorative calendar or speculative price graph. |
| 36 | Display a clear provider/sandbox status when relevant. | Demo data cannot be mistaken for bookable inventory. |
| 37 | Support safe share of the current search. | Link contains route/dates, never token or a stale price guarantee. |
| 38 | Make the selected seller and total price sticky on details. | Primary action stays visible without hiding itinerary content. |
| 39 | Expand every segment and layover on details. | Airport changes and arrival-next-day markers are unmissable. |
| 40 | Label provider handoff as booking with the provider. | No impression that HelloSky issues tickets or takes payment. |

## P1 — turn three tabs into a coherent product

| # | Improvement | Acceptance signal |
|---|---|---|
| 41 | Re-evaluate bottom navigation around actual working destinations. | Search, Explore and Account have clear labels; extra tabs launch only with real content. |
| 42 | Add a saved-search library on device or through a customer-only API. | Saved searches never claim a reserved fare or booking. |
| 43 | Add a compact recent-search entry point outside the Home scroll. | Repeat a trip in one or two taps. |
| 44 | Offer genuinely useful Explore filters such as region and flight duration. | Every filter is based on known destination/route data. |
| 45 | Give Home a tighter first viewport. | Origin, destination, dates and search action are easy to find. |
| 46 | Use photography to identify destinations, not replace flight facts. | Search/results remain readable even when an image fails. |
| 47 | Align flight and hotel entry points with actual provider readiness. | A disabled service does not look bookable. |
| 48 | Make Profile a useful customer hub with clear guest state. | Search remains open without registration; sign-in benefits are truthful. |
| 49 | Add Google and Apple customer sign-in after the existing Clerk redirect and staging exchange are verified. | Both complete an on-device sign-in; no owner/admin identity appears. |
| 50 | Make account errors actionable and preserve the customer's search. | Failed login never discards the active route. |
| 51 | Give settings compact, consistent grouping. | Language, account, help and privacy are findable without long scrolling. |
| 52 | Keep Norwegian and English copy complete and native-sounding. | No clipped or mixed-language labels at 375/390/430 pt. |

## P2 — polish, accessibility and proof

| # | Improvement | Acceptance signal |
|---|---|---|
| 53 | Refine typographic scale and tabular numbers. | Times and NOK amounts align and scan consistently. |
| 54 | Standardize icon weight and pressed/selected states. | One visual language, without ornamental motion. |
| 55 | Improve contrast and 44-point targets on map controls, chips and sheets. | Touch and readability checks pass at the smallest target layout. |
| 56 | Test Dynamic Type and VoiceOver on an actual iPhone. | Controls remain reachable, ordered and correctly announced. |
| 57 | Support Reduce Motion for all added transitions. | State changes remain understandable with animations disabled. |
| 58 | Measure cold start, search-to-results and map interaction on device. | Record numbers before optimizing; no invented performance claim. |
| 59 | Profile image and map render failures. | Search still works when imagery or MapKit content cannot load. |
| 60 | Run a full native smoke route from launch to provider handoff. | PASSED/FAILED/BLOCKED evidence for actual iPhone build. |

## Supplied ZIPs: decision record

The user-supplied `login page.zip`, OTP, navigation, search, card, dashboard, SVG and payment archives were inspected as archives, without running them. The sampled projects are Vite/React DOM applications using CSS and often Framer Motion; the app is Expo 57 / React Native 0.86. No project-root reuse license was found in the inspected archives, so their source is **not copied** into the app. The OTP animations, cart/payment and dashboard examples do not establish real authentication, booking or payment capability and are not integration candidates. Do not install their bundled `node_modules`.

| Candidate | Inspected content | Decision |
|---|---|---|
| `navgation tabs.zip` | `DarkNavBar.jsx` has a persistent dark bar and selected-state treatment, but also a flying icon, wave SVG and generic global search. React DOM, CSS and `lucide-react`. | Adapt only the compact selected-state hierarchy to the existing native bottom bar. No source copy or new dependency. |
| `login page.zip` | Form uses e-mail/password fields with reveal affordance but also mouse-position effects, animated particles, clouds and CSS gradients. React DOM, Framer Motion. | Native form clarity is relevant; pointer effects and decoration conflict with the agreed restrained design. Existing Clerk flow remains authoritative. |
| `animated search bar.zip` | Search is for products, with web input animations and DOM results. | Consider focused-input feedback as a native interaction principle only. Do not transplant product-search behavior into flight search. |
| `cards design .zip` | The sample cards are social profiles with “online” status, contact/share actions and color overlays. | Reject for flight and destination cards; these states would mislead customers. |
| `apple type navbar.zip` | Floating web bar carries PipWise branding and web motion. | Reject as code and look; does not fit native iOS bottom navigation or HelloSky branding. |

## Ownership and gates

Claude Code owns the mobile screen/component/test edits in focused stages; Codex independently reviews them and owns this product-quality plan, release readiness and configuration. The map, Home and Saved stages were sent one at a time to the existing HelloSky Claude Code session, with independent code and image review between stages. A green Jest run or Chromium capture is not a native iPhone test. A new signed EAS preview and an on-device comparison are required to assess the revised app. Production deployment, paid services, real payment/booking flows and App Store/TestFlight submission remain separate release decisions.
