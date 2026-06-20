import { router } from "../trpc";
import { authRouter } from "./auth.router";
import { raffleRouter } from "./raffle.router";
import { ticketRouter } from "./ticket.router";
import { paymentRouter } from "./payment.router";
import { drawRouter } from "./draw.router";
import { adminRouter } from "./admin.router";

export const appRouter = router({
  auth: authRouter,
  raffle: raffleRouter,
  ticket: ticketRouter,
  payment: paymentRouter,
  draw: drawRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
