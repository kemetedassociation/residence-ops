-- Permissions par membre du personnel (gestionnaires et techniciens). permissions = NULL signifie
-- accès complet (administrateur principal) ; un tableau JSON de modules restreint l'accès à ceux-là
-- uniquement. is_suspended coupe l'accès immédiatement, sans supprimer le compte.
ALTER TABLE users ADD COLUMN permissions TEXT;
ALTER TABLE users ADD COLUMN is_suspended INTEGER NOT NULL DEFAULT 0;

-- Les comptes techniciens existants n'avaient accès qu'aux incidents par convention : on fige ce
-- comportement explicitement plutôt que de leur donner un accès complet par défaut.
UPDATE users SET permissions = '["incidents"]' WHERE role = 'technicien';
