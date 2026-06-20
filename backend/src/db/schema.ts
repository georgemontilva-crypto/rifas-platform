import {
  mysqlTable,
  varchar,
  int,
  bigint,
  decimal,
  boolean,
  timestamp,
  text,
  mysqlEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// ──────────────────────────────────────────────
// USERS
// ──────────────────────────────────────────────
export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 150 }).notNull(),
    phone: varchar("phone", { length: 30 }),
    role: mysqlEnum("role", ["user", "admin", "superadmin"]).default("user").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    // Security: lockout tracking against brute force
    failedLoginAttempts: int("failed_login_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until"),
    twoFactorSecret: varchar("two_factor_secret", { length: 255 }),
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
    avatarUrl: varchar("avatar_url", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  })
);

// ──────────────────────────────────────────────
// REFRESH TOKENS (rotación + revocación)
// ──────────────────────────────────────────────
export const refreshTokens = mysqlTable(
  "refresh_tokens",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(), // nunca guardamos el token plano
    userAgent: varchar("user_agent", { length: 300 }),
    ipAddress: varchar("ip_address", { length: 64 }),
    revoked: boolean("revoked").default(false).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("refresh_user_idx").on(table.userId),
  })
);

// ──────────────────────────────────────────────
// RAFFLES (RIFAS)
// ──────────────────────────────────────────────
export const raffles = mysqlTable(
  "raffles",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 200 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    coverImageUrl: varchar("cover_image_url", { length: 500 }),
    ticketPrice: decimal("ticket_price", { precision: 12, scale: 2 }).notNull(),
    totalTickets: int("total_tickets").notNull(),
    minTicketsToActivate: int("min_tickets_to_activate").default(0).notNull(),
    status: mysqlEnum("status", [
      "draft",
      "active",
      "sold_out",
      "closed",
      "drawn",
      "cancelled",
    ])
      .default("draft")
      .notNull(),
    drawDate: timestamp("draw_date"),
    // ── Verifiable randomness (commit-reveal) ──
    // Antes de abrir la venta se publica el hash del seed (compromiso público).
    // Al cerrar, se revela el seed y cualquiera puede recalcular el ganador.
    commitHash: varchar("commit_hash", { length: 64 }), // sha256(seed)
    revealedSeed: varchar("revealed_seed", { length: 128 }),
    winningTicketNumber: int("winning_ticket_number"),
    createdBy: varchar("created_by", { length: 36 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("raffles_slug_idx").on(table.slug),
    statusIdx: index("raffles_status_idx").on(table.status),
  })
);

// ──────────────────────────────────────────────
// TICKETS (boletos individuales por rifa)
// ──────────────────────────────────────────────
export const tickets = mysqlTable(
  "tickets",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    raffleId: varchar("raffle_id", { length: 36 }).notNull(),
    number: int("number").notNull(), // 0..totalTickets-1
    status: mysqlEnum("status", ["available", "reserved", "sold"])
      .default("available")
      .notNull(),
    userId: varchar("user_id", { length: 36 }),
    reservedAt: timestamp("reserved_at"),
    // Reservas expiran solas: liberación automática vía cron
    reservationExpiresAt: timestamp("reservation_expires_at"),
    purchaseId: varchar("purchase_id", { length: 36 }),
  },
  (table) => ({
    raffleNumberIdx: uniqueIndex("tickets_raffle_number_idx").on(
      table.raffleId,
      table.number
    ),
    raffleStatusIdx: index("tickets_raffle_status_idx").on(
      table.raffleId,
      table.status
    ),
  })
);

// ──────────────────────────────────────────────
// PAYMENTS / PURCHASES
// ──────────────────────────────────────────────
export const payments = mysqlTable(
  "payments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    raffleId: varchar("raffle_id", { length: 36 }).notNull(),
    ticketCount: int("ticket_count").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).default("USD").notNull(),
    provider: mysqlEnum("provider", [
      "stripe",
      "mercadopago",
      "paypal",
      "manual_transfer",
    ]).notNull(),
    providerPaymentId: varchar("provider_payment_id", { length: 255 }),
    // Idempotencia para evitar doble-cobro o doble-procesamiento de webhooks
    idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
    status: mysqlEnum("status", [
      "pending",
      "processing",
      "approved",
      "rejected",
      "refunded",
    ])
      .default("pending")
      .notNull(),
    proofUrl: varchar("proof_url", { length: 500 }), // comprobante para transferencia manual
    approvedBy: varchar("approved_by", { length: 36 }),
    approvedAt: timestamp("approved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    idempotencyIdx: uniqueIndex("payments_idempotency_idx").on(
      table.idempotencyKey
    ),
    userIdx: index("payments_user_idx").on(table.userId),
    raffleIdx: index("payments_raffle_idx").on(table.raffleId),
  })
);

// ──────────────────────────────────────────────
// AUDIT LOG (trazabilidad de acciones sensibles)
// ──────────────────────────────────────────────
export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    actorId: varchar("actor_id", { length: 36 }),
    action: varchar("action", { length: 100 }).notNull(),
    targetType: varchar("target_type", { length: 50 }),
    targetId: varchar("target_id", { length: 36 }),
    metadata: text("metadata"), // JSON serializado
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    actorIdx: index("audit_actor_idx").on(table.actorId),
    actionIdx: index("audit_action_idx").on(table.action),
  })
);

// ──────────────────────────────────────────────
// NOTIFICATIONS
// ──────────────────────────────────────────────
export const notifications = mysqlTable(
  "notifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    message: text("message").notNull(),
    read: boolean("read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("notifications_user_idx").on(table.userId),
  })
);

// ──────────────────────────────────────────────
// RELATIONS
// ──────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  tickets: many(tickets),
  payments: many(payments),
  refreshTokens: many(refreshTokens),
}));

export const rafflesRelations = relations(raffles, ({ many }) => ({
  tickets: many(tickets),
  payments: many(payments),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  raffle: one(raffles, { fields: [tickets.raffleId], references: [raffles.id] }),
  user: one(users, { fields: [tickets.userId], references: [users.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
  raffle: one(raffles, { fields: [payments.raffleId], references: [raffles.id] }),
}));
