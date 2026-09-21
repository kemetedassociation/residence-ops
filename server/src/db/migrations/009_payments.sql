-- Paiements en ligne (Stripe Checkout) pour recharger le porte-monnaie. Aucune donnée de carte
-- bancaire ne transite ni n'est stockée ici : le paiement se fait sur la page hébergée par Stripe.
-- Le crédit n'est appliqué QUE par le webhook signé de Stripe, jamais sur simple retour du client.
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_session_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'failed')),
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX idx_payments_user ON payments(user_id);
