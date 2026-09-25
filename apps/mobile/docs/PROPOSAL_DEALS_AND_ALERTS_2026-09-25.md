# Proposal for Ali: a deals rail and price alerts in the app

25 September 2026. The momondo screenshots have two things the app does not: «Travel deals under £98» on Home and
«Price alerts». We show neither today, because the app has no checked price without a search and no alerts. This
note says what it takes to build both honestly, what it costs, and what I need from you. **Nothing here is built or
deployed.** Both need server changes in `api/` and your approval.

## 1. A deals rail with real prices

**What exists.** Every search already writes one row to `search_events` (`db/schema.ts`): route, dates, travellers,
cabin, provider, a sandbox flag, the lowest total price in the answer, its currency and the time. The web's
`flights.priceHints` returns no amount on purpose (`api/flights.ts`: no provider gives daily prices without one
offer call per date, and we do not invent «from» prices).

**Option A (recommended): «Low prices from recent searches».** A public, read-only procedure on the mobile API
(for example `flights.recentLowPrices({ origin })`) that returns, for each of the app's destinations, the lowest
total found in the last 24 hours:

- only live answers (`sandbox = false`, known provider), one adult, economy, prices in NOK;
- always with the dates and the time it was found; the card says «Funnet 14:05 · prisen kan ha endret seg»;
- a tap runs a live search for exactly those dates, so the customer always books from a fresh answer;
- routes nobody searched show no price (the card stays as today);
- aggregated only: no session, device or customer data leaves the server.

*Cost:* no provider calls. About one day on the server (query, index on route and time, tests) and one in the app
(the rail, the card, VoiceOver, tests). *Risk:* thin coverage at first; a price can be hours old (the time label
and the live search on tap handle that).

**Option B: a nightly price check.** The worker searches about ten popular routes from Oslo for four date pairs
each night and stores the lowest live price with its time. Better coverage, but it spends provider quota every
night, and the provider's terms must allow showing cached prices outside a search (to check for KAYAK before
anything is built).

**My recommendation:** A now, B only after the provider terms are checked.

## 2. Price alerts in the app

**What exists (web only).** `watch.*` in `api/watch.ts`: list, create, update and remove, at most ten per customer,
checked immediately, daily or weekly. The worker queues `price_watches` every hour. An e-mail goes out only for a
live offer that meets every condition; test prices are never e-mailed. The checks use Duffel when it is
configured and demo data otherwise. The mobile API does not mount `watch` (`api/mobileRouter.ts`).

**Proposal.** A `watch` router on `/api/mobile/trpc` with the same rules and the app's Bearer customer. In the app:
«Følg prisen» on the results (route and dates, the highest price prefilled from the current cheapest offer), and
the alerts in Lagret with their status, the time of the last check and the last live match. E-mail only; push
needs APNs and a new dependency (your call later).

**Must be true before a switch is shown (none of it can be checked from here):**

1. The worker runs in production and the `price_watches` job succeeds (Railway logs).
2. Live checks: a live Duffel key is set (the checks use Duffel; KAYAK is not wired to alerts).
3. E-mail sending works, with a way to stop the alerts from the e-mail.
4. Deleting an account switches its alerts off. Today `price_watches` are kept untouched on deletion
   (`api/lib/customerDeletion.ts`), and the delete sheet says alerts are deleted.

*Cost:* about one day on the server (router and tests) and two in the app (the sheet, the list, the states,
tests).

## What I need from you

- **Deals:** yes or no to option A (a server change and a privacy check of using `search_events` this way).
- **Alerts:** confirm points 1–3 in production, and decide what deletion should do with alerts (point 4).
