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

// Formats acceptés, identifiés par l'EXTENSION et vérifiés sur l'en-tête réel du fichier : le
// type MIME envoyé par le navigateur n'est pas fiable (Windows en envoie souvent un faux, ou
// application/octet-stream). Le type enregistré est celui de cette table, jamais celui du client.
// `inline` = affichable dans le navigateur ; tout le reste est servi en téléchargement, pour
// qu'un fichier ne puisse jamais s'exécuter/s'afficher comme une page web.
// Volontairement exclus : html, svg, js, exe, archives — potentiellement exécutables.
const startsWith = (b, sig, offset = 0) => sig.every((byte, i) => b[offset + i] === byte);
const ascii = (b, start, end) => b.subarray(start, end).toString("latin1");
const isZip = (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]);
const isOle = (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const isText = (b) => !b.includes(0);
const isJpeg = (b) => startsWith(b, [0xff, 0xd8, 0xff]);
const isPng = (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]);

const FORMATS = {
  pdf: { mime: "application/pdf", inline: true, check: (b) => ascii(b, 0, 5) === "%PDF-" },
  jpg: { mime: "image/jpeg", inline: true, check: isJpeg },
  jpeg: { mime: "image/jpeg", inline: true, check: isJpeg },
  png: { mime: "image/png", inline: true, check: isPng },
  gif: { mime: "image/gif", inline: true, check: (b) => ascii(b, 0, 4) === "GIF8" },
  webp: { mime: "image/webp", inline: true, check: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP" },
  heic: { mime: "image/heic", inline: false, check: (b) => ascii(b, 4, 8) === "ftyp" },
  heif: { mime: "image/heif", inline: false, check: (b) => ascii(b, 4, 8) === "ftyp" },
  doc: { mime: "application/msword", inline: false, check: isOle },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", inline: false, check: isZip },
  xls: { mime: "application/vnd.ms-excel", inline: false, check: isOle },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", inline: false, check: isZip },
  ppt: { mime: "application/vnd.ms-powerpoint", inline: false, check: isOle },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", inline: false, check: isZip },
  odt: { mime: "application/vnd.oasis.opendocument.text", inline: false, check: isZip },
  ods: { mime: "application/vnd.oasis.opendocument.spreadsheet", inline: false, check: isZip },
  odp: { mime: "application/vnd.oasis.opendocument.presentation", inline: false, check: isZip },
  rtf: { mime: "application/rtf", inline: false, check: (b) => ascii(b, 0, 5) === "{\\rtf" },
  txt: { mime: "text/plain", inline: false, check: isText },
  csv: { mime: "text/csv", inline: false, check: isText },
};

export const ACCEPTED_EXTENSIONS = Object.keys(FORMATS);

function formatOf(filename) {
  const ext = path.extname(filename || "").slice(1).toLowerCase();
  return FORMATS[ext] || null;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, privateFilesDir),
    filename: (req, file, cb) => cb(null, nanoid()),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!formatOf(file.originalname)) {
      return cb(
        new Error(`Format non accepté. Formats acceptés : ${ACCEPTED_EXTENSIONS.map((e) => e.toUpperCase()).join(", ")}.`)
      );
    }
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
      const format = formatOf(req.file.originalname);
      const head = Buffer.alloc(512);
      const fd = fs.openSync(req.file.path, "r");
      const read = fs.readSync(fd, head, 0, 512, 0);
      fs.closeSync(fd);
      if (read === 0 || !format.check(head.subarray(0, read))) {
        fs.rmSync(req.file.path, { force: true });
        return res.status(400).json({ error: "Le contenu du fichier ne correspond pas à son format." });
      }

      const id = req.file.filename;
      const originalName = (req.file.originalname || "document").slice(0, 200);
      db.prepare(
        "INSERT INTO private_files (id, original_name, mime, size, uploader_id, residence_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(id, originalName, format.mime, req.file.size, req.userId, residenceIdForUser(req.userId), new Date().toISOString());

      res.status(201).json({ file: { url: fileUrl(id), name: originalName, mime: format.mime, size: req.file.size } });
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
  const inline = Object.values(FORMATS).some((f) => f.mime === file.mime && f.inline);
  res.setHeader("Content-Type", file.mime);
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.original_name)}`
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(fullPath);
});
