import cron from "node-cron";
import { releaseExpiredReservations } from "../routers/ticket.router.js";

export function startCronJobs() {
  // Cada minuto: libera boletos reservados cuyo tiempo de pago expiró
  cron.schedule("* * * * *", async () => {
    try {
      await releaseExpiredReservations();
    } catch (err) {
      console.error("Error liberando reservas expiradas:", err);
    }
  });
}
