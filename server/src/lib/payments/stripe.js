import { stripeClientFor, Stripe } from "../stripe.js";

export default {
  id: "stripe",
  label: "Stripe",
  description: "Carte bancaire, Apple Pay, Google Pay",
  helpUrl: "https://dashboard.stripe.com/apikeys",
  needsWebhookSetup: true,
  webhookPath: "/api/payments/webhook",
  webhookEvents: [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
  ],
  fields: [
    { key: "secretKey", label: "Clé secrète (sk_test_… ou sk_live_…)", type: "secret" },
    { key: "webhookSecret", label: "Secret de signature du webhook (whsec_…)", type: "secret" },
  ],

  async createPayment({ paymentId, user, amountCents, urls, config }) {
    const session = await stripeClientFor(config.secretKey).checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountCents,
            product_data: { name: "Recharge du porte-monnaie Résidence Ops" },
          },
        },
      ],
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: { user_id: user.id, payment_id: paymentId },
      success_url: urls.success,
      cancel_url: urls.cancel,
    });
    return { ref: session.id, url: session.url };
  },

  async fetchStatus({ payment, config }) {
    const s = await stripeClientFor(config.secretKey).checkout.sessions.retrieve(payment.provider_ref);
    if (s.payment_status === "paid") return { state: "paid", amount_cents: s.amount_total, currency: s.currency };
    if (s.status === "expired") return { state: "expired" };
    return { state: "pending" };
  },

  async test(config) {
    await stripeClientFor(config.secretKey).balance.retrieve();
  },

  verifyWebhook(rawBody, signature, config) {
    return Stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
  },
};
