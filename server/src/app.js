import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { authRouter } from "./routes/auth.js";
import { residencesRouter } from "./routes/residences.js";
import { buildingsRouter } from "./routes/buildings.js";
import { incidentsRouter } from "./routes/incidents.js";
import { confirmationsRouter } from "./routes/confirmations.js";
import { interventionsRouter } from "./routes/interventions.js";
import { postsRouter } from "./routes/posts.js";
import { feedbackRouter } from "./routes/feedback.js";
import { notificationsRouter } from "./routes/notifications.js";
import { usersRouter } from "./routes/users.js";
import { uploadsRouter, uploadsDir } from "./routes/uploads.js";
import { pushRouter } from "./routes/push.js";
import { privacyRouter } from "./routes/privacy.js";
import { cardsRouter } from "./routes/cards.js";
import { menusRouter } from "./routes/menus.js";
import { reservationsRouter } from "./routes/reservations.js";
import { documentsRouter } from "./routes/documents.js";
import { slotsRouter, appointmentsRouter } from "./routes/appointments.js";
import { activitiesRouter } from "./routes/activities.js";
import { errorsRouter } from "./routes/errors.js";
import { filesRouter } from "./routes/files.js";
import { paymentsRouter, stripeWebhook } from "./routes/payments.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();
// ALLOWED_ORIGIN verrouille l'API sur le vrai domaine du site en production (voir
// render.yaml). Sans variable définie (dev local, ou avant configuration), on reste
// permissif pour ne pas bloquer le développement.
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || true, credentials: true }));
// Derrière le proxy de Render : sans ceci, req.ip vaut l'adresse du proxy pour tout le monde et
// les limiteurs de débit (connexion, paiement...) partageraient un seul compteur global.
app.set("trust proxy", 1);
// Webhook Stripe : corps brut requis pour vérifier la signature, donc AVANT express.json().
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), stripeWebhook);
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

app.use("/api/auth", authRouter);
app.use("/api/residences", residencesRouter);
app.use("/api/buildings", buildingsRouter);
app.use("/api/incidents", incidentsRouter);
app.use("/api/confirmations", confirmationsRouter);
app.use("/api/interventions", interventionsRouter);
app.use("/api/posts", postsRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/users", usersRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/push", pushRouter);
app.use("/api/privacy", privacyRouter);
app.use("/api/cards", cardsRouter);
app.use("/api/menus", menusRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/availability-slots", slotsRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/activities", activitiesRouter);
app.use("/api/client-errors", errorsRouter);
app.use("/api/files", filesRouter);
app.use("/api/payments", paymentsRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Single-service deployment (Render, Railway, a VPS...): if the client has been built,
// serve its static files and fall back to index.html for client-side routing. In local
// dev, Vite serves the client separately and this directory simply won't exist, so this
// block is a no-op then.
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/") || req.path.startsWith("/socket.io/")) {
      return next();
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur serveur inattendue." });
});
