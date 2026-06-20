import crypto from "crypto";

/**
 * SORTEO VERIFICABLE (commit–reveal)
 * ------------------------------------------------------------------
 * Problema que resuelve: en una rifa online, el usuario no puede saber
 * si el número ganador fue elegido de verdad al azar o "ajustado" por
 * el operador después de ver qué números se vendieron más.
 *
 * Solución:
 * 1) ANTES de abrir la venta, el servidor genera un `seed` secreto y
 *    publica solo su hash SHA-256 (`commitHash`). Esto es un compromiso
 *    público e inmutable: nadie -ni el propio admin- puede cambiar el
 *    seed después sin que el hash publicado deje de coincidir.
 * 2) Al cerrar la rifa (todos los boletos vendidos o fecha de sorteo),
 *    el servidor revela el `seed`.
 * 3) Cualquier persona puede recalcular el número ganador con:
 *      sha256(seed + ":" + raffleId) % totalTickets
 *    y comparar el hash publicado al inicio contra sha256(seed) revelado.
 *
 * Esto convierte el sorteo en algo auditable por terceros sin depender
 * de un servicio externo (Chainlink VRF, etc.), aunque se puede migrar
 * a VRF más adelante si se requiere verificabilidad on-chain.
 */

export function generateCommit(): { seed: string; commitHash: string } {
  const seed = crypto.randomBytes(32).toString("hex");
  const commitHash = sha256(seed);
  return { seed, commitHash };
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function verifyCommit(seed: string, commitHash: string): boolean {
  return sha256(seed) === commitHash;
}

/**
 * Calcula el número ganador a partir del seed revelado.
 * Determinístico: cualquiera con el seed y el raffleId obtiene el mismo resultado.
 */
export function computeWinningNumber(
  seed: string,
  raffleId: string,
  totalTickets: number
): number {
  const hash = sha256(`${seed}:${raffleId}`);
  // Usamos los primeros 8 bytes del hash como entero grande para reducir sesgo modular
  const hashInt = BigInt(`0x${hash.slice(0, 16)}`);
  return Number(hashInt % BigInt(totalTickets));
}
