import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const ACCESS_SECRET = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("JWT_SECRET y JWT_REFRESH_SECRET son obligatorios");
}
if (ACCESS_SECRET.length < 32 || REFRESH_SECRET.length < 32) {
  throw new Error("Los secretos JWT deben tener al menos 32 caracteres");
}

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface AccessTokenPayload {
  sub: string; // userId
  role: "user" | "admin" | "superadmin";
}

// Access token: vida corta. Nunca se persiste, solo viaja en memoria/Authorization header.
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
}

// Refresh token: vida larga, viaja en cookie httpOnly + se rota en cada uso.
// Guardamos solo el hash en DB para que una fuga de la tabla no sirva para suplantar sesiones.
export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(64).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
