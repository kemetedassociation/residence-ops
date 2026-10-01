import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { isAzureSpeechConfigured, synthesizeSpeech } from "../lib/azureSpeech.js";

export const assistantRouter = Router();
assistantRouter.use(requireAuth);

const speakSchema = z.object({ text: z.string().trim().min(1).max(500) });

const speakLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.VITEST ? 1000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de demandes de synthèse vocale, réessayez dans quelques minutes." },
});

assistantRouter.get("/speech/config", (req, res) => {
  res.json({ enabled: isAzureSpeechConfigured() });
});

assistantRouter.post("/speech", speakLimiter, validate(speakSchema), async (req, res) => {
  if (!isAzureSpeechConfigured()) {
    // Pas une erreur : le client bascule silencieusement sur la voix du navigateur.
    return res.status(503).json({ error: "La voix d'Isis n'est pas configurée sur ce serveur." });
  }
  try {
    const audio = await synthesizeSpeech(req.body.text);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(audio);
  } catch (err) {
    console.error("Erreur de synthèse vocale Azure :", err.message);
    res.status(502).json({ error: "La voix d'Isis est momentanément indisponible." });
  }
});
