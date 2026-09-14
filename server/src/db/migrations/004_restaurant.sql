CREATE TABLE menus (
  id TEXT PRIMARY KEY,
  residence_id TEXT NOT NULL REFERENCES residences(id) ON DELETE CASCADE,
  menu_date TEXT NOT NULL,
  meal TEXT NOT NULL CHECK (meal IN ('midi', 'soir')),
  items TEXT NOT NULL DEFAULT '[]',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE(residence_id, menu_date, meal)
);

CREATE TABLE meal_reservations (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dish TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reservee' CHECK (status IN ('reservee', 'annulee')),
  paid_with_card INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(menu_id, user_id)
);

CREATE INDEX idx_reservations_menu ON meal_reservations(menu_id);
CREATE INDEX idx_reservations_user ON meal_reservations(user_id);
