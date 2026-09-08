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
  | "expenses:read"
  | "expenses:write"
  | "refunds:request"
  | "refunds:process"
  | "support:read"
  | "support:write"
  | "reports:read"
  | "audit:read"
  | "staff:read"
  | "staff:manage"
  | "jobs:manage"
  | "settings:manage"
  | "team:use"
  | "problems:read"
  | "problems:write"
  | "payroll:read"
  | "payroll:manage"
  | "partners:read"
  | "partners:write";

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
  "expenses:read",
  "expenses:write",
  "refunds:request",
  "refunds:process",
  "support:read",
  "support:write",
  "reports:read",
  "jobs:manage",
  "settings:manage",
  "team:use",
  "problems:read",
  "problems:write",
  "partners:read",
  "partners:write",
];

export const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<Permission>> = {
  OWNER: new Set<Permission>([...ADMIN_OPS, "audit:read", "staff:read", "staff:manage", "payroll:read", "payroll:manage"]),
  ADMIN: new Set<Permission>([...ADMIN_OPS, "audit:read", "staff:read", "payroll:read"]),
  SUPPORT: new Set<Permission>([
    "overview:read",
    "bookings:read",
    "customers:read",
    "support:read",
    "support:write",
    "quotes:read",
    "team:use",
    "problems:read",
    "problems:write",
    "partners:read",
    "partners:write",
  ]),
  FINANCE: new Set<Permission>([
    "overview:read",
    "bookings:read",
    "payments:read",
    "expenses:read",
    "expenses:write",
    "refunds:request",
    "refunds:process",
    "reports:read",
    "customers:read",
    "team:use",
    "problems:read",
    "payroll:read",
  ]),
  READ_ONLY: new Set<Permission>([
    "overview:read",
    "bookings:read",
    "quotes:read",
    "customers:read",
    "payments:read",
    "expenses:read",
    "support:read",
    "reports:read",
    "problems:read",
    "partners:read",
  ]),
};

export const VALID_ROLES: StaffRole[] = ["OWNER", "ADMIN", "SUPPORT", "FINANCE", "READ_ONLY"];

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role as StaffRole];
  return perms ? perms.has(permission) : false;
}

/** Kritiske handlinger som krever re-autentisering (fersk sesjonsbekreftelse). */
export const REAUTH_ACTIONS = new Set(["refunds:process", "staff:manage"]);
