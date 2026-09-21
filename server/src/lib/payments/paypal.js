import { httpJson, euros } from "./http.js";

const base = (config) => (config.mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

async function token(config) {
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const t = await httpJson(`${base(config)}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
    form: { grant_type: "client_credentials" },
  });
  return { Authorization: `Bearer ${t.access_token}` };
}

export default {
  id: "paypal",
  label: "PayPal",
  description: "Compte PayPal ou carte bancaire via PayPal",
  helpUrl: "https://developer.paypal.com/dashboard/applications",
  needsWebhookSetup: false,
  defaults: { mode: "sandbox" },
  fields: [
    { key: "clientId", label: "Client ID", type: "text" },
    { key: "clientSecret", label: "Secret", type: "secret" },
    { key: "mode", label: "Environnement", type: "select", options: [["sandbox", "Test (sandbox)"], ["live", "Production"]], required: false },
  ],

  async createPayment({ paymentId, amountCents, urls, config }) {
    const order = await httpJson(`${base(config)}/v2/checkout/orders`, {
      method: "POST",
      headers: { ...(await token(config)), "PayPal-Request-Id": `create-${paymentId}` },
      json: {
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: paymentId,
            description: "Recharge du porte-monnaie Résidence Ops",
            amount: { currency_code: "EUR", value: euros(amountCents) },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              user_action: "PAY_NOW",
              shipping_preference: "NO_SHIPPING",
              locale: "fr-FR",
              return_url: urls.returnHandler,
              cancel_url: urls.cancel,
            },
          },
        },
      },
    });
    const link = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve");
    if (!link) throw new Error("Réponse PayPal inattendue.");
    return { ref: order.id, url: link.href };
  },

  // PayPal ne débite qu'au moment de la CAPTURE, côté serveur : tant qu'elle n'a pas eu lieu, le client
  // n'est pas prélevé. Si l'utilisateur ferme la page après approbation, rien n'est débité.
  async fetchStatus({ payment, config }) {
    const headers = await token(config);
    let order = await httpJson(`${base(config)}/v2/checkout/orders/${encodeURIComponent(payment.provider_ref)}`, { headers });
    if (order.status === "APPROVED") {
      order = await httpJson(`${base(config)}/v2/checkout/orders/${encodeURIComponent(payment.provider_ref)}/capture`, {
        method: "POST",
        headers: { ...headers, "PayPal-Request-Id": `capture-${payment.id}` },
        json: {},
      });
    }
    if (order.status === "COMPLETED") {
      const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
      if (capture?.status === "COMPLETED") {
        return {
          state: "paid",
          amount_cents: Math.round(Number(capture.amount.value) * 100),
          currency: capture.amount.currency_code,
        };
      }
      return { state: "pending" };
    }
    if (order.status === "VOIDED") return { state: "failed" };
    return { state: "pending" };
  },

  async test(config) {
    await token(config);
  },
};
