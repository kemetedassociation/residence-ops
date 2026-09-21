import { Router } from "express";
import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { db, withoutPassword } from "../db/db.js";
import { deletePrivateFile, fileIdFromUrl } from "./files.js";
import { requireAuth } from "../middleware/auth.js";

export const privacyRouter = Router();
privacyRouter.use(requireAuth);

// Article 20 RGPD — droit à la portabilité : toutes les données personnelles détenues
// sur l'utilisateur, dans un format structuré et lisible.
privacyRouter.get("/export", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });

  const data = {
    exported_at: new Date().toISOString(),
    profile: withoutPassword(user),
    incidents_reported: db.prepare("SELECT * FROM incidents WHERE reporter_id = ?").all(req.userId),
    confirmations_made: db.prepare("SELECT * FROM confirmations WHERE user_id = ?").all(req.userId),
    feedback_submitted: db.prepare("SELECT * FROM feedback WHERE user_id = ?").all(req.userId),
    notifications: db.prepare("SELECT * FROM notifications WHERE user_id = ?").all(req.userId),
    push_subscriptions: db
      .prepare("SELECT endpoint, created_at FROM push_subscriptions WHERE user_id = ?")
      .all(req.userId),
    consents: db.prepare("SELECT type, version, accepted_at FROM consents WHERE user_id = ?").all(req.userId),
  };

  const card = db.prepare("SELECT * FROM resident_cards WHERE user_id = ?").get(req.userId);
  if (card) {
    data.resident_card = card;
    data.wallet_transactions = db.prepare("SELECT * FROM wallet_transactions WHERE card_id = ?").all(card.id);
  }

  db.prepare("INSERT INTO data_requests (id, user_id, type, status, created_at) VALUES (?, ?, 'export', 'completed', ?)").run(
    nanoid(),
    req.userId,
    new Date().toISOString()
  );

  res.setHeader("Content-Disposition", `attachment; filename="mes-donnees-residence-ops.json"`);
  res.json(data);
});

// Article 17 RGPD — droit à l'effacement. L'historique des incidents d'un bâtiment relève
// de l'intérêt légitime de la résidence (maintenance, sécurité) : plutôt que de supprimer
// la ligne utilisateur (ce qui casserait cet historique), on anonymise l'identité tout en
// conservant les enregistrements techniques nécessaires.
privacyRouter.delete("/", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });

  // Les documents administratifs (PDF, justificatifs) sont des données personnelles : ils
  // sont supprimés physiquement, pas seulement dissociés du compte.
  const fileIds = new Set(db.prepare("SELECT id FROM private_files WHERE uploader_id = ?").all(req.userId).map((r) => r.id));
  db.prepare("SELECT file_url, attachment_url FROM document_requests WHERE user_id = ?")
    .all(req.userId)
    .forEach((r) => [r.file_url, r.attachment_url].forEach((u) => fileIdFromUrl(u) && fileIds.add(fileIdFromUrl(u))));
  fileIds.forEach(deletePrivateFile);
  db.prepare("UPDATE document_requests SET file_url = NULL, attachment_url = NULL WHERE user_id = ?").run(req.userId);

  const anonymousEmail = `utilisateur-supprime-${user.id}@anonymise.local`;
  const unusablePassword = crypto.randomBytes(32).toString("hex");

  db.prepare(
    `UPDATE users
     SET name = 'Utilisateur supprimé', email = ?, password = ?, phone = '', room = '',
         lease_number = NULL, lease_status = 'none', building_id = NULL, is_anonymized = 1
     WHERE id = ?`
  ).run(anonymousEmail, unusablePassword, req.userId);

  db.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").run(req.userId);
  db.prepare("DELETE FROM notifications WHERE user_id = ?").run(req.userId);
  // The wallet balance/history is a financial record kept for accounting purposes; the card
  // is blocked rather than deleted so it can no longer be used once the identity is erased.
  db.prepare("UPDATE resident_cards SET status = 'blocked' WHERE user_id = ?").run(req.userId);

  db.prepare("INSERT INTO data_requests (id, user_id, type, status, created_at) VALUES (?, ?, 'erasure', 'completed', ?)").run(
    nanoid(),
    req.userId,
    new Date().toISOString()
  );

  res.json({
    ok: true,
    message:
      "Votre compte a été anonymisé. Les incidents que vous avez signalés sont conservés (intérêt légitime de maintenance du bâtiment) mais ne sont plus rattachés à votre identité.",
  });
});
