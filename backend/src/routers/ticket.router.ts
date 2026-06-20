import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "../db";
import { tickets, raffles } from "../db/schema";

const RESERVATION_MINUTES = 10;

export const ticketRouter = router({
  // Reserva N boletos al azar disponibles. Usa una actualización condicional
  // (status = 'available') para que, bajo concurrencia, dos usuarios nunca
  // puedan reservar el mismo número: el UPDATE solo afecta filas que sigan
  // disponibles en ese instante, MySQL serializa las filas por la transacción.
  reserve: protectedProcedure
    .input(z.object({ raffleId: z.string(), quantity: z.number().int().min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const raffle = await db.query.raffles.findFirst({ where: eq(raffles.id, input.raffleId) });
      if (!raffle || raffle.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esta rifa no está activa" });
      }

      return db.transaction(async (tx) => {
        const available = await tx.query.tickets.findMany({
          where: and(eq(tickets.raffleId, input.raffleId), eq(tickets.status, "available")),
          limit: input.quantity,
        });

        if (available.length < input.quantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No hay suficientes boletos disponibles",
          });
        }

        const ids = available.map((t) => t.id);
        const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

        // Condición status='available' otra vez en el UPDATE: defensa en profundidad
        // contra carreras si dos requests leyeron la misma fila casi simultáneamente.
        await tx
          .update(tickets)
          .set({
            status: "reserved",
            userId: ctx.user.id,
            reservedAt: new Date(),
            reservationExpiresAt: expiresAt,
          })
          .where(and(inArray(tickets.id, ids), eq(tickets.status, "available")));

        const confirmed = await tx.query.tickets.findMany({
          where: and(inArray(tickets.id, ids), eq(tickets.userId, ctx.user.id), eq(tickets.status, "reserved")),
        });

        if (confirmed.length < input.quantity) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Otro usuario reservó algunos boletos al mismo tiempo, intenta de nuevo",
          });
        }

        return { ticketIds: confirmed.map((t) => t.id), numbers: confirmed.map((t) => t.number), expiresAt };
      });
    }),

  release: protectedProcedure
    .input(z.object({ ticketIds: z.array(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      await db
        .update(tickets)
        .set({ status: "available", userId: null, reservedAt: null, reservationExpiresAt: null })
        .where(and(inArray(tickets.id, input.ticketIds), eq(tickets.userId, ctx.user.id)));
      return { success: true };
    }),

  myTickets: protectedProcedure.query(async ({ ctx }) => {
    return db.query.tickets.findMany({
      where: and(eq(tickets.userId, ctx.user.id), eq(tickets.status, "sold")),
    });
  }),
});

/**
 * Job de limpieza (llamado desde cron, ver utils/cron.ts):
 * libera boletos cuya reserva expiró sin completar el pago, para que vuelvan
 * a estar disponibles para otros compradores.
 */
export async function releaseExpiredReservations() {
  await db
    .update(tickets)
    .set({ status: "available", userId: null, reservedAt: null, reservationExpiresAt: null })
    .where(and(eq(tickets.status, "reserved"), sql`reservation_expires_at < NOW()`));
}
