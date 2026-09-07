import {
  mysqlTable,
  varchar,
  text,
  mediumtext,
  timestamp,
  boolean,
  int,
  bigint,
  decimal,
  index,
  uniqueIndex,
  type AnyMySqlColumn,
} from "drizzle-orm/mysql-core";

/** Referanse til en `serial`-primærnøkkel (bigint unsigned) — brukes for alle FK-kolonner. */
const ref = (name: string) => bigint(name, { mode: "number", unsigned: true });
/** Pengebeløp i minste enhet (øre/cent). Aldri flyttall. */
const minor = (name: string) => bigint(name, { mode: "number" });

// ─── Eksisterende tabeller (utvidet, ikke duplisert) ───────────────────────

export const bookings = mysqlTable(
  "bookings",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    orderId: varchar("order_id", { length: 64 }).notNull().unique(),
    bookingReference: varchar("booking_reference", { length: 12 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 32 }),
    liveMode: boolean("live_mode").notNull().default(false),
    payload: mediumtext("payload").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    // ── Livssyklus-utvidelser (legges til via migrasjon) ──
    state: varchar("state", { length: 32 }).notNull().default("CONFIRMED"),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customers.id),
    quoteId: ref("quote_id").references((): AnyMySqlColumn => quotes.id),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
    totalCurrency: varchar("total_currency", { length: 3 }),
    source: varchar("source", { length: 16 }).notNull().default("web"),
    idempotencyKey: varchar("idempotency_key", { length: 64 }),
    customerAccountId: ref("customer_account_id").references((): AnyMySqlColumn => customerAccounts.id),
    checkoutSessionId: ref("checkout_session_id").references((): AnyMySqlColumn => checkoutSessions.id),
    supplier: varchar("supplier", { length: 16 }).notNull().default("duffel"),
    cancelledAt: timestamp("cancelled_at"),
    travelCompletedAt: timestamp("travel_completed_at"),
    lastReconciledAt: timestamp("last_reconciled_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("idx_bookings_ref").on(t.bookingReference),
    index("idx_bookings_email").on(t.contactEmail),
    index("idx_bookings_state").on(t.state),
    index("idx_bookings_created").on(t.createdAt),
    index("idx_bookings_customer").on(t.customerId),
    index("idx_bookings_account").on(t.customerAccountId),
    index("idx_bookings_live").on(t.liveMode),
    uniqueIndex("uq_bookings_idempotency").on(t.idempotencyKey),
  ],
);

export const supportMessages = mysqlTable(
  "support_messages",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    caseReference: varchar("case_reference", { length: 16 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    bookingReference: varchar("booking_reference", { length: 8 }),
    topic: varchar("topic", { length: 24 }).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    caseId: ref("case_id").references((): AnyMySqlColumn => supportCases.id),
    authorType: varchar("author_type", { length: 16 }).notNull().default("customer"),
    authorId: ref("author_id"),
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
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    role: varchar("role", { length: 16 }).notNull().default("READ_ONLY"),
    status: varchar("status", { length: 16 }).notNull().default("invited"),
    passwordHash: varchar("password_hash", { length: 255 }),
    avatarUrl: varchar("avatar_url", { length: 255 }),
    totpSecret: varchar("totp_secret", { length: 64 }),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    recoveryCodesJson: text("recovery_codes_json"),
    invitedById: ref("invited_by_id").references((): AnyMySqlColumn => staffUsers.id),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex("uq_staff_email").on(t.email)],
);

export const staffSessions = mysqlTable(
  "staff_sessions",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    userId: ref("user_id").references((): AnyMySqlColumn => staffUsers.id).notNull(),
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
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 16 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    createdById: ref("created_by_id").references((): AnyMySqlColumn => staffUsers.id),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_invite_token").on(t.tokenHash)],
);

// ─── Kundekontoer (enkel innlogging for reisende) ──────────────────────────

export const customerAccounts = mysqlTable(
  "customer_accounts",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    // Minst én av e-post/telefon er satt (håndheves i applikasjonslaget).
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 32 }),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 60 }).notNull(),
    lastName: varchar("last_name", { length: 60 }).notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    /** Bonus-saldo i hele kroner (1 % av kjøp + henvisninger). */
    bonusKr: int("bonus_kr").notNull().default(0),
    referralCode: varchar("referral_code", { length: 16 }),
    referredById: ref("referred_by_id").references((): AnyMySqlColumn => customerAccounts.id),
    locale: varchar("locale", { length: 5 }).notNull().default("nb"),
    currency: varchar("currency", { length: 3 }).notNull().default("NOK"),
    marketingConsentAt: timestamp("marketing_consent_at"),
    deletedAt: timestamp("deleted_at"),
    /** Profilbilde som data-URL (maks ~200 kB), satt av kunden selv. */
    avatarUrl: mediumtext("avatar_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex("uq_custacct_email").on(t.email),
    uniqueIndex("uq_custacct_phone").on(t.phone),
    uniqueIndex("uq_custacct_referral").on(t.referralCode),
  ],
);

export const customerEmailTokens = mysqlTable(
  "customer_email_tokens",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_custemailtoken_token").on(t.tokenHash)],
);

export const customerOtpCodes = mysqlTable(
  "customer_otp_codes",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_custotp_customer").on(t.customerId)],
);

export const savedTravelers = mysqlTable(
  "saved_travelers",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    firstName: varchar("first_name", { length: 60 }).notNull(),
    lastName: varchar("last_name", { length: 60 }).notNull(),
    bornOn: varchar("born_on", { length: 10 }),
    gender: varchar("gender", { length: 1 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_travelers_customer").on(t.customerId)],
);

export const priceAlerts = mysqlTable(
  "price_alerts",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id),
    email: varchar("email", { length: 255 }).notNull(),
    originIata: varchar("origin_iata", { length: 3 }).notNull(),
    destinationIata: varchar("destination_iata", { length: 3 }).notNull(),
    departDate: varchar("depart_date", { length: 10 }).notNull(),
    targetPrice: int("target_price").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_alerts_customer").on(t.customerId), index("idx_alerts_active").on(t.active, t.departDate)],
);

export const bookingHolds = mysqlTable(
  "booking_holds",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    offerId: varchar("offer_id", { length: 128 }).notNull(),
    offerSnapshot: text("offer_snapshot").notNull(),
    searchCtx: varchar("search_ctx", { length: 512 }),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id),
    email: varchar("email", { length: 255 }),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_hold_token").on(t.tokenHash), index("idx_hold_expires").on(t.expiresAt)],
);

export const customerSessions = mysqlTable(
  "customer_sessions",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    ip: varchar("ip", { length: 45 }),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => [
    uniqueIndex("uq_custsession_token").on(t.tokenHash),
    index("idx_custsession_customer").on(t.customerId),
  ],
);

export const customerPasswordResets = mysqlTable(
  "customer_password_resets",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_custreset_token").on(t.tokenHash)],
);

// ─── Kunder og bestillinger ────────────────────────────────────────────────

export const customers = mysqlTable(
  "customers",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 120 }),
    phone: varchar("phone", { length: 32 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex("uq_customers_email").on(t.email)],
);

export const bookingSegments = mysqlTable(
  "booking_segments",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id).notNull(),
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
  (t) => [index("idx_segments_booking").on(t.bookingId), index("idx_segments_departing").on(t.departingAt)],
);

export const bookingEvents = mysqlTable(
  "booking_events",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id).notNull(),
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
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    reference: varchar("reference", { length: 16 }).notNull(),
    createdById: ref("created_by_id").references((): AnyMySqlColumn => staffUsers.id).notNull(),
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
    index("idx_quotes_token").on(t.checkoutTokenHash),
    index("idx_quotes_expires").on(t.expiresAt),
  ],
);

// ─── Betalinger og refusjoner ──────────────────────────────────────────────

export const payments = mysqlTable(
  "payments",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id),
    quoteId: ref("quote_id").references((): AnyMySqlColumn => quotes.id),
    provider: varchar("provider", { length: 24 }).notNull(),
    providerRef: varchar("provider_ref", { length: 128 }),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("NOK"),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    note: varchar("note", { length: 255 }),
    amountMinor: minor("amount_minor"),
    refundedMinor: minor("refunded_minor").notNull().default(0),
    pspFeeMinor: minor("psp_fee_minor"),
    idempotencyKey: varchar("idempotency_key", { length: 64 }),
    failureCode: varchar("failure_code", { length: 64 }),
    authorizedAt: timestamp("authorized_at"),
    capturedAt: timestamp("captured_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("idx_payments_booking").on(t.bookingId),
    index("idx_payments_quote").on(t.quoteId),
    index("idx_payments_status").on(t.status),
    index("idx_payments_provider_ref").on(t.providerRef),
    uniqueIndex("uq_payments_idem").on(t.idempotencyKey),
  ],
);

export const refunds = mysqlTable(
  "refunds",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    paymentId: ref("payment_id").references((): AnyMySqlColumn => payments.id).notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("requested"),
    requestedById: ref("requested_by_id").references((): AnyMySqlColumn => staffUsers.id).notNull(),
    processedById: ref("processed_by_id").references((): AnyMySqlColumn => staffUsers.id),
    processedAt: timestamp("processed_at"),
    currency: varchar("currency", { length: 3 }).notNull().default("NOK"),
    refundCaseId: ref("refund_case_id").references((): AnyMySqlColumn => refundCases.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index("idx_refunds_payment").on(t.paymentId), index("idx_refunds_status").on(t.status)],
);

// ─── Kundeservice ──────────────────────────────────────────────────────────

export const supportCases = mysqlTable(
  "support_cases",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    reference: varchar("reference", { length: 16 }).notNull(),
    subject: varchar("subject", { length: 160 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    customerName: varchar("customer_name", { length: 120 }),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id),
    priority: varchar("priority", { length: 12 }).notNull().default("normal"),
    status: varchar("status", { length: 24 }).notNull().default("open"),
    assigneeId: ref("assignee_id").references((): AnyMySqlColumn => staffUsers.id),
    dueAt: timestamp("due_at"),
    tags: varchar("tags", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex("uq_cases_ref").on(t.reference),
    index("idx_cases_status").on(t.status),
    index("idx_cases_assignee").on(t.assigneeId),
    index("idx_cases_email").on(t.customerEmail),
    index("idx_cases_booking").on(t.bookingId),
  ],
);

export const internalNotes = mysqlTable(
  "internal_notes",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id),
    caseId: ref("case_id").references((): AnyMySqlColumn => supportCases.id),
    authorId: ref("author_id").references((): AnyMySqlColumn => staffUsers.id).notNull(),
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
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    provider: varchar("provider", { length: 16 }).notNull().default("duffel"),
    eventId: varchar("event_id", { length: 64 }).notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    payload: mediumtext("payload").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("received"),
    error: text("error"),
    processedAt: timestamp("processed_at"),
    attempts: int("attempts").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_webhook_event").on(t.provider, t.eventId), index("idx_webhook_status").on(t.status)],
);

export const jobs = mysqlTable(
  "jobs",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    type: varchar("type", { length: 48 }).notNull(),
    payload: mediumtext("payload").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    attempts: int("attempts").notNull().default(0),
    maxAttempts: int("max_attempts").notNull().default(5),
    runAt: timestamp("run_at").notNull().defaultNow(),
    lockedBy: varchar("locked_by", { length: 64 }),
    lockedAt: timestamp("locked_at"),
    lastError: text("last_error"),
    dedupeKey: varchar("dedupe_key", { length: 128 }),
    /** Kopi av dedupeKey så lenge jobben er aktiv (pending/claimed/failed); NULL når done/dead.
     *  Unik indeks her gjør at samme nøkkel kan brukes igjen etter fullføring. */
    activeDedupeKey: varchar("active_dedupe_key", { length: 128 }),
    priority: int("priority").notNull().default(5),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("idx_jobs_poll").on(t.status, t.runAt),
    index("idx_jobs_dedupe").on(t.dedupeKey),
    uniqueIndex("uq_jobs_active_dedupe").on(t.activeDedupeKey),
  ],
);

// ─── Team: lønn, meldinger, notater, problemer, partnerforespørsler ───────

export const payrollEntries = mysqlTable(
  "payroll_entries",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    staffUserId: ref("staff_user_id").references((): AnyMySqlColumn => staffUsers.id).notNull(),
    periodLabel: varchar("period_label", { length: 40 }).notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("NOK"),
    status: varchar("status", { length: 16 }).notNull().default("planned"),
    note: varchar("note", { length: 255 }),
    registeredById: ref("registered_by_id").references((): AnyMySqlColumn => staffUsers.id).notNull(),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("idx_payroll_user").on(t.staffUserId),
    index("idx_payroll_status").on(t.status),
  ],
);

export const teamMessages = mysqlTable(
  "team_messages",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    senderId: ref("sender_id").references((): AnyMySqlColumn => staffUsers.id).notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_teammsg_created").on(t.createdAt)],
);

export const staffNotes = mysqlTable(
  "staff_notes",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    authorId: ref("author_id").references((): AnyMySqlColumn => staffUsers.id).notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    body: text("body").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    color: varchar("color", { length: 16 }).notNull().default("sun"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index("idx_staffnotes_created").on(t.createdAt)],
);

export const problemReports = mysqlTable(
  "problem_reports",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull(),
    severity: varchar("severity", { length: 16 }).notNull().default("medium"),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    reportedById: ref("reported_by_id").references((): AnyMySqlColumn => staffUsers.id).notNull(),
    assignedToId: ref("assigned_to_id").references((): AnyMySqlColumn => staffUsers.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => [
    index("idx_problems_status").on(t.status),
    index("idx_problems_assignee").on(t.assignedToId),
  ],
);

export const partnerRequests = mysqlTable(
  "partner_requests",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    type: varchar("type", { length: 16 }).notNull(),
    partner: varchar("partner", { length: 40 }),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 32 }),
    detailsJson: text("details_json").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("new"),
    handledById: ref("handled_by_id").references((): AnyMySqlColumn => staffUsers.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("idx_partnerreq_status").on(t.status),
    index("idx_partnerreq_type").on(t.type),
  ],
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
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

// ─── Samfunn (kunde-community) ─────────────────────────────────────────────
// Innlegg, kommentarer og liker mellom innloggede kunder. Moderering:
// skjulte innlegg vises ikke i feed (admin kan skjule/vise).

export const communityPosts = mysqlTable(
  "community_posts",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    /** "question" = spørsmål, "story" = reisetips/historie */
    kind: varchar("kind", { length: 16 }).notNull().default("story"),
    body: text("body").notNull(),
    /** Valgfri ruteknagg, f.eks. "OSL–EBL" */
    routeTag: varchar("route_tag", { length: 16 }),
    likes: int("likes").notNull().default(0),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_community_posts_created").on(t.createdAt),
    index("idx_community_posts_customer").on(t.customerId),
    index("idx_community_posts_hidden").on(t.hidden),
  ],
);

export const communityComments = mysqlTable(
  "community_comments",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    postId: ref("post_id").references((): AnyMySqlColumn => communityPosts.id, { onDelete: "cascade" }).notNull(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    body: text("body").notNull(),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_community_comments_post").on(t.postId),
    index("idx_community_comments_customer").on(t.customerId),
  ],
);

export const communityLikes = mysqlTable(
  "community_likes",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    postId: ref("post_id").references((): AnyMySqlColumn => communityPosts.id, { onDelete: "cascade" }).notNull(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_community_like").on(t.postId, t.customerId),
    index("idx_community_likes_post").on(t.postId),
  ],
);

// ─── Checkout og booking-orkestrering ─────────────────────────────────────
// En checkout_session er server-sannheten for hva kunden så og godtok.
// En booking_attempt er den idempotente enheten som knytter betaling ↔ leverandørordre.

export const CHECKOUT_SESSION_STATES = [
  "created", "payment_pending", "authorized", "booking", "confirmed",
  "failed", "expired", "cancelled", "price_changed",
] as const;

export const checkoutSessions = mysqlTable(
  "checkout_sessions",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    publicId: varchar("public_id", { length: 36 }).notNull(),
    offerId: varchar("offer_id", { length: 128 }).notNull(),
    offerSnapshot: mediumtext("offer_snapshot").notNull(),
    offerExpiresAt: timestamp("offer_expires_at"),
    searchCtx: varchar("search_ctx", { length: 512 }),
    /** Passasjerer UTEN identitetsdokumenter (de ligger kryptert i passenger_documents). */
    passengersJson: text("passengers_json").notNull(),
    servicesJson: text("services_json"),
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 32 }).notNull(),
    customerAccountId: ref("customer_account_id").references((): AnyMySqlColumn => customerAccounts.id),
    locale: varchar("locale", { length: 5 }).notNull().default("nb"),
    currency: varchar("currency", { length: 3 }).notNull(),
    supplierAmountMinor: minor("supplier_amount_minor").notNull(),
    servicesAmountMinor: minor("services_amount_minor").notNull().default(0),
    serviceFeeAmountMinor: minor("service_fee_amount_minor").notNull().default(0),
    bonusUsedMinor: minor("bonus_used_minor").notNull().default(0),
    totalAmountMinor: minor("total_amount_minor").notNull(),
    breakdownJson: text("breakdown_json").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("created"),
    pspProvider: varchar("psp_provider", { length: 24 }),
    pspIntentId: varchar("psp_intent_id", { length: 128 }),
    paymentMethod: varchar("payment_method", { length: 24 }),
    idempotencyKey: varchar("idempotency_key", { length: 64 }).notNull(),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id),
    lastError: text("last_error"),
    ip: varchar("ip", { length: 45 }),
    userAgent: varchar("user_agent", { length: 255 }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex("uq_checkout_public").on(t.publicId),
    uniqueIndex("uq_checkout_idem").on(t.idempotencyKey),
    index("idx_checkout_status").on(t.status),
    index("idx_checkout_intent").on(t.pspIntentId),
    index("idx_checkout_email").on(t.contactEmail),
    index("idx_checkout_expires").on(t.expiresAt),
  ],
);

export const BOOKING_ATTEMPT_STATES = [
  "CREATED", "PAYMENT_AUTHORIZED", "SUPPLIER_ORDERING", "SUPPLIER_UNKNOWN",
  "SUPPLIER_CONFIRMED", "CAPTURED", "CONFIRMED", "FAILED_VOIDED", "FAILED",
] as const;

export const bookingAttempts = mysqlTable(
  "booking_attempts",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    checkoutSessionId: ref("checkout_session_id").references((): AnyMySqlColumn => checkoutSessions.id).notNull(),
    /** Brukes som Duffel Idempotency-Key og Stripe idempotency key. */
    idempotencyKey: varchar("idempotency_key", { length: 64 }).notNull(),
    state: varchar("state", { length: 24 }).notNull().default("CREATED"),
    supplierOrderId: varchar("supplier_order_id", { length: 64 }),
    supplierBookingReference: varchar("supplier_booking_reference", { length: 12 }),
    supplierTotalMinor: minor("supplier_total_minor"),
    supplierCurrency: varchar("supplier_currency", { length: 3 }),
    pspIntentId: varchar("psp_intent_id", { length: 128 }),
    pspChargeId: varchar("psp_charge_id", { length: 128 }),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id),
    attempts: int("attempts").notNull().default(0),
    lastError: text("last_error"),
    lastErrorCode: varchar("last_error_code", { length: 64 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex("uq_attempt_idem").on(t.idempotencyKey),
    index("idx_attempt_session").on(t.checkoutSessionId),
    index("idx_attempt_state").on(t.state),
    index("idx_attempt_supplier").on(t.supplierOrderId),
  ],
);

export const bookingAttemptEvents = mysqlTable(
  "booking_attempt_events",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    attemptId: ref("attempt_id").references((): AnyMySqlColumn => bookingAttempts.id, { onDelete: "cascade" }).notNull(),
    fromState: varchar("from_state", { length: 24 }),
    toState: varchar("to_state", { length: 24 }).notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_attempt_events").on(t.attemptId)],
);

/** Kortlivede tilgangstokens til én booking (bekreftelseslenke, kvittering). */
export const bookingAccessTokens = mysqlTable(
  "booking_access_tokens",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id, { onDelete: "cascade" }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_bat_token").on(t.tokenHash), index("idx_bat_booking").on(t.bookingId)],
);

export const tickets = mysqlTable(
  "tickets",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id).notNull(),
    passengerId: varchar("passenger_id", { length: 64 }),
    passengerName: varchar("passenger_name", { length: 140 }),
    type: varchar("type", { length: 32 }).notNull().default("electronic_ticket"),
    uniqueIdentifier: varchar("unique_identifier", { length: 64 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_tickets_booking").on(t.bookingId), uniqueIndex("uq_ticket").on(t.bookingId, t.uniqueIdentifier)],
);

/** Identitetsdokumenter — nummer lagres KUN kryptert (AES-256-GCM, nøkkel i PII_ENCRYPTION_KEY). */
export const passengerDocuments = mysqlTable(
  "passenger_documents",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id),
    checkoutSessionId: ref("checkout_session_id").references((): AnyMySqlColumn => checkoutSessions.id),
    passengerId: varchar("passenger_id", { length: 64 }).notNull(),
    type: varchar("type", { length: 24 }).notNull().default("passport"),
    identifierCiphertext: varchar("identifier_ciphertext", { length: 255 }).notNull(),
    identifierLast4: varchar("identifier_last4", { length: 4 }).notNull(),
    issuingCountryCode: varchar("issuing_country_code", { length: 2 }).notNull(),
    expiresOn: varchar("expires_on", { length: 10 }).notNull(),
    nationality: varchar("nationality", { length: 2 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_pdoc_booking").on(t.bookingId), index("idx_pdoc_session").on(t.checkoutSessionId)],
);

// ─── Refusjonssaker (egen tilstandsmaskin) ─────────────────────────────────

export const REFUND_STATES = [
  "requested", "eligibility_checked", "supplier_requested", "supplier_pending",
  "supplier_confirmed", "supplier_rejected", "amount_confirmed",
  "psp_refund_created", "psp_refund_pending", "psp_refund_succeeded", "psp_refund_failed",
  "customer_notified", "closed", "rejected",
] as const;

export const refundCases = mysqlTable(
  "refund_cases",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    reference: varchar("reference", { length: 16 }).notNull(),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id).notNull(),
    paymentId: ref("payment_id").references((): AnyMySqlColumn => payments.id),
    state: varchar("state", { length: 32 }).notNull().default("requested"),
    kind: varchar("kind", { length: 24 }).notNull().default("customer_cancellation"),
    initiatedBy: varchar("initiated_by", { length: 16 }).notNull(),
    requestedById: varchar("requested_by_id", { length: 64 }),
    approvedById: ref("approved_by_id").references((): AnyMySqlColumn => staffUsers.id),
    currency: varchar("currency", { length: 3 }).notNull(),
    requestedAmountMinor: minor("requested_amount_minor"),
    supplierCancellationId: varchar("supplier_cancellation_id", { length: 64 }),
    supplierRefundAmountMinor: minor("supplier_refund_amount_minor"),
    supplierRefundCurrency: varchar("supplier_refund_currency", { length: 3 }),
    serviceFeeRefundMinor: minor("service_fee_refund_minor").notNull().default(0),
    servicesRefundMinor: minor("services_refund_minor").notNull().default(0),
    /** Endelig beløp til kunde. */
    customerRefundAmountMinor: minor("customer_refund_amount_minor"),
    pspRefundId: varchar("psp_refund_id", { length: 128 }),
    pspRefundStatus: varchar("psp_refund_status", { length: 24 }),
    reason: text("reason").notNull(),
    passengerIds: varchar("passenger_ids", { length: 255 }),
    evidenceJson: text("evidence_json"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
    closedAt: timestamp("closed_at"),
  },
  (t) => [
    uniqueIndex("uq_refund_ref").on(t.reference),
    index("idx_refundcase_booking").on(t.bookingId),
    index("idx_refundcase_state").on(t.state),
    index("idx_refundcase_psp").on(t.pspRefundId),
  ],
);

export const refundEvents = mysqlTable(
  "refund_events",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    refundCaseId: ref("refund_case_id").references((): AnyMySqlColumn => refundCases.id, { onDelete: "cascade" }).notNull(),
    fromState: varchar("from_state", { length: 32 }),
    toState: varchar("to_state", { length: 32 }).notNull(),
    actorType: varchar("actor_type", { length: 16 }).notNull(),
    actorId: varchar("actor_id", { length: 64 }),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_refund_events").on(t.refundCaseId)],
);

/** Immutable hovedbok: dobbelt bokføring i minste enhet. Aldri UPDATE/DELETE. */
export const ledgerEntries = mysqlTable(
  "ledger_entries",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id),
    paymentId: ref("payment_id").references((): AnyMySqlColumn => payments.id),
    refundCaseId: ref("refund_case_id").references((): AnyMySqlColumn => refundCases.id),
    account: varchar("account", { length: 32 }).notNull(),
    direction: varchar("direction", { length: 6 }).notNull(),
    amountMinor: minor("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    description: varchar("description", { length: 255 }),
    externalRef: varchar("external_ref", { length: 128 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_ledger_booking").on(t.bookingId), index("idx_ledger_account").on(t.account, t.currency)],
);

export const scheduleChanges = mysqlTable(
  "schedule_changes",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id).notNull(),
    webhookEventId: ref("webhook_event_id").references((): AnyMySqlColumn => webhookEvents.id),
    oldSegmentsJson: text("old_segments_json").notNull(),
    newSegmentsJson: text("new_segments_json").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("detected"),
    customerNotifiedAt: timestamp("customer_notified_at"),
    resolvedAt: timestamp("resolved_at"),
    resolvedById: ref("resolved_by_id").references((): AnyMySqlColumn => staffUsers.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_schedchange_booking").on(t.bookingId), index("idx_schedchange_status").on(t.status)],
);

export const consents = mysqlTable(
  "consents",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    customerAccountId: ref("customer_account_id").references((): AnyMySqlColumn => customerAccounts.id),
    email: varchar("email", { length: 255 }).notNull(),
    type: varchar("type", { length: 32 }).notNull(),
    version: varchar("version", { length: 16 }).notNull(),
    granted: boolean("granted").notNull(),
    source: varchar("source", { length: 32 }).notNull(),
    ip: varchar("ip", { length: 45 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_consents_email").on(t.email, t.type), index("idx_consents_account").on(t.customerAccountId)],
);

export const emailEvents = mysqlTable(
  "email_events",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    recipient: varchar("recipient", { length: 255 }).notNull(),
    kind: varchar("kind", { length: 48 }).notNull(),
    locale: varchar("locale", { length: 5 }).notNull().default("nb"),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id),
    provider: varchar("provider", { length: 24 }),
    providerMessageId: varchar("provider_message_id", { length: 128 }),
    status: varchar("status", { length: 16 }).notNull().default("queued"),
    error: text("error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index("idx_email_recipient").on(t.recipient), index("idx_email_booking").on(t.bookingId), index("idx_email_status").on(t.status)],
);

export const settings = mysqlTable(
  "settings",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    key: varchar("key", { length: 64 }).notNull(),
    valueJson: text("value_json").notNull(),
    updatedById: ref("updated_by_id").references((): AnyMySqlColumn => staffUsers.id),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex("uq_settings_key").on(t.key)],
);

export const fraudFlags = mysqlTable(
  "fraud_flags",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    customerAccountId: ref("customer_account_id").references((): AnyMySqlColumn => customerAccounts.id),
    checkoutSessionId: ref("checkout_session_id").references((): AnyMySqlColumn => checkoutSessions.id),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id),
    type: varchar("type", { length: 48 }).notNull(),
    score: int("score").notNull().default(0),
    note: varchar("note", { length: 255 }),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    reviewedById: ref("reviewed_by_id").references((): AnyMySqlColumn => staffUsers.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index("idx_fraud_status").on(t.status), index("idx_fraud_account").on(t.customerAccountId)],
);

/** Fakturanummerserie (bokføringsforskriften krever løpende, ubrutt nummerering). */
export const invoices = mysqlTable(
  "invoices",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    invoiceNumber: int("invoice_number").notNull(),
    kind: varchar("kind", { length: 16 }).notNull().default("receipt"),
    bookingId: ref("booking_id").references((): AnyMySqlColumn => bookings.id).notNull(),
    refundCaseId: ref("refund_case_id").references((): AnyMySqlColumn => refundCases.id),
    currency: varchar("currency", { length: 3 }).notNull(),
    totalMinor: minor("total_minor").notNull(),
    vatMinor: minor("vat_minor").notNull().default(0),
    linesJson: text("lines_json").notNull(),
    issuedAt: timestamp("issued_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_invoice_number").on(t.invoiceNumber), index("idx_invoice_booking").on(t.bookingId)],
);

// Tilgjengelig for typede referanser ellers i koden.
export type AnyColumn = AnyMySqlColumn;

// ─── Reiseidentitet (kundens profil utover navn og e-post) ───────────────────
// Én rad per konto. JSON-kolonner holder lister og små strukturer som endres
// sammen; alt leses og skrives gjennom api/account.ts, som validerer formen.

export const customerTravelProfiles = mysqlTable(
  "customer_travel_profiles",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    /** Hjemmeflyplasser, IATA-koder i prioritert rekkefølge. JSON-array. */
    homeAirportsJson: text("home_airports_json"),
    /** Favorittreisemål (destinasjons-id fra innholdet, f.eks. "erbil"). JSON-array. */
    favouriteDestinationsJson: text("favourite_destinations_json"),
    preferredCabin: varchar("preferred_cabin", { length: 16 }),
    /** cabin_only | 20kg | 30kg | 40kg */
    baggagePreference: varchar("baggage_preference", { length: 16 }),
    /** Hvem kunden vanligvis reiser med: solo | partner | family | friends */
    companions: varchar("companions", { length: 16 }),
    /** { directPreferred, maxOneStop, avoidSelfTransfer, avoidAirportChange, shortLayovers, flexibleTickets, refundablePreferred } */
    flightPrefsJson: text("flight_prefs_json"),
    /** { morningDeparture, daytimeArrival, avoidOvernightConnection } */
    timingPrefsJson: text("timing_prefs_json"),
    /** window | aisle | together */
    seatPreference: varchar("seat_preference", { length: 16 }),
    /** Smaksprofil: { beach: 0–100, city, food, culture, nature, ... } — kun reisepreferanser, aldri sensitive kjennetegn. */
    tasteJson: text("taste_json"),
    /** Varslingsvalg per kanal og type. */
    notificationPrefsJson: text("notification_prefs_json"),
    /** Antall ganger kunden har delt henvisningslenken (kun teller, ingen mottakere lagres). */
    referralShares: int("referral_shares").notNull().default(0),
    onboardingCompletedAt: timestamp("onboarding_completed_at"),
    onboardingSkippedAt: timestamp("onboarding_skipped_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex("uq_travelprofile_customer").on(t.customerId)],
);

/** Lagret innhold på konto: reisemål, flyreiser, artikler, reiseidéer. */
export const savedItems = mysqlTable(
  "saved_items",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    /** destination | flight | article | trip_idea */
    kind: varchar("kind", { length: 16 }).notNull(),
    /** Stabil nøkkel innen typen (destinasjons-id, artikkelslug, rute+dato for fly). */
    refId: varchar("ref_id", { length: 120 }).notNull(),
    /** Øyeblikksbilde av det som ble lagret (rute, dato, pris sett da) — merket «pris da du lagret». */
    payloadJson: text("payload_json"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_saved_customer_kind_ref").on(t.customerId, t.kind, t.refId), index("idx_saved_customer").on(t.customerId, t.createdAt)],
);

/** Søkehistorikk for innloggede kunder (anonyme kunder får kun localStorage). */
export const searchHistory = mysqlTable(
  "search_history",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    originIata: varchar("origin_iata", { length: 3 }).notNull(),
    destinationIata: varchar("destination_iata", { length: 3 }).notNull(),
    departDate: varchar("depart_date", { length: 10 }).notNull(),
    returnDate: varchar("return_date", { length: 10 }),
    adults: int("adults").notNull().default(1),
    children: int("children").notNull().default(0),
    infants: int("infants").notNull().default(0),
    cabin: varchar("cabin", { length: 16 }).notNull().default("economy"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_searchhistory_customer").on(t.customerId, t.createdAt)],
);

/** Varslingsinnboks. Alt her er faktiske hendelser på kontoen — aldri fabrikkert aktivitet. */
export const customerNotifications = mysqlTable(
  "customer_notifications",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    /** price_watch | flight_update | booking | payment | reminder | deal | match | referral | rewards | system */
    type: varchar("type", { length: 24 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body"),
    href: varchar("href", { length: 255 }),
    /** Hindrer dobbeltvarsling om samme hendelse. */
    dedupeKey: varchar("dedupe_key", { length: 120 }),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_notif_dedupe").on(t.dedupeKey), index("idx_notif_customer").on(t.customerId, t.readAt, t.createdAt)],
);

/**
 * Prisovervåking med fleksible rammer («helger i september–oktober under
 * 5 000 kr, maks ett stopp»). Skiller seg fra price_alerts (én dato, ett mål):
 * dette er en stående bestilling som workeren sjekker mot leverandøren.
 * Et treff meldes bare når et ekte tilbud oppfyller alle vilkårene.
 */
export const priceWatches = mysqlTable(
  "price_watches",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    originIata: varchar("origin_iata", { length: 3 }).notNull(),
    destinationIata: varchar("destination_iata", { length: 3 }).notNull(),
    dateFrom: varchar("date_from", { length: 10 }).notNull(),
    dateTo: varchar("date_to", { length: 10 }).notNull(),
    weekendsOnly: boolean("weekends_only").notNull().default(false),
    /** Reiselengde i netter (null = én vei). */
    nightsMin: int("nights_min"),
    nightsMax: int("nights_max"),
    maxPriceMinor: minor("max_price_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("NOK"),
    maxStops: int("max_stops"),
    minCheckedBags: int("min_checked_bags"),
    adults: int("adults").notNull().default(1),
    children: int("children").notNull().default(0),
    infants: int("infants").notNull().default(0),
    cabin: varchar("cabin", { length: 16 }).notNull().default("economy"),
    /** immediate | daily | weekly */
    cadence: varchar("cadence", { length: 12 }).notNull().default("daily"),
    active: boolean("active").notNull().default(true),
    lastCheckedAt: timestamp("last_checked_at"),
    lastNotifiedAt: timestamp("last_notified_at"),
    /** Beste treff ved siste sjekk: { priceMinor, currency, departDate, returnDate, stops, checkedBags, offerId, seenAt } */
    lastResultJson: text("last_result_json"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index("idx_pricewatch_customer").on(t.customerId, t.active), index("idx_pricewatch_due").on(t.active, t.lastCheckedAt)],
);

/** Kundens svar på «Tilbud for deg» — mater den regelbaserte anbefalingen. */
export const dealFeedback = mysqlTable(
  "deal_feedback",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    dealId: varchar("deal_id", { length: 64 }).notNull(),
    /** interested | not_for_me | saved */
    verdict: varchar("verdict", { length: 16 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_dealfeedback_customer_deal").on(t.customerId, t.dealId)],
);

/**
 * Bonusreskontro. customer_accounts.bonus_kr er den cachede saldoen; hver
 * endring skrives her slik at kunden og admin kan se hvor kronene kom fra.
 */
export const rewardEvents = mysqlTable(
  "reward_events",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    /** booking | referral | referral_welcome | milestone | promotion | redemption | adjustment */
    kind: varchar("kind", { length: 24 }).notNull(),
    /** Hele kroner, signert (uttak er negativt). */
    amountKr: int("amount_kr").notNull(),
    refType: varchar("ref_type", { length: 32 }),
    refId: varchar("ref_id", { length: 64 }),
    note: varchar("note", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_reward_customer").on(t.customerId, t.createdAt), uniqueIndex("uq_reward_ref").on(t.kind, t.refType, t.refId)],
);

// ─── ReiseMatch: par og venner ───────────────────────────────────────────────
// En økt deles med lenke (token). Deltakerne svarer hver for seg; svarene
// ligger i JSON og vises aldri rått til de andre — bare enigheten og
// kandidatene. Budsjett deles kun hvis deltakeren selv sa ja.

export const matchSessions = mysqlTable(
  "match_sessions",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    token: varchar("token", { length: 32 }).notNull(),
    /** couple | friends */
    mode: varchar("mode", { length: 12 }).notNull(),
    title: varchar("title", { length: 80 }).notNull(),
    ownerCustomerId: ref("owner_customer_id").references((): AnyMySqlColumn => customerAccounts.id),
    /** Hemmelig eier-nøkkel (hash) for gjester uten konto. */
    ownerKeyHash: varchar("owner_key_hash", { length: 64 }),
    /** Vennerom: valgt reisemål når gruppen har bestemt seg. */
    decidedDestinationId: varchar("decided_destination_id", { length: 40 }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_match_token").on(t.token), index("idx_match_owner").on(t.ownerCustomerId)],
);

export const matchParticipants = mysqlTable(
  "match_participants",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    sessionId: ref("session_id").references((): AnyMySqlColumn => matchSessions.id).notNull(),
    name: varchar("name", { length: 40 }).notNull(),
    customerId: ref("customer_id").references((): AnyMySqlColumn => customerAccounts.id),
    /** Deltakerens egen nøkkel (hash) — for å redigere sine svar/stemmer uten konto. */
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    answersJson: text("answers_json").notNull(),
    shareBudget: boolean("share_budget").notNull().default(false),
    /** Datoer deltakeren ikke kan: [{ from, to }] */
    unavailableJson: text("unavailable_json"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_matchpart_session").on(t.sessionId)],
);

export const matchVotes = mysqlTable(
  "match_votes",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    sessionId: ref("session_id").references((): AnyMySqlColumn => matchSessions.id).notNull(),
    participantId: ref("participant_id").references((): AnyMySqlColumn => matchParticipants.id).notNull(),
    destinationId: varchar("destination_id", { length: 40 }).notNull(),
    /** 1 = for, -1 = mot */
    value: int("value").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_matchvote").on(t.participantId, t.destinationId), index("idx_matchvote_session").on(t.sessionId)],
);

export const matchComments = mysqlTable(
  "match_comments",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    sessionId: ref("session_id").references((): AnyMySqlColumn => matchSessions.id).notNull(),
    participantId: ref("participant_id").references((): AnyMySqlColumn => matchParticipants.id).notNull(),
    body: varchar("body", { length: 500 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_matchcomment_session").on(t.sessionId, t.createdAt)],
);

// ─── Reisetavler ─────────────────────────────────────────────────────────────
// «Ibiza med gutta», «Familie Kurdistan». Eieren har konto; tavla deles med
// privat lenke. Gjester med lenken kan stemme og kommentere med navn.

export const tripBoards = mysqlTable(
  "trip_boards",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    token: varchar("token", { length: 32 }).notNull(),
    ownerCustomerId: ref("owner_customer_id").references((): AnyMySqlColumn => customerAccounts.id).notNull(),
    title: varchar("title", { length: 80 }).notNull(),
    /** Destinasjons-id hvis tavla har et forsidebilde fra innholdet vårt. */
    coverDestinationId: varchar("cover_destination_id", { length: 40 }),
    /** Valgfri periode: fri tekst («Sommer 2027», «18.–21. oktober»). */
    when: varchar("when_text", { length: 60 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex("uq_board_token").on(t.token), index("idx_board_owner").on(t.ownerCustomerId)],
);

export const tripBoardItems = mysqlTable(
  "trip_board_items",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    boardId: ref("board_id").references((): AnyMySqlColumn => tripBoards.id).notNull(),
    /** destination | flight | article | note */
    kind: varchar("kind", { length: 16 }).notNull(),
    refId: varchar("ref_id", { length: 120 }),
    /** Øyeblikksbilde: rute, dato, pris sett da, tittel … */
    payloadJson: text("payload_json"),
    note: varchar("note", { length: 500 }),
    addedByName: varchar("added_by_name", { length: 40 }),
    addedByCustomerId: ref("added_by_customer_id").references((): AnyMySqlColumn => customerAccounts.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_boarditem_board").on(t.boardId, t.createdAt)],
);

export const tripBoardVotes = mysqlTable(
  "trip_board_votes",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    itemId: ref("item_id").references((): AnyMySqlColumn => tripBoardItems.id).notNull(),
    /** Stabil nøkkel per stemmegiver: konto-id eller nettleserens nøkkel (hash). */
    voterKey: varchar("voter_key", { length: 64 }).notNull(),
    voterName: varchar("voter_name", { length: 40 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_boardvote").on(t.itemId, t.voterKey)],
);

export const tripBoardComments = mysqlTable(
  "trip_board_comments",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    boardId: ref("board_id").references((): AnyMySqlColumn => tripBoards.id).notNull(),
    authorName: varchar("author_name", { length: 40 }).notNull(),
    authorCustomerId: ref("author_customer_id").references((): AnyMySqlColumn => customerAccounts.id),
    body: varchar("body", { length: 500 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_boardcomment_board").on(t.boardId, t.createdAt)],
);
