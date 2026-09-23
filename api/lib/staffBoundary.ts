import { inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { staffUsers } from "../../db/schema";

/**
 * Skillet mellom ansatte og kunder.
 *
 * En e-postadresse som står i staff_users (eier, admin, alle roller, også
 * inviterte og deaktiverte) kan aldri være en kundeidentitet: den kan ikke
 * registreres, ikke logge inn og ikke bære en kundesesjon. Regelen avgjøres
 * av staff-tabellen på serveren – aldri av navn i kode eller av klienten.
 */

/**
 * Adressene som regnes som «samme postkasse»: selve adressen og varianten uten
 * «+merkelapp» (zana+reise@… leveres til zana@…). Små bokstaver, uten mellomrom.
 */
export function emailCandidates(email: string): string[] {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0) return [e];
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const base = local.split("+")[0];
  return [...new Set([e, base ? `${base}@${domain}` : e])];
}

/** Tilhører e-posten en ansatt? Null/tom e-post (telefonkontoer) er aldri staff. */
export async function isStaffEmail(email: string | null | undefined): Promise<boolean> {
  if (!email || !email.trim()) return false;
  const rows = await getDb()
    .select({ id: staffUsers.id })
    .from(staffUsers)
    .where(inArray(staffUsers.email, emailCandidates(email)))
    .limit(1);
  return rows.length > 0;
}
