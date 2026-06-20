import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { payments, tickets, raffles, auditLogs } from "../db/schema.js";

export const paymentRouter = router({
  // Crea una orden de pago para boletos ya RESERVADOS por el usuario.
  // idempotencyKey la genera el cliente (uuid) y la reenvía si reintenta
  // la misma compra por timeout de red, evitando cobros duplicados.
  create: protectedProcedure
    .input(
      z.object({
        raffleId: z.string(),
        ticketIds: z.array(z.string()).min(1).max(100),
        provider: z.enum(["stripe", "mercadopago", "paypal", "manual_transfer"]),
        idempotencyKey: z.string().min(10).max(100),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query.payments.findFirst({
        where: eq(payments.idempotencyKey, input.idempotencyKey),
      });
      if (existing) return existing; // reintento seguro: devuelve la orden ya creada

      const raffle = await db.query.raffles.findFirst({ where: eq(raffles.id, input.raffleId) });
      if (!raffle) throw new TRPCError({ code: "NOT_FOUND" });

      const reserved = await db.query.tickets.findMany({
        where: and(
          inArray(tickets.id, input.ticketIds),
          eq(tickets.userId, ctx.user.id),
          eq(tickets.status, "reserved")
        ),
      });

      if (reserved.length !== input.ticketIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Los boletos seleccionados ya no están reservados a tu nombre",
        });
      }

      const amount = (Number(raffle.ticketPrice) * reserved.length).toFixed(2);
      const paymentId = nanoid();

      await db.insert(payments).values({
        id: paymentId,
        userId: ctx.user.id,
        raffleId: raffle.id,
        ticketCount: reserved.length,
        amount,
        provider: input.provider,
        idempotencyKey: input.idempotencyKey,
        status: input.provider === "manual_transfer" ? "pending" : "processing",
      });

      await db
        .update(tickets)
        .set({ purchaseId: paymentId })
        .where(inArray(tickets.id, input.ticketIds));

      return db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    }),

  attachProof: protectedProcedure
    .input(z.object({ paymentId: z.string(), proofUrl: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .update(payments)
        .set({ proofUrl: input.proofUrl })
        .where(and(eq(payments.id, input.paymentId), eq(payments.userId, ctx.user.id)));
      return { success: true };
    }),

  // Aprobación manual por un admin (transferencias bancarias). Marca los
  // boletos como vendidos solo cuando el dinero ya fue confirmado.
  approve: adminProcedure
    .input(z.object({ paymentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const payment = await db.query.payments.findFirst({ where: eq(payments.id, input.paymentId) });
      if (!payment) throw new TRPCError({ code: "NOT_FOUND" });
      if (payment.status === "approved") return { success: true };

      await db
        .update(payments)
        .set({ status: "approved", approvedBy: ctx.user.id, approvedAt: new Date() })
        .where(eq(payments.id, payment.id));

      await db
        .update(tickets)
        .set({ status: "sold" })
        .where(eq(tickets.purchaseId, payment.id));

      await db.insert(auditLogs).values({
        actorId: ctx.user.id,
        action: "payment.approved",
        targetType: "payment",
        targetId: payment.id,
        ipAddress: ctx.req.ip,
      });

      return { success: true };
    }),

  reject: adminProcedure
    .input(z.object({ paymentId: z.string(), reason: z.string().max(500).optional() }))
    .mutation(async ({ input, ctx }) => {
      const payment = await db.query.payments.findFirst({ where: eq(payments.id, input.paymentId) });
      if (!payment) throw new TRPCError({ code: "NOT_FOUND" });

      await db.update(payments).set({ status: "rejected" }).where(eq(payments.id, payment.id));

      // Libera los boletos para que vuelvan a la venta
      await db
        .update(tickets)
        .set({ status: "available", userId: null, purchaseId: null, reservedAt: null, reservationExpiresAt: null })
        .where(eq(tickets.purchaseId, payment.id));

      await db.insert(auditLogs).values({
        actorId: ctx.user.id,
        action: "payment.rejected",
        targetType: "payment",
        targetId: payment.id,
        metadata: JSON.stringify({ reason: input.reason }),
        ipAddress: ctx.req.ip,
      });

      return { success: true };
    }),

  myPayments: protectedProcedure.query(async ({ ctx }) => {
    return db.query.payments.findMany({ where: eq(payments.userId, ctx.user.id) });
  }),
});
