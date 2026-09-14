CREATE TABLE document_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'demande' CHECK (status IN ('demande', 'en_traitement', 'pret', 'refuse')),
  admin_note TEXT DEFAULT '',
  file_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE availability_slots (
  id TEXT PRIMARY KEY,
  staff_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  residence_id TEXT NOT NULL REFERENCES residences(id) ON DELETE CASCADE,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  is_booked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL UNIQUE REFERENCES availability_slots(id) ON DELETE CASCADE,
  resident_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'confirme' CHECK (status IN ('confirme', 'annule')),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_documents_user ON document_requests(user_id);
CREATE INDEX idx_slots_residence ON availability_slots(residence_id);
