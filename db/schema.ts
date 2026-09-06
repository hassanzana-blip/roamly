import {
  mysqlTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  int,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ─── Eksisterende tabeller (utvidet, ikke duplisert) ───────────────────────

export const bookings = mysqlTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    orderId: varchar("order_id", { length: 64 }).notNull().unique(),
    bookingReference: varchar("booking_reference", { length: 12 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 32 }),
    liveMode: boolean("live_mode").notNull().default(false),
    payload: text("payload").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    // ── Livssyklus-utvidelser (legges til via migrasjon) ──
    state: varchar("state", { length: 32 }).notNull().default("CONFIRMED"),
    customerId: int("customer_id"),
    quoteId: int("quote_id"),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
    totalCurrency: varchar("total_currency", { length: 3 }),
    source: varchar("source", { length: 16 }).notNull().default("web"),
    idempotencyKey: varchar("idempotency_key", { length: 64 }),
    lastReconciledAt: timestamp("last_reconciled_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("idx_bookings_ref").on(t.bookingReference),
    index("idx_bookings_email").on(t.contactEmail),
    index("idx_bookings_state").on(t.state),
    index("idx_bookings_created").on(t.createdAt),
    uniqueIndex("uq_bookings_idempotency").on(t.idempotencyKey),
  ],
);

export const supportMessages = mysqlTable(
  "support_messages",
  {
    id: serial("id").primaryKey(),
    caseReference: varchar("case_reference", { length: 16 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    bookingReference: varchar("booking_reference", { length: 8 }),
    topic: varchar("topic", { length: 24 }).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    caseId: int("case_id"),
    authorType: varchar("author_type", { length: 16 }).notNull().default("customer"),
    authorId: int("author_id"),
    isInternal: boolean("is_internal").notNull().default(false),
  },
  (t) => [
    index("idx_support_email").on(t.email),
    index("idx_support_case").on(t.caseId),
  ],
);

// ─── Staff / autentisering ─────────────────────────────────────────────────

export const staffUsers = mysqlTable(
  "staff_users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    role: varchar("role", { length: 16 }).notNull().default("READ_ONLY"),
    status: varchar("status", { length: 16 }).notNull().default("invited"),
    passwordHash: varchar("password_hash", { length: 255 }),
    avatarUrl: varchar("avatar_url", { length: 255 }),
    totpSecret: varchar("totp_secret", { length: 64 }),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    recoveryCodesJson: text("recovery_codes_json"),
    invitedById: int("invited_by_id"),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex("uq_staff_email").on(t.email)],
);

export const staffSessions = mysqlTable(
  "staff_sessions",
  {
    id: serial("id").primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    userId: int("user_id").notNull(),
    mfaVerified: boolean("mfa_verified").notNull().default(false),
    ip: varchar("ip", { length: 45 }),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => [
    uniqueIndex("uq_session_token").on(t.tokenHash),
    index("idx_session_user").on(t.userId),
  ],
);

export const staffInvites = mysqlTable(
  "staff_invites",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 16 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    createdById: int("created_by_id"),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_invite_token").on(t.tokenHash)],
);

// ─── Kunder og bestillinger ────────────────────────────────────────────────

export const customers = mysqlTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 120 }),
    phone: varchar("phone", { length: 32 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index("idx_customers_email").on(t.email)],
);

export const bookingSegments = mysqlTable(
  "booking_segments",
  {
    id: serial("id").primaryKey(),
    bookingId: int("booking_id").notNull(),
    sliceIndex: int("slice_index").notNull(),
    segmentIndex: int("segment_index").notNull(),
    originIata: varchar("origin_iata", { length: 3 }).notNull(),
    destinationIata: varchar("destination_iata", { length: 3 }).notNull(),
    carrierIata: varchar("carrier_iata", { length: 3 }),
    flightNumber: varchar("flight_number", { length: 8 }),
    departingAt: varchar("departing_at", { length: 40 }),
    arrivingAt: varchar("arriving_at", { length: 40 }),
    cabinClass: varchar("cabin_class", { length: 24 }),
  },
  (t) => [index("idx_segments_booking").on(t.bookingId)],
);

export const bookingEvents = mysqlTable(
  "booking_events",
  {
    id: serial("id").primaryKey(),
    bookingId: int("booking_id").notNull(),
    fromState: varchar("from_state", { length: 32 }),
    toState: varchar("to_state", { length: 32 }).notNull(),
    actorType: varchar("actor_type", { length: 16 }).notNull(),
    actorId: varchar("actor_id", { length: 64 }),
    reason: text("reason"),
    correlationId: varchar("correlation_id", { length: 64 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_events_booking").on(t.bookingId)],
);

// ─── Tilbud (assisted booking) ─────────────────────────────────────────────

export const quotes = mysqlTable(
  "quotes",
  {
    id: serial("id").primaryKey(),
    reference: varchar("reference", { length: 16 }).notNull(),
    createdById: int("created_by_id").notNull(),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 32 }),
    offerId: varchar("offer_id", { length: 128 }).notNull(),
    offerSnapshot: text("offer_snapshot").notNull(),
    passengersJson: text("passengers_json"),
    serviceFeeAmount: decimal("service_fee_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("NOK"),
    status: varchar("status", { length: 24 }).notNull().default("draft"),
    checkoutTokenHash: varchar("checkout_token_hash", { length: 64 }),
    expiresAt: timestamp("expires_at").notNull(),
    bookedOrderId: varchar("booked_order_id", { length: 64 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex("uq_quotes_ref").on(t.reference),
    index("idx_quotes_status").on(t.status),
    index("idx_quotes_email").on(t.customerEmail),
  ],
);

// ─── Betalinger og refusjoner ──────────────────────────────────────────────

export const payments = mysqlTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    bookingId: int("booking_id"),
    quoteId: int("quote_id"),
    provider: varchar("provider", { length: 24 }).notNull(),
    providerRef: varchar("provider_ref", { length: 128 }),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("NOK"),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    note: varchar("note", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("idx_payments_booking").on(t.bookingId),
    index("idx_payments_status").on(t.status),
  ],
);

export const refunds = mysqlTable(
  "refunds",
  {
    id: serial("id").primaryKey(),
    paymentId: int("payment_id").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("requested"),
    requestedById: int("requested_by_id").notNull(),
    processedById: int("processed_by_id"),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_refunds_payment").on(t.paymentId)],
);

// ─── Kundeservice ──────────────────────────────────────────────────────────

export const supportCases = mysqlTable(
  "support_cases",
  {
    id: serial("id").primaryKey(),
    reference: varchar("reference", { length: 16 }).notNull(),
    subject: varchar("subject", { length: 160 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    customerName: varchar("customer_name", { length: 120 }),
    bookingId: int("booking_id"),
    priority: varchar("priority", { length: 12 }).notNull().default("normal"),
    status: varchar("status", { length: 24 }).notNull().default("open"),
    assigneeId: int("assignee_id"),
    dueAt: timestamp("due_at"),
    tags: varchar("tags", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex("uq_cases_ref").on(t.reference),
    index("idx_cases_status").on(t.status),
    index("idx_cases_assignee").on(t.assigneeId),
  ],
);

export const internalNotes = mysqlTable(
  "internal_notes",
  {
    id: serial("id").primaryKey(),
    bookingId: int("booking_id"),
    caseId: int("case_id"),
    authorId: int("author_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_notes_booking").on(t.bookingId),
    index("idx_notes_case").on(t.caseId),
  ],
);

// ─── Webhooks, jobber, revisjon ────────────────────────────────────────────

export const webhookEvents = mysqlTable(
  "webhook_events",
  {
    id: serial("id").primaryKey(),
    provider: varchar("provider", { length: 16 }).notNull().default("duffel"),
    eventId: varchar("event_id", { length: 64 }).notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    payload: text("payload").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("received"),
    error: text("error"),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_webhook_event").on(t.provider, t.eventId)],
);

export const jobs = mysqlTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    type: varchar("type", { length: 48 }).notNull(),
    payload: text("payload").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    attempts: int("attempts").notNull().default(0),
    maxAttempts: int("max_attempts").notNull().default(5),
    runAt: timestamp("run_at").notNull().defaultNow(),
    lockedBy: varchar("locked_by", { length: 64 }),
    lockedAt: timestamp("locked_at"),
    lastError: text("last_error"),
    dedupeKey: varchar("dedupe_key", { length: 128 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("idx_jobs_poll").on(t.status, t.runAt),
    uniqueIndex("uq_jobs_dedupe").on(t.dedupeKey),
  ],
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorType: varchar("actor_type", { length: 16 }).notNull(),
    actorId: varchar("actor_id", { length: 64 }),
    actorLabel: varchar("actor_label", { length: 120 }),
    action: varchar("action", { length: 64 }).notNull(),
    targetType: varchar("target_type", { length: 32 }),
    targetId: varchar("target_id", { length: 64 }),
    metadataJson: text("metadata_json"),
    ip: varchar("ip", { length: 45 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_audit_created").on(t.createdAt),
    index("idx_audit_target").on(t.targetType, t.targetId),
    index("idx_audit_actor").on(t.actorId),
  ],
);
