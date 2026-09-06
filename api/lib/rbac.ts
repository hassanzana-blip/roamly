// Rollebasert tilgangskontroll med eksplisitte tillatelser (ikke bare rollenavn).
// Minste privilegium: hver rolle får kun det den trenger.

export type StaffRole = "OWNER" | "ADMIN" | "SUPPORT" | "FINANCE" | "READ_ONLY";

export type Permission =
  | "overview:read"
  | "bookings:read"
  | "bookings:write"
  | "bookings:reconcile"
  | "quotes:read"
  | "quotes:write"
  | "customers:read"
  | "customers:reveal"
  | "payments:read"
  | "refunds:request"
  | "refunds:process"
  | "support:read"
  | "support:write"
  | "reports:read"
  | "audit:read"
  | "staff:read"
  | "staff:manage"
  | "jobs:manage"
  | "settings:manage";

const ADMIN_OPS: Permission[] = [
  "overview:read",
  "bookings:read",
  "bookings:write",
  "bookings:reconcile",
  "quotes:read",
  "quotes:write",
  "customers:read",
  "customers:reveal",
  "payments:read",
  "refunds:request",
  "refunds:process",
  "support:read",
  "support:write",
  "reports:read",
  "jobs:manage",
  "settings:manage",
];

export const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<Permission>> = {
  OWNER: new Set<Permission>([...ADMIN_OPS, "audit:read", "staff:read", "staff:manage"]),
  ADMIN: new Set<Permission>([...ADMIN_OPS, "audit:read", "staff:read"]),
  SUPPORT: new Set<Permission>([
    "overview:read",
    "bookings:read",
    "customers:read",
    "support:read",
    "support:write",
    "quotes:read",
  ]),
  FINANCE: new Set<Permission>([
    "overview:read",
    "bookings:read",
    "payments:read",
    "refunds:request",
    "refunds:process",
    "reports:read",
    "customers:read",
  ]),
  READ_ONLY: new Set<Permission>([
    "overview:read",
    "bookings:read",
    "quotes:read",
    "customers:read",
    "payments:read",
    "support:read",
    "reports:read",
  ]),
};

export const VALID_ROLES: StaffRole[] = ["OWNER", "ADMIN", "SUPPORT", "FINANCE", "READ_ONLY"];

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role as StaffRole];
  return perms ? perms.has(permission) : false;
}

/** Kritiske handlinger som krever re-autentisering (fersk sesjonsbekreftelse). */
export const REAUTH_ACTIONS = new Set(["refunds:process", "staff:manage"]);
