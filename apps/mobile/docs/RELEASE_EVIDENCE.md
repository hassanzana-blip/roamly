# Release evidence — 23 September 2026

This is a development checkpoint, not production approval or proof of native-device behavior.

## Candidate and test environment

- Branch: `claude/bold-shannon-0wuhsd` (draft PR 8).
- Tested server/mobile source: `18ad2eaf4823240513c7a8443cee05db62ed774a`.
- [CI run 35922022749](https://github.com/hassanzana-blip/roamly/actions/runs/35922022749): all four jobs PASSED.
- Existing Railway staging: `https://roamly-staging.up.railway.app`.
- Staging deployment `b14f7bdd-5732-430e-9ca5-7d1a77563bff`: successful; its Details panel links to the exact commit above. Auto-deploy remains disabled.
- No schema/migration difference from the previous staging source `265b664` under `db`, `drizzle` or `api/db`. Existing pre-deploy migration command retained.
- No production deployment, signing credential creation or store submission.

## Evidence independently checked

| Check | Status | Evidence and limits |
|---|---|---|
| Mobile CI | PASSED | 177 tests passed, 3 live tests skipped; types, lint, Expo package/config checks, icon validation, iOS JS export and bundle guard passed. |
| Independent local mobile suite | PASSED | Same 177 passed / 3 skipped, 42.584 seconds; typecheck passed. |
| Server CI | PASSED | 522 unit tests, 185 MySQL integration tests, 5 readiness-checker tests; typecheck, lint, build and migration consistency gates passed. |
| Browser CI | PASSED | 52 Playwright checks, 2.2 minutes, isolated demo/customer fixtures. |
| Docker CI | PASSED | Image built and answered health check. |
| Deployed staging readiness | PASSED | Six read-only probes at 21:41 UTC: database, web API, mobile API, OSL lookup, anonymous customer null, staff procedure absent. |
| App client on staging | PASSED with DEMO DATA | Actual `src/lib/api.ts` over HTTP: airports 158 ms, anonymous profile 59 ms, one round-trip search 686 ms; 16 offers, `provider: demo`, `sandbox: true`. Single observations, not a performance benchmark. |
| Shared accounts on staging | PASSED | Nine HTTP checks at 21:42 UTC using actual mobile client and web cookie API; details below. This does not test native SecureStore or interactive screens. |
| Staging SEO isolation | PASSED | At 21:43 UTC: root and robots 200 with `X-Robots-Tag: noindex`; robots allows crawling with no sitemap; sitemap 404 with noindex. Canonical public-host behavior covered separately by CI. |
| Native build | PASSED, older source | EAS simulator build `988e8421-4373-4e48-9fba-585928db397f`, source `79c2730`, compiled successfully. This archive cannot install on a physical iPhone. |
| iOS simulator / physical iPhone / VoiceOver / Dynamic Type | NOT RUN | Windows host cannot run iOS Simulator. Native controls, safe areas and performance remain unverified. |
| Signed iPhone preview | BLOCKED | Existing EAS internal-distribution credentials were unavailable. No new certificates or provisioning profiles created. |
| Real fares / payment / ticketing | NOT VERIFIED | Staging uses demo provider. No booking or payment attempted. |

## Shared-account checks

Two randomly named `example.invalid` fixtures were created only in the separate staging database. Before running, Railway showed only APP_BASE_URL, APP_ENV and DATABASE_URL as service variables; SMTP_URL/SMTP_HOST were absent. Runtime Docker configuration has no mail transport. No real contact, email or SMS was used. Credentials stayed in memory; all test sessions were revoked. The two unverified test accounts remain in staging.

1. Web registration creates a customer and cookie session.
2. The actual mobile client logs into that same customer ID.
3. A web profile edit appears in mobile without changing the account locale.
4. A mobile profile edit and explicit locale choice appear on the web.
5. A mobile bearer token cannot use the web profile route to bypass phone verification.
6. Web logout-all revokes both web and mobile sessions.
7. Mobile registration followed by web login resolves the same customer ID.
8. Mobile logout revokes its own session while the separate web session survives.
9. Final web logout-all revokes every remaining fixture session.

The transport checks use real staging customer services and database records. Flight screenshots and demo search results remain fixtures, not live inventory. Account verification-email delivery was intentionally not tested because staging has no configured transport.

## Mobile follow-up — 23 September, 22:41 UTC

App code `00d18db`, evidence commit `0a9e78171d5996a964f97c901d557cda0fcd891a`:

- Independent local suite: **PASSED**, 213 tests, 3 staging tests skipped, 21 suites, 24.074 seconds; typecheck passed.
- Independently reviewed version-aware preference persistence, explicit accessibility language wrappers, and 375-point Home, grouped sellers and large-text price-bar captures.
- **FAILED visual acceptance** for long seller names at 135% browser text scaling: words split within the name column. A focused correction is in progress. Capture header dates also need alignment with the static fixture dates.
- This is browser/fixture evidence. VoiceOver, actual Dynamic Type and the native calendar remain NOT RUN.
- Full CI for this candidate is tracked separately; the older server CI above is not proof of this newer app revision.

## EAS upload scope

Root `.easignore` retains the root and mobile ignore rules and excludes `apps/mobile/docs/evidence/` from the EAS working-tree upload. Screenshots remain versioned and available for review. The mobile native-folder exclusions are scoped to `apps/mobile/ios` and `apps/mobile/android`.

The installed EAS CLI archive inspector completed locally without submitting a build. The generated evidence directory contained zero files. A rule audit at `0a9e781` retained every prior exclusion, all 27 mobile assets and eight checked configuration/entry/contract files; all 17 synthetic environment/credential/native/build canaries were excluded. Only the 48 evidence files (22,909,481 uncompressed bytes) were additionally excluded among tracked files. This is not a measurement of compressed upload savings: Git objects can still contain historical files.

Keep `.easignore` synchronized when either `.gitignore` changes: EAS prioritizes it over gitignore files. See [Expo's official ignore-file documentation](https://docs.expo.dev/build-reference/easignore/).

## Remaining release gates

The seller correction is reviewed below. A separate exact-request and offer-expiry correction is in progress; the checks above do not certify future changes. The current native archive predates Bokmål-default and layout work. Real provider data, physical-device behavior, complete photo provenance, final policy/retention review, production deployment approval and store submission approval remain separate gates.

Exact device build steps are in [README](../README.md) and [RELEASE](../RELEASE.md). Never substitute the simulator archive for an iPhone installation link.

## Seller correction — independently reviewed 23 September, 23:38 UTC

- Code `be41be4`; evidence `10535ae22566aea7cab5163e8677cf56637539dd`.
- Independent local mobile suite: **PASSED**, 218 tests, 3 live tests skipped, 21 suites, 57.140 seconds. Typecheck and lint **PASSED**. Runtime is one observation, not a performance comparison.
- [CI run 35933104597](https://github.com/hassanzana-blip/roamly/actions/runs/35933104597): **PASSED**, all four jobs (mobile, server, Docker, browser E2E), exact evidence SHA.
- Independently reviewed both language before/after captures at 375 points with 135% browser text scaling, plus the short-name Bokmål comparison. Split seller words are gone and full-width price/baggage/terms remain legible. Normal short-name rows remain compact. These are labelled Chromium fixtures, not native screenshots.
- Reviewed code keeps measurement decisions at screen level and remounts measured elements on fontScale changes. Actual Dynamic Type and VoiceOver remain **NOT RUN**.
- Capture search dates now match fixture travel dates. No new provider capabilities or live-fare claims were introduced.
- Editable Figma seller/baggage/banner components match the reviewed source; see FIGMA_SPECIFICATION.md.

The public production search tested separately at `2a58d8c` returned KAYAK sandbox results, including TRF despite an OSL query. A mobile-only exact endpoint/date/leg boundary and live details-expiry guard are being implemented next. Production web and worker both auto-deploy main; merging PR 8 is therefore a production deployment and remains held. No production settings, data, deployments or credentials changed in this review.

## Expanded deployment probe — 23 September, 23:42 UTC

The read-only checker now also requires `staffAuth.me` and `admin.dashboard` to be absent from the mobile router. A protected 401/403 or an anonymous staff response is a failure, rather than evidence of customer/admin separation. Failure categories distinguish redirections, missing routes, non-JSON/invalid JSON, timeouts and contract mismatches without logging response bodies or redirect targets.

Seven script tests **PASSED**; both added regression cases fail against the prior script. All eight actual HTTP probes **PASSED** against staging `18ad2ea`. No authenticated request, provider call, customer data, booking or mutation was involved. These selected route checks are not an exhaustive security audit and do not establish live inventory or native app behavior.
