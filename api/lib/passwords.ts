import { hash, verify } from "@node-rs/argon2";

// Argon2id — anbefalt parameterprofil (OWASP): m=19 MiB, t=2, p=1
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTS);
}

export async function verifyPassword(hashValue: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashValue, plain);
  } catch {
    return false;
  }
}

export function passwordIssues(plain: string): string[] {
  const issues: string[] = [];
  if (plain.length < 12) issues.push("Passordet må være minst 12 tegn.");
  if (!/[a-zæøå]/.test(plain) || !/[A-ZÆØÅ]/.test(plain))
    issues.push("Passordet må inneholde både store og små bokstaver.");
  if (!/[0-9]/.test(plain)) issues.push("Passordet må inneholde minst ett tall.");
  return issues;
}
