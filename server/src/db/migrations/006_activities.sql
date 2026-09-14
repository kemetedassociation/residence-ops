CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  residence_id TEXT NOT NULL REFERENCES residences(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'autre' CHECK (category IN ('sport', 'jeux', 'projection', 'soiree', 'autre')),
  activity_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  location TEXT DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_activities_residence_date ON activities(residence_id, activity_date);
