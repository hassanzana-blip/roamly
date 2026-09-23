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
 * Postkassen en adresse leveres til: små bokstaver, uten mellomrom og uten
 * «+merkelapp» i lokaldelen (eier+reise@… og EIER@… er samme postkasse som
 * eier@…). En lokaldel som bare er «+…» beholdes som den er.
 */
export function mailboxKey(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0) return e;
  const local = e.slice(0, at);
  const base = local.split("+")[0];
  return `${base || local}@${e.slice(at + 1)}`;
}

/**
 * Samme postkasse? Symmetrisk og uavhengig av databasens sortering: begge
 * sider normaliseres her, så en ansatt lagret som «Eier+Staff@X» sperrer
 * «eier@x», og en ansatt lagret som «eier@x» sperrer «EIER+kunde@X».
 */
export function sameMailbox(a: string, b: string): boolean {
  return mailboxKey(a) === mailboxKey(b);
}

/**
 * Tilhører e-posten en ansatt? Null/tom e-post (telefonkontoer) er aldri staff.
 *
 * Staff-tabellen er liten (noen få ansatte), så alle adressene hentes og
 * sammenlignes i koden. Da kan ikke kollasjon, store bokstaver eller en
 * merkelapp på den lagrede adressen gi et hull.
 */
export async function isStaffEmail(email: string | null | undefined): Promise<boolean> {
  if (!email || !email.trim()) return false;
  const staff = await getDb().select({ email: staffUsers.email }).from(staffUsers);
  return staff.some((s) => sameMailbox(s.email, email));
}
