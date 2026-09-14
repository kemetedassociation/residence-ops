import { createServer } from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { app } from "./app.js";
import { setIO, roomFor } from "./realtime.js";
import { db } from "./db/db.js";
import { JWT_SECRET } from "./middleware/auth.js";

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
