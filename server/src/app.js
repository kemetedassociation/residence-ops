import express from "express";
import cors from "cors";
import path from "node:path";
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
import { uploadsRouter } from "./routes/uploads.js";
import { pushRouter } from "./routes/push.js";
import { privacyRouter } from "./routes/privacy.js";
import { cardsRouter } from "./routes/cards.js";
import { menusRouter } from "./routes/menus.js";
import { reservationsRouter } from "./routes/reservations.js";
import { documentsRouter } from "./routes/documents.js";
import { slotsRouter, appointmentsRouter } from "./routes/appointments.js";
import { activitiesRouter } from "./routes/activities.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

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

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur serveur inattendue." });
});
