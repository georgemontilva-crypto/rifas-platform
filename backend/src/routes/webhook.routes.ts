import { Router } from "express";
import express from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { payments, tickets } from "../db/schema.js";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export const webhookRouter = Router();

// IMPORTANTE: este endpoint necesita el body crudo (sin parsear como JSON)
// para poder validar la firma de Stripe. Por eso se monta ANTES de
// express.json() en index.ts, con su propio express.raw().
webhookRouter.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!stripe || !signature || !webhookSecret) {
      return res.status(400).send("Stripe no está configurado o falta la firma");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (err) {
      // Firma inválida: probablemente no viene de Stripe. Se rechaza sin procesar.
      return res.status(400).send(`Firma inválida: ${(err as Error).message}`);
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentId = intent.metadata?.paymentId;
      if (paymentId) {
        // Idempotente: si ya estaba aprobado, no reprocesa (Stripe puede reenviar el mismo evento)
        const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
        if (payment && payment.status !== "approved") {
          await db
            .update(payments)
            .set({ status: "approved", providerPaymentId: intent.id, approvedAt: new Date() })
            .where(eq(payments.id, paymentId));
          await db.update(tickets).set({ status: "sold" }).where(eq(tickets.purchaseId, paymentId));
        }
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentId = intent.metadata?.paymentId;
      if (paymentId) {
        await db.update(payments).set({ status: "rejected" }).where(eq(payments.id, paymentId));
      }
    }

    res.json({ received: true });
  }
);
