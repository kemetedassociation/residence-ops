import { createServer } from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { app } from "./app.js";
import { setIO, roomFor } from "./realtime.js";
import { db } from "./db/db.js";
import { JWT_SECRET } from "./middleware/auth.js";

// Seed automatique si la base est vide : nécessaire sur Render (plan gratuit, pas d'accès
// Shell, et base de données réinitialisée à chaque déploiement) — sans danger, puisqu'il ne
// se déclenche que quand la table residences est vide (jamais sur une base déjà en usage).
const { count } = db.prepare("SELECT COUNT(*) as count FROM residences").get();
if (count === 0) {
  console.log("Base de données vide détectée : lancement du seed de démonstration...");
  const { seed } = await import("./db/seed.js");
  seed();
}

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
setIO(io);

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next();
    const payload = jwt.verify(token, JWT_SECRET);
    socket.userId = payload.id;
    next();
  } catch {
    next();
  }
});

io.on("connection", (socket) => {
  if (socket.userId) {
    const user = db.prepare("SELECT residence_id FROM users WHERE id = ?").get(socket.userId);
    if (user?.residence_id) socket.join(roomFor(user.residence_id));
    socket.join(`user:${socket.userId}`);
  }
  socket.on("disconnect", () => {});
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`API Résidence Ops (+ WebSocket) sur http://localhost:${PORT}`);
});
