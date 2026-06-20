import { router } from "../trpc.js";
import { authRouter } from "./auth.router.js";
import { raffleRouter } from "./raffle.router.js";
import { ticketRouter } from "./ticket.router.js";
import { paymentRouter } from "./payment.router.js";
import { drawRouter } from "./draw.router.js";
import { adminRouter } from "./admin.router.js";

export const appRouter = router({
  auth: authRouter,
  raffle: raffleRouter,
  ticket: ticketRouter,
  payment: paymentRouter,
  draw: drawRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
