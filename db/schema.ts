import {
  mysqlTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/mysql-core";

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
  },
  (t) => [
    index("idx_bookings_ref").on(t.bookingReference),
    index("idx_bookings_email").on(t.contactEmail),
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
  },
  (t) => [index("idx_support_email").on(t.email)],
);
