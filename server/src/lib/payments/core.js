import { nanoid } from "nanoid";
import { db } from "../../db/db.js";
import { encryptText, decryptText } from "../secretBox.js";
import { getOrCreateCard, applyWalletTransaction } from "../wallet.js";
import stripe from "./stripe.js";
import mollie from "./mollie.js";
import paypal from "./paypal.js";
import helloasso from "./helloasso.js";

export const PROVIDERS = { stripe, mollie, paypal, helloasso };

// Rétrocompatibilité : la configuration Stripe par variables d'environnement continue de fonctionner.
function envConfig(id) {
  if (id !== "stripe") return {};
  return { secretKey: process.env.STRIPE_SECRET_KEY, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET };
}

export function loadConfig(id) {
  const provider = PROVIDERS[id];
  const row = db.prepare("SELECT * FROM payment_settings WHERE provider = ?").get(id);
  let stored = {};
  if (row?.config) {
    try {
      stored = JSON.parse(decryptText(row.config));
    } catch {
      stored = {}; // secrets illisibles (clé de chiffrement changée) : à ressaisir
    }
  }
  const env = Object.fromEntries(Object.entries(envConfig(id)).filter(([, v]) => v));
  const config = { ...(provider.defaults || {}), ...env, ...stored };
  const configured = provider.fields.filter((f) => f.required !== false).every((f) => !!config[f.key]);
  // Sans ligne en base, un fournisseur configuré uniquement par variables d'environnement est actif.
  const enabled = configured && (row ? !!row.enabled : Object.keys(env).length > 0);
  return { config, configured, enabled, hasRow: !!row };
}

export function enabledProviders() {
  return Object.values(PROVIDERS).filter((p) => loadConfig(p.id).enabled);
}

export function saveSettings(id, { enabled, config: incoming = {} }) {
  const provider = PROVIDERS[id];
  const { config: current } = loadConfig(id);
  const next = {};
  for (const f of provider.fields) {
    const given = incoming[f.key];
    // Un champ secret laissé vide conserve la valeur enregistrée (l'API ne la renvoie jamais).
    const value = typeof given === "string" && given.trim() !== "" ? given.trim() : current[f.key];
    if (value !== undefined && value !== "") next[f.key] = value;
  }
  const configured = provider.fields.filter((f) => f.required !== false).every((f) => !!next[f.key]);
  if (enabled && !configured) throw Object.assign(new Error("Renseignez tous les champs avant d'activer ce moyen de paiement."), { status: 400 });

  db.prepare(
    `INSERT INTO payment_settings (provider, enabled, config, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET enabled = excluded.enabled, config = excluded.config, updated_at = excluded.updated_at`
  ).run(id, enabled ? 1 : 0, encryptText(JSON.stringify(next)), new Date().toISOString());
}

export async function createCheckout({ providerId, user, amountCents, baseUrl }) {
  const provider = PROVIDERS[providerId];
  const { config, enabled } = provider ? loadConfig(providerId) : {};
  if (!provider || !enabled) {
    throw Object.assign(new Error("Ce moyen de paiement n'est pas disponible."), { status: 400, code: "PROVIDER_DISABLED" });
  }

  const paymentId = nanoid();
  const urls = {
    success: `${baseUrl}/ma-carte?paiement=succes&payment_id=${paymentId}`,
    cancel: `${baseUrl}/ma-carte?paiement=annule`,
    returnHandler: `${baseUrl}/api/payments/return/${providerId}?payment_id=${paymentId}`,
    webhook: `${baseUrl}/api/payments/webhook/${providerId === "stripe" ? "" : providerId}`.replace(/\/$/, ""),
  };
  const { ref, url } = await provider.createPayment({ paymentId, user, amountCents, urls, config });

  db.prepare(
    "INSERT INTO payments (id, user_id, provider, provider_ref, amount_cents, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)"
  ).run(paymentId, user.id, providerId, ref, amountCents, new Date().toISOString());
  return url;
}

// Point unique de crédit, commun à tous les prestataires : idempotent (un paiement ne crédite jamais
// deux fois) et le montant crédité est celui enregistré à la création, qui doit correspondre à ce que
// le prestataire a réellement encaissé.
export const settle = db.transaction((paymentId, result) => {
  const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId);
  if (!payment) return "unknown";
  if (payment.status === "paid") return "already";
  if (result.amount_cents !== payment.amount_cents || String(result.currency).toLowerCase() !== "eur") return "mismatch";

  const card = getOrCreateCard(payment.user_id);
  applyWalletTransaction(card.id, payment.amount_cents, "credit", `Recharge en ligne (${PROVIDERS[payment.provider].label})`, null);
  db.prepare("UPDATE payments SET status = 'paid', paid_at = ? WHERE id = ?").run(new Date().toISOString(), payment.id);
  return "credited";
});

// Relit l'état réel du paiement chez le prestataire et applique le résultat. Sert aux retours de
// paiement, aux webhooks, au suivi côté résident et au rapprochement manuel : un webhook manqué ne
// laisse donc jamais un paiement encaissé sans crédit.
export async function refreshPayment(paymentId) {
  const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId);
  if (!payment || payment.status !== "pending") return { payment, outcome: null };
  const provider = PROVIDERS[payment.provider];
  const { config } = loadConfig(payment.provider);
  let result;
  try {
    result = await provider.fetchStatus({ payment, config });
  } catch (err) {
    console.error(`Paiement ${payment.provider} ${payment.id} : vérification impossible (${err.message}).`);
    return { payment, outcome: null };
  }
  let outcome = null;
  if (result.state === "paid") outcome = settle(payment.id, result);
  else if (result.state === "expired" || result.state === "failed") {
    db.prepare("UPDATE payments SET status = ? WHERE id = ? AND status = 'pending'").run(result.state, payment.id);
  }
  if (outcome === "mismatch") console.error(`Paiement ${payment.provider} ${payment.id} : montant encaissé différent du montant attendu, crédit refusé.`);
  return { payment: db.prepare("SELECT * FROM payments WHERE id = ?").get(payment.id), outcome };
}
