import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { requireAuth, requireLease } from "../middleware/auth.js";
import { uploadsDir } from "./uploads.js";
import { residenceIdForUser } from "../lib/residence.js";

// Dossier distinct de celui des photos publiques (servi par express.static) : un fichier
// déposé ici n'est lisible que via GET /api/files/:id, après contrôle d'accès.
export const privateFilesDir = process.env.PRIVATE_FILES_DIR || path.join(uploadsDir, "..", "private-files");
fs.mkdirSync(privateFilesDir, { recursive: true });

const ALLOWED = {
  "application/pdf": (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(1, 4).toString("latin1") === "PNG",
  "image/webp": (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, privateFilesDir),
    filename: (req, file, cb) => cb(null, nanoid()),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(new Error("Format non accepté : PDF, JPEG, PNG ou WebP uniquement."));
    cb(null, true);
  },
});

export function fileUrl(id) {
  return `/api/files/${id}`;
}

export function fileIdFromUrl(url) {
  return /^\/api\/files\/([\w-]{10,40})$/.exec(url || "")?.[1] || null;
}

export function deletePrivateFile(id) {
  db.prepare("DELETE FROM private_files WHERE id = ?").run(id);
  fs.rmSync(path.join(privateFilesDir, id), { force: true });
}

export const filesRouter = Router();
filesRouter.use(requireAuth);

filesRouter.post(
  "/",
  (req, res, next) => (req.userRole === "resident" ? requireLease(req, res, next) : next()),
  (req, res) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        const message = err.code === "LIMIT_FILE_SIZE" ? "Fichier trop volumineux (10 Mo maximum)." : err.message;
        return res.status(400).json({ error: message || "Fichier invalide." });
      }
      if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu." });

      // Le type MIME est déclaré par le client : on vérifie l'en-tête réel du fichier pour
      // empêcher de faire passer autre chose pour un PDF.
      const head = Buffer.alloc(12);
      const fd = fs.openSync(req.file.path, "r");
      fs.readSync(fd, head, 0, 12, 0);
      fs.closeSync(fd);
      if (!ALLOWED[req.file.mimetype](head)) {
        fs.rmSync(req.file.path, { force: true });
        return res.status(400).json({ error: "Le contenu du fichier ne correspond pas à son format." });
      }

      const id = req.file.filename;
      const originalName = (req.file.originalname || "document").slice(0, 200);
      db.prepare(
        "INSERT INTO private_files (id, original_name, mime, size, uploader_id, residence_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(id, originalName, req.file.mimetype, req.file.size, req.userId, residenceIdForUser(req.userId), new Date().toISOString());

      res.status(201).json({ file: { url: fileUrl(id), name: originalName, mime: req.file.mimetype, size: req.file.size } });
    });
  }
);

function canAccess(userId, role, file) {
  if (file.uploader_id === userId) return true;
  const url = fileUrl(file.id);
  if (role === "manager") return residenceIdForUser(userId) === file.residence_id;
  return !!db
    .prepare("SELECT 1 FROM document_requests WHERE user_id = ? AND (file_url = ? OR attachment_url = ?)")
    .get(userId, url, url);
}

filesRouter.get("/:id", (req, res) => {
  const file = db.prepare("SELECT * FROM private_files WHERE id = ?").get(req.params.id);
  // Même réponse que le fichier existe ou non pour un utilisateur non autorisé : on ne révèle rien.
  if (!file || !canAccess(req.userId, req.userRole, file)) return res.status(404).json({ error: "Fichier introuvable." });

  const fullPath = path.join(privateFilesDir, file.id);
  if (!fs.existsSync(fullPath)) {
    return res.status(410).json({ error: "Ce fichier n'est plus disponible (il a été perdu lors d'une réinitialisation du serveur)." });
  }
  res.setHeader("Content-Type", file.mime);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(fullPath);
});
