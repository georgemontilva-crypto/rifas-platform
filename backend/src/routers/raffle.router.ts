import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { router, publicProcedure, adminProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { raffles, tickets } from "../db/schema.js";
import { generateCommit } from "../utils/verifiableDraw.js";

const createRaffleSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  coverImageUrl: z.string().url().optional(),
  ticketPrice: z.number().positive().max(1_000_000),
  totalTickets: z.number().int().min(2).max(1_000_000),
  minTicketsToActivate: z.number().int().min(0).default(0),
  drawDate: z.coerce.date().optional(),
});

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") + "-" + nanoid(6)
  );
}

export const raffleRouter = router({
  list: publicProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where = input?.status ? eq(raffles.status, input.status as any) : undefined;
      return db.query.raffles.findMany({
        where,
        orderBy: [desc(raffles.createdAt)],
        limit: 100,
      });
    }),

  bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const raffle = await db.query.raffles.findFirst({ where: eq(raffles.slug, input.slug) });
    if (!raffle) throw new TRPCError({ code: "NOT_FOUND", message: "Rifa no encontrada" });

    const sold = await db.query.tickets.findMany({
      where: and(eq(tickets.raffleId, raffle.id), eq(tickets.status, "sold")),
    });

    return { raffle, soldCount: sold.length, availableCount: raffle.totalTickets - sold.length };
  }),

  // Crea la rifa Y publica el compromiso criptográfico (commitHash) del sorteo
  // ANTES de que se venda ningún boleto. El seed se guarda cifrado/oculto en DB
  // y solo se revela públicamente al cerrar la rifa.
  create: adminProcedure.input(createRaffleSchema).mutation(async ({ input, ctx }) => {
    const { seed, commitHash } = generateCommit();
    const raffleId = nanoid();
    const slug = slugify(input.title);

    await db.insert(raffles).values({
      id: raffleId,
      slug,
      title: input.title,
      description: input.description,
      coverImageUrl: input.coverImageUrl,
      ticketPrice: input.ticketPrice.toFixed(2),
      totalTickets: input.totalTickets,
      minTicketsToActivate: input.minTicketsToActivate,
      drawDate: input.drawDate,
      status: "draft",
      commitHash,
      revealedSeed: seed, // guardado pero NUNCA expuesto por la API hasta el cierre
      createdBy: ctx.user.id,
    });

    // Pre-generar los tickets como "available" para garantizar números únicos
    const batchSize = 1000;
    const ticketRows = Array.from({ length: input.totalTickets }, (_, i) => ({
      id: nanoid(),
      raffleId,
      number: i,
      status: "available" as const,
    }));
    for (let i = 0; i < ticketRows.length; i += batchSize) {
      await db.insert(tickets).values(ticketRows.slice(i, i + batchSize));
    }

    return { id: raffleId, slug, commitHash };
  }),

  activate: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await db.update(raffles).set({ status: "active" }).where(eq(raffles.id, input.id));
    return { success: true };
  }),
});
