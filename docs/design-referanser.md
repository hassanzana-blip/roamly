# Godkjente designer → implementasjon

Seks godkjente skjermbilder (mottatt som PNG, 19. september 2026) og hvor de
lever i koden. Ingen eksempeldata fra skissene er hardkodet: navn, reisemål,
datoer og innlegg kommer alltid fra kontoen eller fra reisemålsregisteret.

| # | Skisse | Rute | Hovedfiler | Data |
|---|--------|------|------------|------|
| 1 | Min side – «Hei, …», faner, «Din neste reiseidé», snarveier, «Reis sammen» | `/profil` | `src/pages/Profile.tsx`, `src/components/minside/LinkTabs.tsx`, `src/components/minside/PlanCard.tsx` | `tripPlans.list`, `account.hub`, `account.unreadCount` |
| 2 | Billetter og dokumenter | `/reiser/dokumenter` (`?plan=<id>`) | `src/pages/account/Documents.tsx`, `src/components/minside/DocumentUploadSheet.tsx`, `src/lib/documents.ts` | `documents.list/remove`, `POST /api/documents/upload`, `GET /api/documents/:id` |
| 3 | Venner – For deg / Grupper / Finn venner, innlegg, avstemning | `/profil/venner` (`?fane=grupper|finn`), `/profil/venner/grupper/:id`, `/venner/invitasjon/:token`, `/grupper/invitasjon/:token` | `src/pages/account/Friends.tsx`, `Group.tsx`, `Invites.tsx`, `src/components/minside/Social.tsx` | `social.*` |
| 4 | «Hva slags ferie trenger du?» | `/utforsk` (`?tempo=sea|city|calm`) | `src/components/explore/InspirationHero.tsx`, `src/content/inspiration.ts`, `src/pages/Explore.tsx` | Reisemålsregisteret, `account.saved` |
| 5 | Hotell – «Bo godt. Gjør mindre.» | `/hotell` (før søk) | `src/components/stays/HotelLanding.tsx`, `src/pages/Hotels.tsx`, `src/components/stays/stayLinks.ts` | Valgene følger med som `?pref=` og blir startfiltre i resultatet |
| 6 | Reiseplan – «Alt til turen. På ett sted.» | `/reiser/plan/:id`, `/reiser/plan/ny?dest=<id>` | `src/pages/TripPlan.tsx` | `tripPlans.get/create/update/setPacking/linkBooking/archive` |

## Bevisste avvik fra skissene

- **Gule merker «Forhåndsvisning · Eksempeldata» og «Konseptvisning»** finnes
  ikke i produksjon. Uten data vises ekte tomtilstander («Ingen reiseidé
  ennå», «Ingen dokumenter ennå», «Stille her ennå»).
- **Eksempelnavn og -steder** (Jousef, Emma, Siena, Monterosso, Helgeturen,
  København) er ikke i koden. Skjermene viser kontoens egne planer, venner og
  grupper. Inspirasjonsseksjonen henter hovedkort og bikort fra registeret per
  tempo (`src/content/inspiration.ts`).
- **«Bestilt»** settes bare når en ekte bestilling hos oss er koblet til planen
  (`tripPlans.linkBooking`). Alt annet er «Ikke bestilt».
- **Min side under folden** beholder de eksisterende modulene (kort, bonus,
  neste bestilte reise, ruter, reisende, historikk). De skjuler seg selv uten
  data.
- **Understreket fane «Innstillinger»** går til den eksisterende siden
  `/profil/innstillinger` i stedet for å duplisere den i en fane.
- **«Les hotellguiden»** går til en ny, ekte artikkel:
  `/journal/hotell-slik-leser-du-prisen`.
- Fotoene er de lokalt lagrede, kontrollerte bildene fra registeret; se
  `docs/foto-kilder.md`.

## Nye designtokens

`--sunny` / `--sunny-ink` (statusmerke), `--sky-soft` (lys himmelflate),
`--rose-soft` (Reis sammen-kortet). Definert i `src/index.css` for lys og mørk
modus og eksponert i `tailwind.config.js` som `bg-sunny`, `text-sunny-ink`,
`bg-sky-soft`, `bg-rose-soft`.

## Navigasjon og SEO

- `ACCOUNT_NAV` har fått «Billetter og dokumenter» og «Venner».
- Bunnmenyen regner `/venner/…` og `/grupper/…` som Profil.
- Alle nye ruter er `noindex` (`PAGE_META.documents/friends/group/friendInvite/groupInvite/tripPlan`), og prefiksene `/venner` og `/grupper` er lagt til i `NOINDEX_PREFIXES`.
