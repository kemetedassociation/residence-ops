-- Suivi minimal des erreurs côté client (pas de service tiers type Sentry configuré) :
-- permet à la gestion de voir si l'app plante réellement en production, sans dépendre
-- d'un utilisateur qui prend une capture d'écran.
CREATE TABLE IF NOT EXISTS client_errors (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
