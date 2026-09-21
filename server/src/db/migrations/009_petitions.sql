-- Signatures de pétition (ex. pétition des résidents des Oiseaux). Volontairement séparées du
-- système d'utilisateurs/rôles de l'app : leur lecture n'est PAS ouverte aux comptes
-- gestionnaires, seulement à qui détient PETITION_ADMIN_TOKEN.
CREATE TABLE petition_signatures (
  id TEXT PRIMARY KEY,
  petition TEXT NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  logement TEXT NOT NULL,
  email TEXT,
  identity_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (petition, identity_key)
);
