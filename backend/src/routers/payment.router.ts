import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { router, publicProcedure, adminProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { payments, tickets, raffles, auditLogs } from "../db/schema.js";

const guestInfoSchema = z.object({
  guestName: z.string().min(2).max(150),
  guestPhone: z.string().max(30).optional(),
  guestEmail: z.string().email().max(255).optional().or(z.literal("")),
});

export const paymentRouter = router({
  // Crea una orden de pago para un comprador SIN CUENTA. Recibe el
  // reservationToken devuelto por ticket.reserveNumbers para confirmar que
  // esos boletos en verdad fueron reservados por quien está pagando.
  // Genera un ticketCode público para que el comprador consulte su ticket
  // digital después (/ticket/:code) sin necesidad de login.
  createGuest: publicProcedure
    .input(
      guestInfoSchema.extend({
        raffleId: z.string(),
        ticketIds: z.array(z.string()).min(1).max(100),
        reservationToken: z.string(),
        provider: z.enum(["stripe", "mercadopago", "paypal", "manual_transfer"]),
      })
    )
    .mutation(async ({ input }) => {
      const raffle = await db.query.raffles.findFirst({ where: eq(raffles.id, input.raffleId) });
      if (!raffle) throw new TRPCError({ code: "NOT_FOUND" });

      const reserved = await db.query.tickets.findMany({
        where: and(
          inArray(tickets.id, input.ticketIds),
          eq(tickets.reservationToken, input.reservationToken),
          eq(tickets.status, "reserved")
        ),
      });

      if (reserved.length !== input.ticketIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tu reserva expiró o ya no es válida, vuelve a elegir tus números",
        });
      }

      const amount = (Number(raffle.ticketPrice) * reserved.length).toFixed(2);
      const paymentId = nanoid();
      const ticketCode = nanoid(20);

      await db.insert(payments).values({
        id: paymentId,
        guestName: input.guestName,
        guestPhone: input.guestPhone || null,
        guestEmail: input.guestEmail || null,
        ticketCode,
        raffleId: raffle.id,
        ticketCount: reserved.length,
        amount,
        provider: input.provider,
        idempotencyKey: nanoid(),
        status: input.provider === "manual_transfer" ? "pending" : "processing",
      });

      await db
        .update(tickets)
        .set({ purchaseId: paymentId })
        .where(inArray(tickets.id, input.ticketIds));

      return { ticketCode, paymentId };
    }),

  // Consulta pública del ticket digital por código, sin necesidad de cuenta.
  byCode: publicProcedure
    .input(z.object({ ticketCode: z.string() }))
    .query(async ({ input }) => {
      const payment = await db.query.payments.findFirst({
        where: eq(payments.ticketCode, input.ticketCode),
      });
      if (!payment) throw new TRPCError({ code: "NOT_FOUND", message: "Ticket no encontrado" });

      const raffle = await db.query.raffles.findFirst({ where: eq(raffles.id, payment.raffleId) });
      const ticketRows = await db.query.tickets.findMany({
        where: eq(tickets.purchaseId, payment.id),
      });

      return {
        payment,
        raffle,
        numbers: ticketRows.map((t) => t.number).sort((a, b) => a - b),
      };
    }),

  // Adjunta el comprobante de pago usando el código público del ticket
  attachProofByCode: publicProcedure
    .input(z.object({ ticketCode: z.string(), proofUrl: z.string().url() }))
    .mutation(async ({ input }) => {
      await db
        .update(payments)
        .set({ proofUrl: input.proofUrl, status: "processing" })
        .where(eq(payments.ticketCode, input.ticketCode));
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

      await db
        .update(tickets)
        .set({ status: "available", purchaseId: null, reservationToken: null, reservedAt: null, reservationExpiresAt: null })
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
});
