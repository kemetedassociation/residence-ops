-- Chaque notification peut renvoyer vers la page (ou l'onglet) concernée : un appui l'y emmène.
ALTER TABLE notifications ADD COLUMN link TEXT;
