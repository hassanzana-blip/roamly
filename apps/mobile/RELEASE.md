# HelloSky mobile release gates

The app is a client of the same HelloSky backend used by the website. It does
not contain provider API keys, a second customer database, or staff credentials.
Provider search and click tracking stay on the server.

## Build identity

- Expo owner: `helloskytravels-team`; existing project slug: `zana`.
- Display name: HelloSky; iOS bundle identifier: `no.hellosky.app`.
- App Store Connect listing: Hellosky Travel, app ID `6815342171`.
- Norwegian Bokmål is the language on a fresh install; English is a choice in
  Profile that is saved on the phone and kept.
- EAS remotely manages build numbers. Creating a build does not submit it.

The Expo project slug is a project identifier; it is not the name shown to users.
The `testflight` profile uses the EAS **preview** environment, while `production`
uses the **production** environment. Neither profile uses auto-submit.

## One backend, two API surfaces

Set `EXPO_PUBLIC_API_BASE_URL` to an HTTPS **origin**, with no path or secret.
The app appends `/api/mobile/trpc`; the website uses `/api/trpc` on the same
deployment. Production is intended to use `https://hellosky.no`, but a working
website alone does not establish that its mobile routes have been deployed.

Before any build, from the repository root run:

```sh
node scripts/mobile-readiness.mjs https://your-verified-api-origin
```

This credential-free checker verifies database readiness, both API surfaces,
airport lookup, an empty anonymous customer session, the public sign-in capability
contract, and absence of the staff
router on the mobile surface. It probes the existing owner-summary, staff-session
and admin-dashboard procedures; all must return tRPC NOT_FOUND, not 401/403 or an
anonymous staff response. It rejects HTML fallbacks masquerading as APIs and
reports redacted failure categories for redirects, absent routes, invalid JSON,
timeouts and contract mismatches. No response body or redirect target is logged.
It makes no flight-provider request, login, booking, or data mutation.

A green check is only the first gate. Using explicitly disposable **staging**
accounts, verify web registration/mobile login and mobile registration/web
login against the same customer record. Check session expiry, logout and account
deletion without using production customer data. Separately test a real search,
honest provider status, total prices, bag conditions and the original HTTPS
handoff URL. Confirm one click event per tap and no customer tokens in links.

## Build and device verification

1. Pass root CI and mobile lint, typecheck and tests at the exact candidate commit.
   Run `npx expo install --check` and `npx expo-doctor` as well. An iOS JavaScript
   export alone does not validate native config or native dependency compatibility.
2. Set the public API origin in the matching EAS environment. Keep all provider,
   database and signing secrets out of `EXPO_PUBLIC_` variables and Git.
3. Clear Metro's cache when exporting. Run the existing `check:bundle` command
   against the export to detect a wrong host or sensitive server dependencies.
4. Build the selected profile through EAS. Use existing credentials only; stop
   before new sensitive access, paid commitments or legal agreements.
5. Test the signed binary on a real iPhone. Verify English/Norwegian, small-screen
   layout, VoiceOver, Dynamic Type, keyboard, offline/retry, search and handoff.
   A browser preview or JavaScript export is not evidence of an installable app.
6. Record screenshots, device/OS, build number, commit, API origin and outcomes.
7. Review accurate metadata, support/privacy URLs and privacy declarations against
   actual SDKs and data handling. Do not invent commercial or privacy claims.

Production deployment and App Store/TestFlight submission require explicit user
approval of the concrete candidate. No submission is performed by this document
or by the checked-in EAS configuration. Apple review timing is outside our control.

## Rollout evidence

Keep readiness JSON and test/build logs with the release record. Do not treat
response latency from these nine smoke probes as app performance, or sandbox
fares as verified production inventory. Measure app startup, search duration and
list responsiveness separately on the same device and network before/after.
