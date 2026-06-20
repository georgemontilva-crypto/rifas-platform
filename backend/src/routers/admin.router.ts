import { z } from "zod";
import { eq, desc, count } from "drizzle-orm";
import { router, adminProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { users, raffles, payments, tickets, auditLogs } from "../db/schema.js";

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

  // Lista de participantes (pagos) de una rifa específica, con conteos por
  // estado para el panel de administración (Apartado/Revisando/Pagado).
  participants: adminProcedure
    .input(z.object({ raffleId: z.string(), search: z.string().optional() }))
    .query(async ({ input }) => {
      const rows = await db.query.payments.findMany({
        where: eq(payments.raffleId, input.raffleId),
        orderBy: [desc(payments.createdAt)],
        limit: 500,
      });

      const filtered = input.search
        ? rows.filter((p) =>
            (p.guestName || "").toLowerCase().includes(input.search!.toLowerCase())
          )
        : rows;

      const counts = {
        apartado: rows.filter((p) => p.status === "pending").length,
        revisando: rows.filter((p) => p.status === "processing").length,
        pagado: rows.filter((p) => p.status === "approved").length,
      };

      return { participants: filtered, counts };
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
