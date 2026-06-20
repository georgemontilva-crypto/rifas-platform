# 🎟️ Plataforma de Rifas y Sorteos

Plataforma full-stack para vender boletos de rifas online, con sorteos
**verificables públicamente** (nadie, ni el operador, puede manipular el resultado).

## Stack

- **Backend**: Node.js, Express, tRPC, Drizzle ORM, MySQL (pensado para Railway)
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, Zustand, TanStack Query
- **Pagos**: Stripe, MercadoPago, PayPal, transferencia manual con aprobación admin

## ¿Por qué es segura?

| Riesgo | Mitigación |
|---|---|
| Manipulación del sorteo | Esquema **commit-reveal**: se publica `sha256(seed)` antes de vender boletos; el seed se revela al cerrar y cualquiera puede recalcular el ganador (`/verificar/:raffleId`) |
| Doble venta del mismo número | Reserva con `UPDATE ... WHERE status='available'` dentro de una transacción; reservas expiran solas vía cron |
| Fuerza bruta en login | Rate limiting + bloqueo temporal de cuenta tras 5 intentos fallidos |
| Enumeración de usuarios | Mensajes de error genéricos en login/registro |
| Robo de sesión | Access token de 15 min en memoria (nunca en localStorage); refresh token rotado en cada uso, en cookie `httpOnly` + `SameSite=strict` |
| Reuso de refresh token robado | Si un token ya rotado se reintenta usar, se revocan todas las sesiones del usuario |
| Cobros duplicados | `idempotencyKey` único por orden de pago; webhooks de Stripe verifican firma y son idempotentes |
| XSS / inyección de cabeceras | Helmet con CSP, `express.json` con límite de tamaño, validación estricta con Zod en cada input |
| SQL injection | Drizzle ORM con queries parametrizadas (nunca SQL concatenado) |
| Trazabilidad | Tabla `audit_logs` registra acciones sensibles (aprobaciones de pago, sorteos, logins fallidos) |

## Estructura

```
backend/   → API (tRPC + Drizzle + MySQL)
frontend/  → SPA (React + Vite)
```

## Variables de entorno

Copia `backend/.env.example` → `backend/.env` y `frontend/.env.example` → `frontend/.env`,
y completa los valores. **Genera los secretos JWT con:**

```bash
openssl rand -hex 32
```

## Desarrollo local

```bash
# Backend
cd backend
npm install
npm run db:generate   # genera las migraciones a partir del schema
npm run db:migrate     # aplica las migraciones a tu MySQL (Railway)
npm run dev

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

## Despliegue en Railway

1. Crea un servicio MySQL en Railway y copia la `DATABASE_URL`.
2. Crea un servicio para `backend/` (Railway detecta Node automáticamente) y configura
   todas las variables de `.env.example` en el panel de Railway.
3. Corre las migraciones una vez desplegado: `npm run db:migrate` (puedes hacerlo desde
   el shell de Railway o localmente apuntando a la `DATABASE_URL` pública).
4. Crea un servicio para `frontend/` o despliégalo en Vercel/Netlify, apuntando
   `VITE_API_URL` a la URL pública del backend.
5. Configura el webhook de Stripe apuntando a `https://tu-backend.up.railway.app/api/webhooks/stripe`.

## Flujo del sorteo verificable

1. Al crear una rifa, el servidor genera un `seed` secreto y publica solo su hash (`commitHash`).
2. Mientras la rifa está activa, **nadie puede ver el seed**, solo su huella criptográfica.
3. Al cerrar la rifa (`draw.closeAndDraw`), se revela el seed y se calcula el ganador con
   `sha256(seed + raffleId) % totalTickets`.
4. Cualquier persona puede verificar el resultado en `/verificar/:raffleId` sin necesidad
   de confiar en el operador.

## Pendiente / próximos pasos sugeridos

- [ ] Integrar Cloudflare R2 para subir imágenes de rifas y comprobantes de transferencia
- [ ] Integrar Resend para notificaciones por email (ganador, pago aprobado/rechazado)
- [ ] Completar flujo real de Stripe/MercadoPago en el frontend (Payment Element / Checkout Pro)
- [ ] Panel admin: creación de rifas desde la UI (hoy se crea solo vía API)
- [ ] 2FA opcional para cuentas admin (ya existe el campo `twoFactorSecret` en el schema)
