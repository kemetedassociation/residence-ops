-- Journal anti-gaspillage : une ligne par plat suivi (menu_id + dish), mise à jour (upsert) à
-- chaque nouvelle saisie du gérant plutôt que dupliquée. "saved" est la SEULE valeur saisie à la
-- main (portions restantes effectivement récupérées/données) ; "lost" est calculé automatiquement
-- (lost = remaining - saved) et n'est jamais saisi directement.
--
-- menu_date/meal/dish sont dupliqués depuis menus au moment de l'écriture (snapshot), et menu_id
-- passe à NULL si le menu est supprimé plutôt que de faire disparaître l'historique : l'objet même
-- de cette table est de garder une trace dans le temps des quantités perdues/sauvées, y compris
-- pour des menus qui ne sont plus publiés.
CREATE TABLE waste_logs (
  id TEXT PRIMARY KEY,
  residence_id TEXT NOT NULL REFERENCES residences(id) ON DELETE CASCADE,
  menu_id TEXT REFERENCES menus(id) ON DELETE SET NULL,
  menu_date TEXT NOT NULL,
  meal TEXT NOT NULL,
  dish TEXT NOT NULL,
  prepared INTEGER,
  reserved INTEGER NOT NULL,
  remaining INTEGER NOT NULL,
  saved INTEGER NOT NULL,
  lost INTEGER NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE(menu_id, dish)
);

CREATE INDEX idx_waste_logs_residence ON waste_logs(residence_id);
