-- Plusieurs prestataires de paiement au choix de l'administrateur (Stripe, Mollie, PayPal, HelloAsso).
ALTER TABLE payments RENAME COLUMN stripe_session_id TO provider_ref;
ALTER TABLE payments ADD COLUMN provider TEXT NOT NULL DEFAULT 'stripe';

-- Réglages saisis par l'administrateur dans l'app : `config` est un JSON CHIFFRÉ (clés API, secrets),
-- jamais renvoyé en clair par l'API.
CREATE TABLE payment_settings (
  provider TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  config TEXT,
  updated_at TEXT NOT NULL
);
