import Stripe from "stripe";

let injected = null;

export function stripeClientFor(secretKey) {
  return injected || new Stripe(secretKey);
}

// Pour les tests : injecte un faux client Stripe (aucun appel réseau).
export function __setStripeForTests(fake) {
  injected = fake;
}

export { Stripe };
