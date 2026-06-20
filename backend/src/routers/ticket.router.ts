import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { tickets, raffles } from "../db/schema.js";

const RESERVATION_MINUTES = 15;

export const ticketRouter = router({
  // Devuelve el estado (number + status) de todos los boletos de una rifa,
  // para pintar el grid de selección. No expone quién reservó cada uno.
  grid: publicProcedure
    .input(z.object({ raffleId: z.string() }))
    .query(async ({ input }) => {
      const rows = await db.query.tickets.findMany({
        where: eq(tickets.raffleId, input.raffleId),
        columns: { number: true, status: true },
      });
      return rows.sort((a, b) => a.number - b.number);
    }),

  // Sugiere N números disponibles al azar (no los reserva todavía).
  // El cliente los agrega a su selección y confirma con `reserveNumbers`.
  randomNumbers: publicProcedure
    .input(z.object({ raffleId: z.string(), quantity: z.number().int().min(1).max(50) }))
    .query(async ({ input }) => {
      const available = await db.query.tickets.findMany({
        where: and(eq(tickets.raffleId, input.raffleId), eq(tickets.status, "available")),
        columns: { number: true },
      });
      if (available.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No quedan boletos disponibles" });
      }
      const shuffled = available.map((t) => t.number).sort(() => Math.random() - 0.5);
      return shuffled.slice(0, input.quantity);
    }),

  // Reserva números específicos elegidos por el comprador (con o sin cuenta).
  // No requiere login: genera un `reservationToken` que el cliente guarda
  // para poder confirmar el pago después.
  reserveNumbers: publicProcedure
    .input(
      z.object({
        raffleId: z.string(),
        numbers: z.array(z.number().int().min(0)).min(1).max(100),
      })
    )
    .mutation(async ({ input }) => {
      const raffle = await db.query.raffles.findFirst({ where: eq(raffles.id, input.raffleId) });
      if (!raffle || raffle.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esta rifa no está activa" });
      }

      const reservationToken = nanoid(32);
      const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

      return db.transaction(async (tx) => {
        const rows = await tx.query.tickets.findMany({
          where: and(
            eq(tickets.raffleId, input.raffleId),
            inArray(tickets.number, input.numbers),
            eq(tickets.status, "available")
          ),
        });

        if (rows.length < input.numbers.length) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Algunos de esos números ya no están disponibles, elige otros",
          });
        }

        const ids = rows.map((t) => t.id);
        await tx
          .update(tickets)
          .set({
            status: "reserved",
            reservationToken,
            reservedAt: new Date(),
            reservationExpiresAt: expiresAt,
          })
          .where(and(inArray(tickets.id, ids), eq(tickets.status, "available")));

        const confirmed = await tx.query.tickets.findMany({
          where: and(inArray(tickets.id, ids), eq(tickets.reservationToken, reservationToken)),
        });

        if (confirmed.length < input.numbers.length) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Otra persona reservó alguno de esos números al mismo tiempo, intenta de nuevo",
          });
        }

        return {
          ticketIds: confirmed.map((t) => t.id),
          numbers: confirmed.map((t) => t.number),
          reservationToken,
          expiresAt,
        };
      });
    }),

  release: publicProcedure
    .input(z.object({ reservationToken: z.string() }))
    .mutation(async ({ input }) => {
      await db
        .update(tickets)
        .set({ status: "available", reservationToken: null, reservedAt: null, reservationExpiresAt: null })
        .where(eq(tickets.reservationToken, input.reservationToken));
      return { success: true };
    }),

  // Conservado para usuarios con cuenta (ej. admin probando el flujo viejo)
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
    .set({ status: "available", reservationToken: null, reservedAt: null, reservationExpiresAt: null })
    .where(and(eq(tickets.status, "reserved"), sql`reservation_expires_at < NOW()`));
}
