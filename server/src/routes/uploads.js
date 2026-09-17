import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import { requireAuth } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// UPLOADS_DIR permet de pointer vers un disque persistant en production (voir render.yaml) —
// sans ça, les photos jointes aux incidents/documents disparaîtraient à chaque redéploiement
// même une fois la base de données elle-même rendue persistante.
export const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${nanoid()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Seules les images sont acceptées."));
    }
    cb(null, true);
  },
});

export const uploadsRouter = Router();
uploadsRouter.use(requireAuth);

uploadsRouter.post("/", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "Fichier invalide." });
    if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu." });
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});
