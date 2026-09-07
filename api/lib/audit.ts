import { getDb } from "../queries/connection";
import { auditLogs } from "../../db/schema";
import { log } from "./logger";

export type AuditActorType = "staff" | "customer" | "system" | "worker" | "webhook";

export type AuditInput = {
  actorType: AuditActorType;
  actorId?: string | number | null;
  actorLabel?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | number | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
};

/** Standard label per actor type when none is supplied (keeps reports readable). */
const DEFAULT_ACTOR_LABEL: Record<AuditActorType, string> = {
  staff: "Ansatt",
  customer: "Kunde",
  system: "System",
  worker: "Bakgrunnsjobb",
  webhook: "Webhook",
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
        actorId: input.actorId != null ? String(input.actorId).slice(0, 64) : null,
        actorLabel: (input.actorLabel ?? DEFAULT_ACTOR_LABEL[input.actorType]).slice(0, 120),
        action: input.action.slice(0, 64),
        targetType: input.targetType ?? null,
        targetId: input.targetId != null ? String(input.targetId).slice(0, 64) : null,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
        ip: input.ip ? input.ip.slice(0, 45) : null,
      });
  } catch (err) {
    // Revisjonslogging skal aldri knekke hovedflyten — men den må synes i loggen.
    log.error({ err, action: input.action }, "AUDIT-LOGG FEILET");
  }
}
