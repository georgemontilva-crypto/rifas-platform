import type { Request, Response } from "express";
import { verifyAccessToken } from "./utils/auth";

export interface AuthUser {
  id: string;
  role: "user" | "admin" | "superadmin";
}

export interface Context {
  req: Request;
  res: Response;
  user: AuthUser | null;
}

export function createContext({ req, res }: { req: Request; res: Response }): Context {
  let user: AuthUser | null = null;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    try {
      const payload = verifyAccessToken(token);
      user = { id: payload.sub, role: payload.role };
    } catch {
      // Token inválido o expirado: se trata como no-autenticado.
      // El cliente debe usar /api/auth/refresh para renovar.
      user = null;
    }
  }

  return { req, res, user };
}
