ALTER TABLE users ADD COLUMN is_anonymized INTEGER NOT NULL DEFAULT 0;

CREATE TABLE consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('privacy_policy', 'terms')),
  version TEXT NOT NULL,
  accepted_at TEXT NOT NULL
);

CREATE TABLE data_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('export', 'erasure')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_consents_user ON consents(user_id);
