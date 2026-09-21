import { httpJson } from "./http.js";

const hosts = (config) =>
  config.mode === "production"
    ? { api: "https://api.helloasso.com" }
    : { api: "https://api.helloasso-sandbox.com" };

async function token(config) {
  const t = await httpJson(`${hosts(config).api}/oauth2/token`, {
    method: "POST",
    form: { client_id: config.clientId, client_secret: config.clientSecret, grant_type: "client_credentials" },
  });
  return { Authorization: `Bearer ${t.access_token}` };
}

export default {
  id: "helloasso",
  label: "HelloAsso",
  description: "Pour les associations (loi 1901) — paiement par carte bancaire",
  helpUrl: "https://www.helloasso.com/associations",
  needsWebhookSetup: false,
  webhookPath: "/api/payments/webhook/helloasso",
  defaults: { mode: "sandbox" },
  fields: [
    { key: "clientId", label: "Client ID (clé API HelloAsso)", type: "text" },
    { key: "clientSecret", label: "Client Secret", type: "secret" },
    { key: "organizationSlug", label: "Identifiant de l'association (slug HelloAsso)", type: "text" },
    { key: "mode", label: "Environnement", type: "select", options: [["sandbox", "Test (sandbox)"], ["production", "Production"]], required: false },
  ],

  async createPayment({ paymentId, user, amountCents, urls, config }) {
    const [firstName, ...rest] = String(user.name || "").split(" ");
    const intent = await httpJson(
      `${hosts(config).api}/v5/organizations/${encodeURIComponent(config.organizationSlug)}/checkout-intents`,
      {
        method: "POST",
        headers: await token(config),
        json: {
          totalAmount: amountCents,
          initialAmount: amountCents,
          itemName: "Recharge du porte-monnaie Résidence Ops",
          backUrl: urls.cancel,
          errorUrl: urls.cancel,
          returnUrl: urls.returnHandler,
          containsDonation: false,
          payer: { firstName: firstName || undefined, lastName: rest.join(" ") || undefined, email: user.email },
          metadata: { payment_id: paymentId },
        },
      }
    );
    return { ref: String(intent.id), url: intent.redirectUrl };
  },

  // La documentation HelloAsso impose de réconcilier le paiement via l'API plutôt que de se fier
  // aux paramètres de l'URL de retour, qui peuvent être falsifiés. `order` n'est renvoyé que si le
  // paiement est autorisé.
  async fetchStatus({ payment, config }) {
    const intent = await httpJson(
      `${hosts(config).api}/v5/organizations/${encodeURIComponent(config.organizationSlug)}/checkout-intents/${encodeURIComponent(payment.provider_ref)}`,
      { headers: await token(config) }
    );
    const authorized = (intent.order?.payments || []).filter((p) => p.state === "Authorized");
    if (authorized.length > 0) {
      return { state: "paid", amount_cents: authorized.reduce((sum, p) => sum + p.amount, 0), currency: "EUR" };
    }
    return { state: "pending" };
  },

  async test(config) {
    await token(config);
  },
};
