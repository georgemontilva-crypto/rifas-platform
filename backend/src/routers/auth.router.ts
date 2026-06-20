import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { db } from "../db";
import { users, refreshTokens, auditLogs } from "../db/schema";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "../utils/auth";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const REFRESH_EXPIRY_DAYS = 30;

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z
    .string()
    .min(10, "La contraseña debe tener al menos 10 caracteres")
    .max(128)
    .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
    .regex(/[a-z]/, "Debe incluir al menos una minúscula")
    .regex(/[0-9]/, "Debe incluir al menos un número"),
  fullName: z.string().min(2).max(150),
  phone: z.string().max(30).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

async function audit(
  actorId: string | null,
  action: string,
  meta: Record<string, unknown> = {},
  ip?: string
) {
  await db.insert(auditLogs).values({
    actorId,
    action,
    metadata: JSON.stringify(meta),
    ipAddress: ip,
  });
}

function setRefreshCookie(res: import("express").Response, token: string) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export const authRouter = router({
  register: publicProcedure.input(registerSchema).mutation(async ({ input, ctx }) => {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, input.email.toLowerCase()),
    });
    // Mensaje genérico: no revelamos si el email ya existe (evita enumeración de cuentas)
    if (existing) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No fue posible completar el registro con esos datos",
      });
    }

    const passwordHash = await hashPassword(input.password);
    const userId = nanoid();

    await db.insert(users).values({
      id: userId,
      email: input.email.toLowerCase(),
      passwordHash,
      fullName: input.fullName,
      phone: input.phone,
    });

    await audit(userId, "user.register", {}, ctx.req.ip);

    return { success: true };
  }),

  login: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.email, input.email.toLowerCase()),
    });

    // Respuesta genérica e idéntica en tiempo/forma si el usuario no existe,
    // para no filtrar qué emails están registrados.
    const genericError = new TRPCError({
      code: "UNAUTHORIZED",
      message: "Credenciales inválidas",
    });

    if (!user) throw genericError;

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Cuenta bloqueada temporalmente por intentos fallidos. Intenta más tarde.",
      });
    }

    const validPassword = await verifyPassword(input.password, user.passwordHash);

    if (!validPassword) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
      await db
        .update(users)
        .set({
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
        })
        .where(eq(users.id, user.id));

      await audit(user.id, "auth.login_failed", { attempts }, ctx.req.ip);
      throw genericError;
    }

    // Login exitoso: resetea contador de intentos fallidos
    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(users.id, user.id));

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const { token: refreshToken, tokenHash } = generateRefreshToken();

    await db.insert(refreshTokens).values({
      id: nanoid(),
      userId: user.id,
      tokenHash,
      userAgent: ctx.req.headers["user-agent"]?.slice(0, 300),
      ipAddress: ctx.req.ip,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    });

    setRefreshCookie(ctx.res, refreshToken);
    await audit(user.id, "auth.login_success", {}, ctx.req.ip);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }),

  // Rota el refresh token en cada uso (token rotation): si alguien roba un
  // refresh token usado, el siguiente intento de reuso lo detecta y revoca la sesión.
  refresh: publicProcedure.mutation(async ({ ctx }) => {
    const token = ctx.req.cookies?.refreshToken;
    if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });

    const tokenHash = hashRefreshToken(token);
    const stored = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
    });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      // Posible reuso de un token ya rotado/robado: por seguridad, revocamos
      // todas las sesiones activas de ese usuario si lo identificamos.
      if (stored) {
        await db
          .update(refreshTokens)
          .set({ revoked: true })
          .where(eq(refreshTokens.userId, stored.userId));
      }
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Sesión inválida" });
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, stored.userId) });
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    // Revoca el token usado y emite uno nuevo (rotación)
    await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.id, stored.id));

    const { token: newRefreshToken, tokenHash: newHash } = generateRefreshToken();
    await db.insert(refreshTokens).values({
      id: nanoid(),
      userId: user.id,
      tokenHash: newHash,
      userAgent: ctx.req.headers["user-agent"]?.slice(0, 300),
      ipAddress: ctx.req.ip,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    });

    setRefreshCookie(ctx.res, newRefreshToken);
    const accessToken = signAccessToken({ sub: user.id, role: user.role });

    return { accessToken };
  }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const token = ctx.req.cookies?.refreshToken;
    if (token) {
      const tokenHash = hashRefreshToken(token);
      await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.tokenHash, tokenHash));
    }
    ctx.res.clearCookie("refreshToken");
    return { success: true };
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.query.users.findFirst({ where: eq(users.id, ctx.user.id) });
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };
  }),
});
