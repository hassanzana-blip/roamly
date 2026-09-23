import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  bookingHolds,
  bookings,
  communityComments,
  communityLikes,
  communityPosts,
  customerAccounts,
  customerEmailTokens,
  customerIdentities,
  customerOtpCodes,
  customerPasswordResets,
  customerSessions,
  priceAlerts,
  savedTravelers,
} from "../../db/schema";
import { verifyPassword } from "./passwords";
import { hasPassword } from "./socialLogin";
import { assertRateLimit } from "./ratelimit";
import { AppError } from "./errors";
import { logAudit } from "./audit";
import { sessionIsFresh } from "./customerSessions";

// ─── Sletting av kundekonto (GDPR art. 17) – én vei for nett og app ──────────
//
// customerAuth.deleteAccount (nett, cookie) og mobileAuth.deleteAccount (app,
// Bearer) går begge hit. Alt skjer i én transaksjon: enten er slettingen
// gjennomført, eller ingenting er endret.
//
// HVA som slettes er nøyaktig det nettets sletting alltid har gjort (og det
// nettsiden sier til kunden: «Kontoen, lagrede reisende, prisvarsler og bonus
// slettes permanent. Gjennomførte bestillinger beholdes som regnskapsbilag.»).
// Å slette eller koble fra mer (sesjonsrader, reiseplaner, dokumenter,
// søkehistorikk, sosiale data, Clerk-brukeren …) er et eget valg om
// oppbevaring som ikke er tatt her. CUSTOMER_DATA_MATRIX dokumenterer dagens
// oppførsel tabell for tabell.
//
// Utfall per tabell:
//  - delete:     raden slettes.
//  - revoke:     sesjonen tilbakekalles (revoked_at settes); raden beholdes.
//  - deactivate: prisvarselet slås av og e-posten fjernes; raden beholdes.
//  - detach:     raden beholdes (bokføring), koblingen til kontoen nulles.
//  - anonymize:  kontoraden beholdes, personopplysningene i den fjernes.
//  - retain:     raden røres ikke av slettingen i dag.
// Selve customer_accounts-raden anonymiseres i stedet for å slettes, slik at
// FK-er fra beholdte rader fortsatt er gyldige.

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export type DeletionAction = "delete" | "revoke" | "deactivate" | "detach" | "anonymize" | "retain";

export type DeletionRule = {
  table: string;
  /** Kolonnen(e) som peker på kunden (FK eller e-post/nøkkel). */
  columns: string[];
  action: DeletionAction;
  note: string;
};

/** Rader slettingen ikke rører i dag. Om de skal slettes eller kobles fra, er ikke bestemt. */
const UNTOUCHED = "Røres ikke av slettingen (dagens oppførsel).";

/**
 * Hver tabell som peker på en kunde, og hva slettingen gjør med den I DAG.
 * Integrasjonstesten sammenligner lista med alle FK-er mot customer_accounts i
 * databasen (en ny tabell uten regel her stopper testene) og kontrollerer at
 * hver regel stemmer med det slettingen faktisk gjør.
 */
export const CUSTOMER_DATA_MATRIX: readonly DeletionRule[] = [
  { table: "customer_accounts", columns: ["id"], action: "anonymize", note: "E-post, telefon, navn, passord, avatar, henvisningskode, bonus (settes til 0) og markedsføringssamtykke fjernes; deleted_at settes. Raden beholdes så FK-er fra beholdte rader holder." },
  { table: "customer_accounts", columns: ["referred_by_id"], action: "retain", note: `Andre kunders henvisningskobling til den slettede kontoen. ${UNTOUCHED}` },
  { table: "customer_sessions", columns: ["customer_id"], action: "revoke", note: "Alle sesjoner – nett-cookie og app-Bearer – tilbakekalles (revoked_at settes); radene (IP, nettleser, tidspunkter) beholdes. Ingen av dem autentiserer etterpå." },
  { table: "customer_identities", columns: ["customer_id"], action: "delete", note: "Sosiale innlogginger (Apple/Google via Clerk)." },
  { table: "customer_email_tokens", columns: ["customer_id"], action: "delete", note: "Verifiseringslenker." },
  { table: "customer_otp_codes", columns: ["customer_id"], action: "delete", note: "SMS-koder (innlogging og nytt telefonnummer)." },
  { table: "customer_password_resets", columns: ["customer_id"], action: "delete", note: "Tilbakestillingslenker." },
  { table: "saved_travelers", columns: ["customer_id"], action: "delete", note: "Lagrede reisende." },
  { table: "booking_holds", columns: ["customer_id"], action: "delete", note: "Holdte tilbud." },
  { table: "price_alerts", columns: ["customer_id"], action: "deactivate", note: "Prisvarsler slås av (active = false) og e-posten settes til «deleted»; rute, mål og konto-id blir liggende." },
  { table: "community_posts", columns: ["customer_id"], action: "delete", note: "Innlegg; andres kommentarer og likes på dem kaskaderer." },
  { table: "community_comments", columns: ["customer_id"], action: "delete", note: "Kommentarer." },
  { table: "community_likes", columns: ["customer_id"], action: "delete", note: "Likes; tellerne på innleggene justeres." },
  { table: "bookings", columns: ["customer_account_id"], action: "detach", note: "Beholdes som bokføringspliktig bilag (bokføringsloven § 13, 5 år); koblingen til kontoen nulles. Kontakt-e-post, telefon og passasjerer i bestillingen beholdes." },
  { table: "price_watches", columns: ["customer_id"], action: "retain", note: UNTOUCHED },
  { table: "customer_travel_profiles", columns: ["customer_id"], action: "retain", note: UNTOUCHED },
  { table: "saved_items", columns: ["customer_id"], action: "retain", note: UNTOUCHED },
  { table: "search_history", columns: ["customer_id"], action: "retain", note: UNTOUCHED },
  { table: "customer_notifications", columns: ["customer_id"], action: "retain", note: UNTOUCHED },
  { table: "deal_feedback", columns: ["customer_id"], action: "retain", note: UNTOUCHED },
  { table: "trip_plans", columns: ["customer_id"], action: "retain", note: UNTOUCHED },
  { table: "customer_documents", columns: ["customer_id"], action: "retain", note: `${UNTOUCHED} Gjelder også filene i customer_document_blobs.` },
  { table: "social_posts", columns: ["author_id"], action: "retain", note: UNTOUCHED },
  { table: "social_comments", columns: ["author_id"], action: "retain", note: UNTOUCHED },
  { table: "social_likes", columns: ["customer_id"], action: "retain", note: UNTOUCHED },
  { table: "customer_friendships", columns: ["requester_id", "addressee_id"], action: "retain", note: UNTOUCHED },
  { table: "customer_blocks", columns: ["blocker_id", "blocked_id"], action: "retain", note: UNTOUCHED },
  { table: "travel_groups", columns: ["owner_id"], action: "retain", note: `${UNTOUCHED} Gruppen står fortsatt med den slettede kontoen som eier.` },
  { table: "travel_group_members", columns: ["customer_id"], action: "retain", note: UNTOUCHED },
  { table: "group_polls", columns: ["created_by_id"], action: "retain", note: UNTOUCHED },
  { table: "group_poll_votes", columns: ["customer_id"], action: "retain", note: UNTOUCHED },
  { table: "content_reports", columns: ["reporter_id"], action: "retain", note: UNTOUCHED },
  { table: "match_sessions", columns: ["owner_customer_id"], action: "retain", note: UNTOUCHED },
  { table: "match_participants", columns: ["customer_id"], action: "retain", note: `${UNTOUCHED} Gjelder også stemmer og kommentarer.` },
  { table: "trip_boards", columns: ["owner_customer_id"], action: "retain", note: UNTOUCHED },
  { table: "trip_board_items", columns: ["added_by_customer_id"], action: "retain", note: UNTOUCHED },
  { table: "trip_board_comments", columns: ["author_customer_id"], action: "retain", note: UNTOUCHED },
  { table: "trip_board_votes", columns: ["voter_key = 'c:<id>'"], action: "retain", note: UNTOUCHED },
  { table: "checkout_sessions", columns: ["customer_account_id"], action: "retain", note: `${UNTOUCHED} Koblingen til kontoen står.` },
  { table: "provider_clicks", columns: ["customer_id"], action: "retain", note: `${UNTOUCHED} Koblingen til kontoen står.` },
  { table: "consents", columns: ["customer_account_id"], action: "retain", note: `${UNTOUCHED} Samtykkeloggen beholder koblingen og e-postadressen.` },
  { table: "fraud_flags", columns: ["customer_account_id"], action: "retain", note: `${UNTOUCHED} Koblingen til kontoen står.` },
  { table: "reward_events", columns: ["customer_id"], action: "retain", note: `${UNTOUCHED} Saldoen på kontoen settes til 0 uten motpostering.` },
  { table: "customer_notifications (andre kunders innboks)", columns: ["dedupe_key"], action: "retain", note: `Varsler hos andre kunder om det kunden gjorde (venneforespørsel, kommentar, ble med i gruppe) har kundens navn i tittelen. ${UNTOUCHED}` },
  { table: "price_alerts / booking_holds", columns: ["email (customer_id IS NULL)"], action: "retain", note: `Varsler og holdte tilbud laget uten innlogging til kontoens e-postadresse. ${UNTOUCHED}` },
  { table: "audit_logs", columns: ["actor_id", "target_id"], action: "retain", note: `Revisjonsloggen (også actor_label med fornavnet). ${UNTOUCHED}` },
  { table: "email_events", columns: ["recipient"], action: "retain", note: `Logg over e-poster sendt til kundens adresse. ${UNTOUCHED}` },
  { table: "Clerk (ekstern databehandler)", columns: ["user id = customer_identities.subject"], action: "retain", note: "Bare koblingen (customer_identities) slettes; brukeren hos Clerk slettes ikke." },
  { table: "support_cases / support_messages", columns: ["customer_email / email"], action: "retain", note: `Ikke koblet til kontoen (kun e-post). ${UNTOUCHED}` },
];

/**
 * Bekreftelsen for et uopprettelig valg: passordet, eller SLETT for kontoer uten passord.
 *
 * Feil passord gir UNAUTHORIZED med `field: "password"` – et token uten sesjon
 * gir UNAUTHORIZED uten felt – så en klient kan skille «skrev feil» fra «er
 * logget ut». `recentAuthForPasswordless` (appen): for en konto uten passord
 * er ordet SLETT ingen ny autentisering, så sesjonen må også være fersk
 * (sessionIsFresh); ellers FORBIDDEN med `reason: "reauth_required"`.
 */
export async function assertDeletionConfirmed(
  account: { passwordHash: string },
  input: { password?: string; confirmation?: string },
  opts: { recentAuthForPasswordless?: Date } = {},
): Promise<void> {
  // Konto med passord: passordet bekrefter. Konto uten passord (sosial
  // innlogging): kunden skriver SLETT – sesjonen alene er ikke nok for et
  // uopprettelig valg, og et passord finnes ikke å be om.
  if (hasPassword(account.passwordHash)) {
    if (!input.password || !(await verifyPassword(account.passwordHash, input.password))) {
      throw new AppError("UNAUTHORIZED", { message: "Passordet er feil.", data: { field: "password" } });
    }
    return;
  }
  if (input.confirmation?.trim().toUpperCase() !== "SLETT") {
    throw new AppError("VALIDATION", { message: "Skriv SLETT for å bekrefte.", data: { field: "confirmation" } });
  }
  if (opts.recentAuthForPasswordless && !sessionIsFresh(opts.recentAuthForPasswordless)) {
    throw new AppError("FORBIDDEN", { message: "Logg inn på nytt for å bekrefte at det er deg, og slett kontoen rett etterpå.", data: { reason: "reauth_required" } });
  }
}

/**
 * Slett (anonymiser) kundekontoen. Rategrense og bekreftelse først; deretter
 * én transaksjon; revisjonslogg etter commit.
 *
 * Idempotent: kontoraden låses (FOR UPDATE) og leses på nytt i transaksjonen.
 * To samtidige kall (dobbelttrykk i appen) gir begge { ok: true }, men bare det
 * første sletter og revisjonslogger.
 */
export async function deleteCustomerAccount(
  customerId: number,
  input: { password?: string; confirmation?: string },
  meta: { ip: string; via: "web" | "mobile"; recentAuthForPasswordless?: Date },
): Promise<{ ok: true }> {
  assertRateLimit("customer-delete", String(customerId), 5, 10 * 60_000);
  const db = getDb();
  const [account] = await db.select().from(customerAccounts).where(and(eq(customerAccounts.id, customerId), isNull(customerAccounts.deletedAt))).limit(1);
  if (!account) throw new AppError("NOT_FOUND");
  await assertDeletionConfirmed(account, input, { recentAuthForPasswordless: meta.recentAuthForPasswordless });

  const deleted = await db.transaction(async (tx) => {
    const [live] = await tx
      .select({ id: customerAccounts.id })
      .from(customerAccounts)
      .where(and(eq(customerAccounts.id, account.id), isNull(customerAccounts.deletedAt)))
      .for("update");
    if (!live) return false; // et samtidig kall rakk det først
    await removeCustomerData(tx, live.id);
    return true;
  });
  if (deleted) {
    await logAudit({ actorType: "customer", actorId: account.id, action: "customer.account_deleted", targetType: "customer_account", targetId: account.id, ip: meta.ip, metadata: { via: meta.via } });
  }
  return { ok: true };
}

/** Nøyaktig nettets sletting (se CUSTOMER_DATA_MATRIX); alt annet røres ikke. */
async function removeCustomerData(tx: Tx, id: number): Promise<void> {
  // Sesjoner (nett og app) og engangs-tokens
  await tx.update(customerSessions).set({ revokedAt: new Date() }).where(and(eq(customerSessions.customerId, id), isNull(customerSessions.revokedAt)));
  await tx.delete(customerOtpCodes).where(eq(customerOtpCodes.customerId, id));
  await tx.delete(customerEmailTokens).where(eq(customerEmailTokens.customerId, id));
  await tx.delete(customerPasswordResets).where(eq(customerPasswordResets.customerId, id));
  await tx.delete(customerIdentities).where(eq(customerIdentities.customerId, id));
  // Personopplysninger knyttet til kontoen
  await tx.delete(savedTravelers).where(eq(savedTravelers.customerId, id));
  await tx.delete(bookingHolds).where(eq(bookingHolds.customerId, id));
  await tx.update(priceAlerts).set({ active: false, email: "deleted" }).where(eq(priceAlerts.customerId, id));
  // Samfunn: fjern likes (og juster tellere), kommentarer og innlegg
  const likedPosts = await tx.select({ postId: communityLikes.postId }).from(communityLikes).where(eq(communityLikes.customerId, id));
  if (likedPosts.length) {
    await tx
      .update(communityPosts)
      .set({ likes: sql`greatest(0, ${communityPosts.likes} - 1)` })
      .where(inArray(communityPosts.id, likedPosts.map((l) => l.postId)));
  }
  await tx.delete(communityLikes).where(eq(communityLikes.customerId, id));
  await tx.delete(communityComments).where(eq(communityComments.customerId, id));
  await tx.delete(communityPosts).where(eq(communityPosts.customerId, id)); // kommentarer/likes på egne innlegg kaskaderer
  // Bestillinger beholdes (bokføring) men kobles fra kontoen
  await tx.update(bookings).set({ customerAccountId: null }).where(eq(bookings.customerAccountId, id));
  // Anonymiser kontoen
  await tx
    .update(customerAccounts)
    .set({
      email: `deleted-${id}@anonymized.invalid`,
      phone: null,
      firstName: "Slettet",
      lastName: "Bruker",
      passwordHash: "!deleted", // kan aldri verifiseres
      emailVerified: false,
      avatarUrl: null,
      referralCode: null,
      bonusKr: 0,
      marketingConsentAt: null,
      deletedAt: new Date(),
    })
    .where(eq(customerAccounts.id, id));
}
