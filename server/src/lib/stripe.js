import Stripe from "stripe";

let client = null;

// Le paiement en ligne n'est actif que si la clé secrète ET le secret de webhook sont
// configurés : sans webhook, un paiement réussi ne créditerait jamais le porte-monnaie.
export function isPaymentsEnabled() {
  return !!(client || process.env.STRIPE_SECRET_KEY) && !!process.env.STRIPE_WEBHOOK_SECRET;
}

export function getStripe() {
  if (client) return client;
  if (!process.env.STRIPE_SECRET_KEY) return null;
  client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

// Pour les tests : injecte un faux client Stripe (aucun appel réseau).
export function __setStripeForTests(fake) {
  client = fake;
}

export { Stripe };
