-- Fichiers privés (PDF, justificatifs) : contrairement aux photos d'incidents, ils ne sont
-- jamais servis publiquement — chaque accès passe par une vérification d'autorisation.
CREATE TABLE private_files (
  id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploader_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  residence_id TEXT REFERENCES residences(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

ALTER TABLE document_requests ADD COLUMN attachment_url TEXT;
