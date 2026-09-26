import { Router } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { db } from "../db/db.js";
import { requireAuth, requireRole, requireLease } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { getOrCreateCard } from "../lib/wallet.js";
import { PROVIDERS, loadConfig, enabledProviders, saveSettings, createCheckout, refreshPayment, settle } from "../lib/payments/core.js";
import { notifyUsers } from "./notifications.js";

const MIN_CENTS = 500;
const MAX_CENTS = Math.round(Number(process.env.STRIPE_MAX_TOPUP_EUR || 200)) * 100;
const PRESETS_CENTS = [1000, 2000, 5000].filter((c) => c <= MAX_CENTS);

const checkoutSchema = z.object({
  provider: z.enum(["stripe", "mollie", "paypal", "helloasso"]),
  amount_cents: z
    .number()
    .int()
    .min(MIN_CENTS, `Montant minimum : ${MIN_CENTS / 100} €.`)
    .max(MAX_CENTS, `Montant maximum : ${MAX_CENTS / 100} € par recharge.`),
});

const limiter = (limit, message) =>
  rateLimit({ windowMs: 15 * 60 * 1000, limit: process.env.VITEST ? 1000 : limit, standardHeaders: true, legacyHeaders: false, message: { error: message } });
const checkoutLimiter = limiter(10, "Trop de tentatives de paiement, réessayez dans quelques minutes.");
const callbackLimiter = limiter(120, "Trop de requêtes.");

const baseUrlFor = (req) => (process.env.APP_URL || process.env.ALLOWED_ORIGIN || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");

function notifyIfCredited({ payment, outcome }) {
  if (outcome !== "credited") return;
  notifyUsers([payment.user_id], {
    title: "Recharge effectuée",
    message: `${(payment.amount_cents / 100).toFixed(2)} € ont été ajoutés à votre carte.`,
    type: "info",
    link: "/ma-carte",
  });
}

async function refreshAndNotify(paymentId) {
  const r = await refreshPayment(paymentId);
  notifyIfCredited(r);
  return r;
}

// ---------------------------------------------------------------------------------------------
// Routes publiques appelées par les prestataires (pas de jeton de connexion).
// ---------------------------------------------------------------------------------------------
export const paymentsCallbacks = Router();

// Stripe : corps brut requis pour vérifier la signature (monté avant express.json() dans app.js).
export const stripeWebhook = [
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const { config } = loadConfig("stripe");
    if (!config.webhookSecret) return res.status(503).json({ error: "Webhook non configuré." });
    let event;
    try {
      event = PROVIDERS.stripe.verifyWebhook(req.body, req.headers["stripe-signature"], config);
    } catch {
      return res.status(400).json({ error: "Signature invalide." });
    }
    try {
      const session = event.data.object;
      const payment = db.prepare("SELECT id FROM payments WHERE provider = 'stripe' AND provider_ref = ?").get(session.id);
      if (payment) {
        if (
          event.type === "checkout.session.async_payment_succeeded" ||
          (event.type === "checkout.session.completed" && session.payment_status === "paid")
        ) {
          const outcome = settle(payment.id, { amount_cents: session.amount_total, currency: session.currency });
          if (outcome === "mismatch") console.error(`Paiement Stripe ${session.id} : montant encaissé différent du montant attendu.`);
          notifyIfCredited({ payment: db.prepare("SELECT * FROM payments WHERE id = ?").get(payment.id), outcome });
        } else if (event.type === "checkout.session.expired") {
          db.prepare("UPDATE payments SET status = 'expired' WHERE id = ? AND status = 'pending'").run(payment.id);
        } else if (event.type === "checkout.session.async_payment_failed") {
          db.prepare("UPDATE payments SET status = 'failed' WHERE id = ? AND status = 'pending'").run(payment.id);
        }
      }
    } catch (err) {
      console.error("Erreur de traitement du webhook Stripe :", err);
      return res.status(500).json({ error: "Erreur de traitement." }); // Stripe réessaiera
    }
    res.json({ received: true });
  },
];

// Mollie : notification sans signature (`id=tr_...`). Aucune confiance accordée au contenu : on relit
// le paiement chez Mollie avec notre clé. Toujours 200 pour ne rien révéler sur les identifiants.
paymentsCallbacks.post("/webhook/mollie", callbackLimiter, express.urlencoded({ extended: false }), async (req, res) => {
  const ref = String(req.body?.id || "");
  const payment = db.prepare("SELECT id FROM payments WHERE provider = 'mollie' AND provider_ref = ?").get(ref);
  if (payment) await refreshAndNotify(payment.id);
  res.json({ received: true });
});

// HelloAsso : format de notification non signé ; on retrouve NOTRE identifiant de paiement dans les
// métadonnées renvoyées, puis on vérifie l'état réel auprès de l'API HelloAsso.
paymentsCallbacks.post("/webhook/helloasso", callbackLimiter, express.json(), async (req, res) => {
  const body = req.body || {};
  const paymentId = body.metadata?.payment_id || body.data?.metadata?.payment_id;
  if (typeof paymentId === "string") await refreshAndNotify(paymentId);
  res.json({ received: true });
});

// Retour navigateur depuis PayPal / HelloAsso : on finalise côté serveur (capture PayPal, vérification
// HelloAsso) puis on renvoie l'utilisateur vers sa carte. Les paramètres de l'URL ne sont jamais crus.
paymentsCallbacks.get("/return/:provider", callbackLimiter, async (req, res) => {
  const paymentId = String(req.query.payment_id || "");
  const row = db.prepare("SELECT id, provider FROM payments WHERE id = ?").get(paymentId);
  if (!row || row.provider !== req.params.provider) return res.redirect("/ma-carte?paiement=annule");
  const { payment } = await refreshAndNotify(paymentId);
  res.redirect(payment?.status === "paid" ? `/ma-carte?paiement=succes&payment_id=${paymentId}` : `/ma-carte?paiement=${payment?.status === "pending" ? "succes" : "annule"}&payment_id=${paymentId}`);
});

// ---------------------------------------------------------------------------------------------
// Routes authentifiées.
// ---------------------------------------------------------------------------------------------
export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

paymentsRouter.get("/config", (req, res) => {
  const providers = enabledProviders().map(({ id, label, description }) => ({ id, label, description }));
  res.json({ enabled: providers.length > 0, providers, min_cents: MIN_CENTS, max_cents: MAX_CENTS, presets_cents: PRESETS_CENTS });
});

paymentsRouter.post("/checkout", requireRole("resident"), requireLease, checkoutLimiter, validate(checkoutSchema), async (req, res) => {
  if (enabledProviders().length === 0) {
    return res.status(503).json({
      error: "Le paiement en ligne n'est pas encore activé. Vous pouvez recharger votre carte à l'accueil de la résidence.",
      code: "PAYMENTS_DISABLED",
    });
  }
  const user = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(req.userId);
  if (getOrCreateCard(req.userId).status === "blocked") return res.status(403).json({ error: "Votre carte est bloquée." });

  try {
    const url = await createCheckout({ providerId: req.body.provider, user, amountCents: req.body.amount_cents, baseUrl: baseUrlFor(req) });
    res.status(201).json({ url });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message, code: err.code });
    console.error(`Erreur ${req.body.provider} (création du paiement) :`, err.message);
    res.status(502).json({ error: "Le service de paiement est momentanément indisponible. Réessayez plus tard." });
  }
});

// Suivi côté résident : si le webhook n'est pas encore arrivé, on interroge directement le prestataire.
paymentsRouter.get("/status", async (req, res) => {
  const id = String(req.query.payment_id || "");
  const own = db.prepare("SELECT id FROM payments WHERE id = ? AND user_id = ?").get(id, req.userId);
  if (!own) return res.status(404).json({ error: "Paiement introuvable." });
  const { payment } = await refreshAndNotify(id);
  res.json({ status: payment.status, amount_cents: payment.amount_cents });
});

// ---------------------------------------------------------------------------------------------
// Réglages administrateur : quels moyens de paiement proposer, avec quelles clés.
// ---------------------------------------------------------------------------------------------
paymentsRouter.get("/settings", requireRole("manager"), (req, res) => {
  const base = baseUrlFor(req);
  res.json({
    providers: Object.values(PROVIDERS).map((p) => {
      const { config, configured, enabled, hasRow } = loadConfig(p.id);
      return {
        id: p.id,
        label: p.label,
        description: p.description,
        helpUrl: p.helpUrl,
        enabled,
        configured,
        webhookUrl: p.webhookPath ? `${base}${p.webhookPath}` : null,
        webhookEvents: p.webhookEvents || null,
        fields: p.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          options: f.options || null,
          // Les secrets ne sont JAMAIS renvoyés, seulement leur présence.
          value: f.type === "secret" ? null : config[f.key] || "",
          isSet: !!config[f.key],
        })),
        source: hasRow ? "app" : configured ? "env" : null,
      };
    }),
  });
});

const settingsSchema = z.object({
  enabled: z.boolean(),
  config: z.record(z.string().max(500)).default({}),
});

// Garde-fou : en mode démonstration, le compte gestionnaire a un mot de passe PUBLIC. Y laisser
// configurer des clés de paiement permettrait à n'importe qui de rediriger l'argent des résidents
// vers son propre compte. La configuration n'est donc possible qu'en mode production (SEED_MODE).
function blockInDemoMode(req, res, next) {
  const hosted = process.env.RENDER || process.env.NODE_ENV === "production";
  if (hosted && process.env.SEED_MODE !== "production") {
    return res.status(403).json({
      error:
        "Pour votre sécurité, la configuration des paiements est bloquée tant que l'application est en mode démonstration (comptes de démo aux mots de passe publics). Voir docs/mise-en-production.md.",
      code: "DEMO_MODE",
    });
  }
  next();
}

paymentsRouter.put("/settings/:provider", requireRole("manager"), blockInDemoMode, validate(settingsSchema), (req, res) => {
  if (!PROVIDERS[req.params.provider]) return res.status(404).json({ error: "Moyen de paiement inconnu." });
  try {
    saveSettings(req.params.provider, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

paymentsRouter.post("/settings/:provider/test", requireRole("manager"), async (req, res) => {
  const provider = PROVIDERS[req.params.provider];
  if (!provider) return res.status(404).json({ error: "Moyen de paiement inconnu." });
  const { config, configured } = loadConfig(provider.id);
  if (!configured) return res.status(400).json({ error: "Renseignez et enregistrez d'abord les identifiants." });
  try {
    await provider.test(config);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: `Connexion refusée par ${provider.label} : ${err.message}` });
  }
});

// Rapprochement manuel : relit chez chaque prestataire les paiements restés « en attente ».
paymentsRouter.post("/reconcile", requireRole("manager"), async (req, res) => {
  const pending = db.prepare("SELECT id FROM payments WHERE status = 'pending' AND created_at > ?").all(new Date(Date.now() - 3 * 86400000).toISOString());
  let credited = 0;
  for (const { id } of pending) {
    const r = await refreshAndNotify(id);
    if (r.outcome === "credited") credited++;
  }
  res.json({ checked: pending.length, credited });
});
