import { httpJson, euros } from "./http.js";

const API = "https://api.mollie.com/v2";
const auth = (config) => ({ Authorization: `Bearer ${config.apiKey}` });

export default {
  id: "mollie",
  label: "Mollie",
  description: "Carte bancaire, Bancontact, iDEAL, Apple Pay…",
  helpUrl: "https://my.mollie.com/dashboard/developers/api-keys",
  needsWebhookSetup: false,
  fields: [{ key: "apiKey", label: "Clé API (test_… ou live_…)", type: "secret" }],

  async createPayment({ paymentId, amountCents, urls, config }) {
    const p = await httpJson(`${API}/payments`, {
      method: "POST",
      headers: auth(config),
      json: {
        amount: { currency: "EUR", value: euros(amountCents) },
        description: "Recharge du porte-monnaie Résidence Ops",
        redirectUrl: urls.success,
        // Mollie appelle cette adresse à chaque changement d'état, sans signature : le serveur
        // relit donc lui-même le paiement chez Mollie (avec sa clé) avant de créditer quoi que ce soit.
        webhookUrl: urls.webhook,
        locale: "fr_FR",
        metadata: { payment_id: paymentId },
      },
    });
    return { ref: p.id, url: p._links.checkout.href };
  },

  async fetchStatus({ payment, config }) {
    const p = await httpJson(`${API}/payments/${encodeURIComponent(payment.provider_ref)}`, { headers: auth(config) });
    if (p.status === "paid") {
      return { state: "paid", amount_cents: Math.round(Number(p.amount.value) * 100), currency: p.amount.currency };
    }
    if (p.status === "expired") return { state: "expired" };
    if (p.status === "failed" || p.status === "canceled") return { state: "failed" };
    return { state: "pending" };
  },

  async test(config) {
    await httpJson(`${API}/methods`, { headers: auth(config) });
  },
};
