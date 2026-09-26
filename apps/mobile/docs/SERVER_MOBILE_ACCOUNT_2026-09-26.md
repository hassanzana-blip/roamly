# Mobile API for Min side and Lagret (`mobileAccount.*`): needs Ali's approval before deploy

26 September 2026. Written with the stage «Min side and Lagret» on `claude/bold-shannon-0wuhsd`. **Nothing here is
deployed.** The code, the migration and the tests are on the branch; the app works without them (it shows what is on
the phone and links to hellosky.no). Deploying is Ali's call.

## What the server gets

A new, narrow router on the app's endpoint (`/api/mobile/trpc`), `api/mobileAccount.ts`, mounted as `mobileAccount` in
`api/mobileRouter.ts`. It is **not** the web's `account` or `watch` router mounted whole; those stay off the app's API.
Every procedure is a customer procedure (Bearer token from `mobileAuth`); staff cookies and staff tokens get nothing
(added to the staff matrix in `api/test/mobileAccount.it.ts`).

| Procedure | Kind | What it does | Tables |
|---|---|---|---|
| `mobileAccount.hub` | query | The nearest upcoming, not cancelled booking (reference, route, dates, travellers) and counts: upcoming bookings, saved destinations/flights/routes, travellers, **active** price watches, unread notifications. No rewards tier, no bonus, no prices, no estimates. | `bookings`, `saved_items`, `saved_travelers`, `price_watches`, `customer_notifications` (read only) |
| `mobileAccount.travellers` | query | The account's saved travellers: id, first name, last name, type (adult/child/infant) and preferred cabin. | `saved_travelers` |
| `mobileAccount.saveTraveller` | mutation | New (no id) or changed (own id) traveller. Same name rule as the web (`normalizeName`), same limit (20). Only name, type and cabin are written; the web's birth date and gender are never sent to the app and never changed. | `saved_travelers` |
| `mobileAccount.removeTraveller` | mutation | Removes an own traveller (NOT_FOUND for others'). | `saved_travelers` |
| `mobileAccount.saved` / `save` / `unsave` | query / mutations | Saved destinations (the web's slugs), flights and routes, with the app's snapshot as payload. Same table and limit (200) as the web. A payload over 8 000 characters is refused instead of cut mid-JSON. | `saved_items` (kind `destination`, `flight`, `route`) |

The web's `account.saved` enum gains `route` (a varchar(16) column, no migration), so the web never reads a route row
as an unknown kind.

The contract types are in `contracts/mobileAccount.ts` (types only, as the app requires); the server's zod inputs are
type-checked against them in `api/test/mobileAccountHub.it.ts`.

## Database: one additive migration

`db/migrations/0009_reisende_type_klasse.sql` (made with `npm run db:generate`, snapshot and journal included):

```sql
ALTER TABLE `saved_travelers` ADD `traveler_kind` varchar(8);
ALTER TABLE `saved_travelers` ADD `cabin` varchar(16);
```

- Both columns are **nullable**; no default, no backfill, no data change, no index. Existing rows read as «type not
  given» unless they have a birth date, in which case the server derives the type (under 2 infant, under 12 child) and
  sends only the type.
- **No passport, national ID, personnummer or document field anywhere.** Passport data stays only in
  `passenger_documents`, tied to bookings.
- `npm run migrate:check` passes. Deletion is unchanged: `saved_travelers` is still deleted with the account (verified in
  the new test); `saved_items` keeps its existing «retain» rule in `CUSTOMER_DATA_MATRIX` (the web's rule, not changed
  here).

## Verified here (local MariaDB 10.11, not staging or production)

- `api/test/mobileAccountHub.it.ts`: 15 tests (contracts, unauthorised access, hub counts and the nearest booking,
  travellers add/edit/remove, no ID data stored or returned, others' travellers, name and limit validation, birth-date
  type, deletion, saved items idempotent and scoped, oversized payload refused).
- The whole integration suite: 19 files, 225 tests passed (`npm run test:it`), including the updated router-shape and
  staff-matrix tests. Root unit tests 538 passed. `tsc -p tsconfig.server.json` and ESLint clean.

## What Ali decides

1. **Deploy the routes and run migration 0009** (additive; safe to run before the code). Until then the app keeps
   showing phone data only.
2. Whether saved flights/routes should sync to the account. The routes exist; the app does not call `saved`/`save`/
   `unsave` yet (next step, below), so today's saved items stay on the phone.
3. Whether a deleted account should also delete `saved_items` (today the web retains them; the app's delete copy does
   not promise it).

## Next steps once deployed

- Sync Lagret with the account: on sign-in, upload what is on the phone (union), then save/unsave through the API; the
  same «Move to my account» pattern as travellers.
- Travel preferences on the account: the web's `customer_travel_profiles` covers home airports, cabin, baggage and a
  few flight/timing flags. The app's preferences are richer (time bands, preferred and avoided airlines), so a mapping
  (or two new JSON fields) is needed before they sync.
- Price alerts in the app: still the separate proposal (`PROPOSAL_DEALS_AND_ALERTS_2026-09-25.md`).
