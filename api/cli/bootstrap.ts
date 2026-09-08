import "dotenv/config";
import { eq } from "drizzle-orm";
import { env } from "../lib/env";
import { getDb, closeDb } from "../queries/connection";
import { staffInvites, staffUsers } from "../../db/schema";
import { randomToken, sha256Hex } from "../lib/tokens";
import { logAudit } from "../lib/audit";

/**
 * Engangs-bootstrap av de to første administratorene (OWNER + ADMIN).
 *
 * Bruk (Railway shell eller lokalt med prod-variabler):
 *   BOOTSTRAP_OWNER_EMAIL=<e-post 1> BOOTSTRAP_ADMIN_EMAIL=<e-post 2> \
 *   BOOTSTRAP_OWNER_NAME="Zyar" BOOTSTRAP_ADMIN_NAME="Zana" \
 *   APP_BASE_URL=https://ditt-domene.no \
 *   npm run bootstrap:admins
 *
 * Skriver ut engangs oppsettslenker (48t). Lenkene vises KUN her —
 * de sendes ikke noe sted, og kan ikke gjenbrukes etter aktivering.
 * E-postadresser kommer aldri fra kode — kun fra miljøvariabler.
 */
async function main() {
  const ownerEmail = process.env.BOOTSTRAP_OWNER_EMAIL?.toLowerCase().trim();
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase().trim();
  const baseUrl = env.baseUrl;

  if (!ownerEmail || !adminEmail) {
    console.error("Mangler BOOTSTRAP_OWNER_EMAIL og/eller BOOTSTRAP_ADMIN_EMAIL.");
    process.exit(1);
  }
  if (ownerEmail === adminEmail) {
    console.error("OWNER og ADMIN må ha ulike e-postadresser.");
    process.exit(1);
  }

  const db = getDb();

  // Bootstrap kan bare kjøres én gang — nekter hvis det finnes aktive kontoer
  const existing = await db.select().from(staffUsers).where(eq(staffUsers.status, "active"));
  if (existing.length > 0) {
    console.error("Bootstrap er allerede brukt (det finnes aktive staff-kontoer).");
    console.error("Nye ansatte inviteres fra admin → Innstillinger → Team.");
    process.exit(1);
  }

  const accounts = [
    { email: ownerEmail, name: process.env.BOOTSTRAP_OWNER_NAME ?? "Eier", role: "OWNER" },
    { email: adminEmail, name: process.env.BOOTSTRAP_ADMIN_NAME ?? "Administrator", role: "ADMIN" },
  ];

  console.log("Oppretter bootstrap-invitasjoner …\n");
  for (const account of accounts) {
    await db
      .insert(staffUsers)
      .values({ email: account.email, name: account.name, role: account.role, status: "invited" })
      .onDuplicateKeyUpdate({ set: { role: account.role, name: account.name } });

    const token = randomToken(32);
    await db.insert(staffInvites).values({
      email: account.email,
      role: account.role,
      tokenHash: sha256Hex(token),
      expiresAt: new Date(Date.now() + 48 * 60 * 60_000),
    });
    await logAudit({
      actorType: "system",
      action: "staff.bootstrap_invite_created",
      targetType: "staff_user",
      targetId: account.email,
      metadata: { role: account.role },
    });

    console.log(`${account.role} (${account.name}):`);
    console.log(`  ${baseUrl}/admin/aktiver?token=${token}`);
    console.log(`  Utløper om 48 timer. Send lenken på en sikker kanal.\n`);
  }
  console.log("Ferdig. Slett disse lenkene fra terminalhistorikken når de er delt.");
  console.log("Aktivering setter passord. Slå på totrinn etterpå under Admin → Sikkerhet.");
  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error("Bootstrap feilet:", err);
  process.exit(1);
});
