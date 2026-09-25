-- Accompagnement psychologique. Les professionnels n'ont PAS de compte dans la table users : ils ont
-- un accès séparé (mot de passe qu'ils choisissent eux-mêmes en activant leur invitation) pour que la
-- gestion de la résidence ne puisse jamais lire leur agenda ni savoir qui consulte (données de santé).
CREATE TABLE care_professionals (
  id TEXT PRIMARY KEY,
  residence_id TEXT REFERENCES residences(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  specialties TEXT NOT NULL DEFAULT '[]',
  languages TEXT NOT NULL DEFAULT '[]',
  bio TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'les_deux' CHECK (mode IN ('presentiel', 'visio', 'les_deux')),
  free INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  invite_hash TEXT,
  invite_expires_at TEXT,
  access_hash TEXT,
  feed_token_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE care_slots (
  id TEXT PRIMARY KEY,
  professional_id TEXT NOT NULL REFERENCES care_professionals(id) ON DELETE CASCADE,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  is_booked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_care_slots_pro ON care_slots(professional_id, start_at);

CREATE TABLE care_appointments (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL REFERENCES care_slots(id) ON DELETE CASCADE,
  professional_id TEXT NOT NULL REFERENCES care_professionals(id) ON DELETE CASCADE,
  resident_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  share_contact INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirme' CHECK (status IN ('confirme', 'annule')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_care_appts_resident ON care_appointments(resident_id);
