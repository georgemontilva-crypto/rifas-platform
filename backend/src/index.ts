import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers/index.js";
import { createContext } from "./context.js";
import { authLimiter, ticketLimiter, generalLimiter } from "./middleware/rateLimit.js";
import { webhookRouter } from "./routes/webhook.routes.js";
import { startCronJobs } from "./utils/cron.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
// Una sola app: frontend y backend viven en el mismo origen, así que casi
// nunca hace falta CORS cross-origin real, pero se deja configurado por si
// en algún momento se separan en dos dominios distintos.

app.set("trust proxy", 1); // necesario en Railway para que rate-limit/IP funcionen bien

// ── Seguridad de cabeceras HTTP ──
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", FRONTEND_URL],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ── CORS restringido al dominio del frontend, con credenciales para la cookie de refresh ──
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

// Webhooks ANTES de express.json(): necesitan el body crudo para validar firmas
app.use("/api/webhooks", webhookRouter);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(generalLimiter);

app.use("/api/auth", authLimiter);
app.use("/api/trpc/ticket.reserve", ticketLimiter);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      // Log interno sin filtrar detalles sensibles al cliente
      console.error(`[tRPC] Error en ${path}:`, error.message);
    },
  })
);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Servir el frontend compilado (React/Vite) desde el mismo proceso ──
const frontendDist = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));

// Cualquier ruta que no sea /api ni /health devuelve index.html, para que
// React Router maneje la navegación del lado del cliente (SPA fallback).
app.get(/^(?!\/api|\/health).*/, (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🎟️  Servidor de rifas escuchando en puerto ${PORT}`);
  startCronJobs();
});
