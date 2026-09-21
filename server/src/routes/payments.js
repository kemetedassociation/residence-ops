import { Router } from "express";
import rateLimit from "express-rate-limit";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db/db.js";
import { requireAuth, requireRole, requireLease } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { getStripe, isPaymentsEnabled, Stripe } from "../lib/stripe.js";
import { getOrCreateCard, applyWalletTransaction } from "../lib/wallet.js";
import { notifyUsers } from "./notifications.js";

const MIN_CENTS = 500;
const MAX_CENTS = Math.round(Number(process.env.STRIPE_MAX_TOPUP_EUR || 200)) * 100;
const PRESETS_CENTS = [1000, 2000, 5000].filter((c) => c <= MAX_CENTS);

const checkoutSchema = z.object({
  amount_cents: z
    .number()
    .int()
    .min(MIN_CENTS, `Montant minimum : ${MIN_CENTS / 100} €.`)
    .max(MAX_CENTS, `Montant maximum : ${MAX_CENTS / 100} € par recharge.`),
});

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.VITEST ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives de paiement, réessayez dans quelques minutes." },
});

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

paymentsRouter.get("/config", (req, res) => {
  res.json({ enabled: isPaymentsEnabled(), min_cents: MIN_CENTS, max_cents: MAX_CENTS, presets_cents: PRESETS_CENTS });
});

paymentsRouter.post("/checkout", requireRole("resident"), requireLease, checkoutLimiter, validate(checkoutSchema), async (req, res) => {
  const stripe = getStripe();
  if (!isPaymentsEnabled() || !stripe) {
    return res.status(503).json({
      error: "Le paiement en ligne n'est pas encore activé. Vous pouvez recharger votre carte à l'accueil de la résidence.",
      code: "PAYMENTS_DISABLED",
    });
  }

  const user = db.prepare("SELECT id, email FROM users WHERE id = ?").get(req.userId);
  const card = getOrCreateCard(req.userId);
  if (card.status === "blocked") return res.status(403).json({ error: "Votre carte est bloquée." });

  const baseUrl = (process.env.APP_URL || process.env.ALLOWED_ORIGIN || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: req.body.amount_cents,
            product_data: { name: "Recharge du porte-monnaie Résidence Ops" },
          },
        },
      ],
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: { user_id: user.id, card_id: card.id },
      success_url: `${baseUrl}/ma-carte?paiement=succes&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/ma-carte?paiement=annule`,
    });

    db.prepare(
      "INSERT INTO payments (id, user_id, stripe_session_id, amount_cents, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)"
    ).run(nanoid(), user.id, session.id, req.body.amount_cents, new Date().toISOString());

    res.status(201).json({ url: session.url });
  } catch (err) {
    console.error("Erreur Stripe (création de session) :", err.message);
    res.status(502).json({ error: "Le service de paiement est momentanément indisponible. Réessayez plus tard." });
  }
});

// Permet à la page de retour de savoir si le crédit a bien été appliqué (le webhook peut arriver
// quelques secondes après la redirection du client). Limité aux paiements de l'utilisateur.
paymentsRouter.get("/status", (req, res) => {
  const p = db.prepare("SELECT status, amount_cents FROM payments WHERE stripe_session_id = ? AND user_id = ?").get(String(req.query.session_id || ""), req.userId);
  if (!p) return res.status(404).json({ error: "Paiement introuvable." });
  res.json(p);
});

const fulfill = db.transaction((session) => {
  const payment = db.prepare("SELECT * FROM payments WHERE stripe_session_id = ?").get(session.id);
  if (!payment) return "unknown";
  // Idempotence : Stripe peut livrer plusieurs fois le même événement.
  if (payment.status === "paid") return "already";
  // Le montant crédité est celui que NOUS avons enregistré à la création, et il doit correspondre
  // à ce que Stripe a réellement encaissé.
  if (session.amount_total !== payment.amount_cents || session.currency !== "eur") return "mismatch";

  const card = getOrCreateCard(payment.user_id);
  applyWalletTransaction(card.id, payment.amount_cents, "credit", "Recharge par carte bancaire (Stripe)", null);
  db.prepare("UPDATE payments SET status = 'paid', paid_at = ? WHERE id = ?").run(new Date().toISOString(), payment.id);
  return "credited";
});

// Monté AVANT express.json() dans app.js : la vérification de signature exige le corps brut.
export function stripeWebhook(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: "Webhook non configuré." });

  let event;
  try {
    event = Stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], secret);
  } catch {
    return res.status(400).json({ error: "Signature invalide." });
  }

  const session = event.data.object;
  try {
    if (
      event.type === "checkout.session.async_payment_succeeded" ||
      (event.type === "checkout.session.completed" && session.payment_status === "paid")
    ) {
      const result = fulfill(session);
      if (result === "credited") {
        const payment = db.prepare("SELECT user_id, amount_cents FROM payments WHERE stripe_session_id = ?").get(session.id);
        notifyUsers([payment.user_id], {
          title: "Recharge effectuée",
          message: `${(payment.amount_cents / 100).toFixed(2)} € ont été ajoutés à votre carte.`,
          type: "info",
        });
      } else if (result === "mismatch") {
        console.error(`Paiement Stripe ${session.id} : montant encaissé différent du montant attendu, crédit refusé.`);
      }
    } else if (event.type === "checkout.session.expired") {
      db.prepare("UPDATE payments SET status = 'expired' WHERE stripe_session_id = ? AND status = 'pending'").run(session.id);
    } else if (event.type === "checkout.session.async_payment_failed") {
      db.prepare("UPDATE payments SET status = 'failed' WHERE stripe_session_id = ? AND status = 'pending'").run(session.id);
    }
  } catch (err) {
    console.error("Erreur de traitement du webhook Stripe :", err);
    return res.status(500).json({ error: "Erreur de traitement." }); // Stripe réessaiera
  }
  res.json({ received: true });
}
