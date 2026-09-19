# Sosial innlogging (Apple, Google, Facebook) via Clerk

HelloSky bruker Clerk som identitetsmegler for sosial innlogging. Clerk kjører
OAuth-flyten mot leverandøren (state, nonce og PKCE håndteres av Clerk), og gir
nettleseren et kortlevd token. Serveren verifiserer tokenet mot Clerks JWKS,
slår opp brukeren hos Clerk og bytter det mot HelloSkys egen sesjonscookie
(`hellosky_customer`). Passord- og SMS-innlogging er uendret.

Ingen knapp vises før alt er satt opp. Uten konfigurasjon står det «Kommer:
Apple, Google og Facebook» på innloggingssiden.

## Det eieren må gjøre (én gang)

1. **Clerk-dashbordet** (app `app_3JYHyhu2xIrNH2sBWdW0nYKI9by`):
   - *User & Authentication → Social connections*: slå på Apple, Google og
     Facebook med **egne** produksjonsnøkler (Clerks delte utviklingsnøkler
     virker bare i dev-instansen).
   - *Email, phone, username*: la e-post være valgfri for sign-up (Facebook
     kan komme uten e-post; Apple kan gi en skjult relay-adresse). Krev ikke
     navn, telefon eller brukernavn – da stopper Clerk sign-up på et skjema vi
     ikke viser, og kunden lander på «Innloggingen ble avbrutt».
   - *Paths / Redirects*: legg til `https://hellosky.no/logg-inn/sso-callback`
     som tillatt redirect (og forhåndsvisningsdomener om de brukes).
   - *Domains*: legg til `hellosky.no` som produksjonsdomene i Clerk.
2. **Leverandørene** (registreres i hver leverandørs utviklerportal, nøklene
   legges inn i Clerk – ikke i HelloSky):
   - Apple: Services ID med «Sign in with Apple», retur-URL fra Clerk
     (`https://<clerk-frontend-api>/v1/oauth_callback`), team-id, key-id og
     .p8-nøkkel.
   - Google: OAuth-klient (web) med Clerks redirect-URI som autorisert.
   - Facebook: app med «Facebook Login», Clerks redirect-URI, appen i live-modus
     med `email` som godkjent tillatelse.
3. **Railway-variabler** på HelloSky-tjenesten (aldri i repoet, aldri i chat):
   - `CLERK_SECRET_KEY` – hemmelig, kun server.
   - `CLERK_PUBLISHABLE_KEY` – publiserbar; sendes til nettleseren via
     `customerAuth.authProviders`.
   - `CLERK_SOCIAL_PROVIDERS` – f.eks. `google,apple,facebook` (må speile det
     som er slått på i Clerk).
4. **Databasemigrasjon**: `db/migrations/0005_customer_identities.sql` kjøres
   av `node scripts/migrate.mjs` ved deploy (tabellen `customer_identities`).

## Hvordan kobling til konto fungerer

| Situasjon | Resultat |
|---|---|
| Identiteten er kjent fra før | Innlogging på den kontoen |
| Kunden er allerede innlogget og kobler til under Sikkerhet | Kobles til den innloggede kontoen |
| Ny identitet, verifisert e-post matcher en konto | Kobles til kontoen (e-posten markeres verifisert) |
| Ny identitet, e-post matcher men er *ikke* verifisert hos leverandøren | Avvist: «Logg inn med passord først, koble til under Sikkerhet» |
| Identiteten er koblet til en annen konto enn den innloggede | Avvist – vi flytter aldri identiteter stille |
| Ingen treff | Ny konto uten passord (`password_hash = "!social"`) |

Kontoer uten passord kan slette seg selv ved å skrive **SLETT** (i stedet for
passord), kan lage passord via «Glemt passord», og kan ikke koble fra sin
siste innlogging før de har et passord.

## Testing før produksjon

- Dev-instans i Clerk med test-nøkler: sett de tre variablene lokalt og prøv
  innlogging, kobling under Sikkerhet, frakobling, avbrutt flyt (avbryt hos
  leverandøren) og sletting av en konto uten passord.
- `npx vitest run api/lib/socialLogin.test.ts` dekker koblingsreglene.
