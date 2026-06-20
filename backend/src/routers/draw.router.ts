import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { router, publicProcedure, adminProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { raffles, tickets, auditLogs } from "../db/schema.js";
import { computeWinningNumber, verifyCommit } from "../utils/verifiableDraw.js";

export const drawRouter = router({
  // Cierra la rifa, revela el seed comprometido y calcula el ganador.
  // A partir de aquí, raffle.commitHash y raffle.revealedSeed quedan públicos
  // para que cualquiera pueda verificar con sha256(seed) === commitHash
  // y recalcular el número ganador de forma independiente.
  closeAndDraw: adminProcedure
    .input(z.object({ raffleId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const raffle = await db.query.raffles.findFirst({ where: eq(raffles.id, input.raffleId) });
      if (!raffle) throw new TRPCError({ code: "NOT_FOUND" });
      if (raffle.status === "drawn") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esta rifa ya fue sorteada" });
      }
      if (!raffle.revealedSeed) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No existe seed comprometido" });
      }

      const winningNumber = computeWinningNumber(
        raffle.revealedSeed,
        raffle.id,
        raffle.totalTickets
      );

      await db
        .update(raffles)
        .set({ status: "drawn", winningTicketNumber: winningNumber })
        .where(eq(raffles.id, raffle.id));

      await db.insert(auditLogs).values({
        actorId: ctx.user.id,
        action: "raffle.drawn",
        targetType: "raffle",
        targetId: raffle.id,
        metadata: JSON.stringify({ winningNumber }),
        ipAddress: ctx.req.ip,
      });

      const winnerTicket = await db.query.tickets.findFirst({
        where: and(eq(tickets.raffleId, raffle.id), eq(tickets.number, winningNumber)),
      });

      return { winningNumber, winnerUserId: winnerTicket?.userId ?? null };
    }),

  // Endpoint público de verificación: cualquier persona, sin autenticarse,
  // puede confirmar que el sorteo no fue manipulado.
  verify: publicProcedure
    .input(z.object({ raffleId: z.string() }))
    .query(async ({ input }) => {
      const raffle = await db.query.raffles.findFirst({ where: eq(raffles.id, input.raffleId) });
      if (!raffle || !raffle.commitHash || !raffle.revealedSeed) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sorteo no disponible para verificación" });
      }

      const commitValid = verifyCommit(raffle.revealedSeed, raffle.commitHash);
      const recomputed = computeWinningNumber(raffle.revealedSeed, raffle.id, raffle.totalTickets);

      return {
        commitHash: raffle.commitHash,
        revealedSeed: raffle.revealedSeed,
        publishedWinningNumber: raffle.winningTicketNumber,
        recomputedWinningNumber: recomputed,
        commitHashValid: commitValid,
        resultsMatch: recomputed === raffle.winningTicketNumber,
      };
    }),
});
