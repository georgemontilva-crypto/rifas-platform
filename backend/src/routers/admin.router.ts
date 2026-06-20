import { z } from "zod";
import { eq, desc, count } from "drizzle-orm";
import { router, adminProcedure } from "../trpc";
import { db } from "../db";
import { users, raffles, payments, tickets, auditLogs } from "../db/schema";

export const adminRouter = router({
  dashboard: adminProcedure.query(async () => {
    const [userCount] = await db.select({ value: count() }).from(users);
    const [raffleCount] = await db.select({ value: count() }).from(raffles);
    const [pendingPayments] = await db
      .select({ value: count() })
      .from(payments)
      .where(eq(payments.status, "pending"));
    const [soldTickets] = await db
      .select({ value: count() })
      .from(tickets)
      .where(eq(tickets.status, "sold"));

    return {
      userCount: userCount.value,
      raffleCount: raffleCount.value,
      pendingPayments: pendingPayments.value,
      soldTickets: soldTickets.value,
    };
  }),

  pendingPayments: adminProcedure.query(async () => {
    return db.query.payments.findMany({
      where: eq(payments.status, "pending"),
      orderBy: [desc(payments.createdAt)],
      limit: 100,
    });
  }),

  auditLog: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input }) => {
      return db.query.auditLogs.findMany({
        orderBy: [desc(auditLogs.createdAt)],
        limit: input.limit,
      });
    }),
});
