-- Choix du résident au signalement : les pièces jointes (photos, PDF) sont visibles par tous les
-- résidents de la résidence ('public') ou seulement par la gestion, le technicien et lui-même ('private').
-- Les signalements existants gardent le comportement d'origine (visibles de la résidence).
ALTER TABLE incidents ADD COLUMN photos_visibility TEXT NOT NULL DEFAULT 'public' CHECK (photos_visibility IN ('public', 'private'));
