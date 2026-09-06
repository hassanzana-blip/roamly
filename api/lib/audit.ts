import { getDb } from "../queries/connection";
import { auditLogs } from "../../db/schema";

export type AuditInput = {
  actorType: "staff" | "customer" | "system" | "worker" | "webhook";
  actorId?: string | number | null;
  actorLabel?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | number | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
};

/**
 * Append-only revisjonslogg. Aldri legg passord, tokens, kortdata eller
 * unødvendige personopplysninger i metadata.
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await getDb()
      .insert(auditLogs)
      .values({
        actorType: input.actorType,
        actorId: input.actorId != null ? String(input.actorId) : null,
        actorLabel: input.actorLabel ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId != null ? String(input.targetId) : null,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
        ip: input.ip ?? null,
      });
  } catch (err) {
    // Revisjonslogging skal aldri knekke hovedflyten — men den må synes i loggen.
    console.error("AUDIT-LOGG FEILET:", input.action, err);
  }
}
