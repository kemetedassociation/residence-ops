import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, Send, Mic, MicOff, Volume2, VolumeX, Bot, User as UserIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSpeech } from "../hooks/useSpeech";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";
import {
  RESIDENT_INTENTS,
  MANAGER_INTENTS,
  matchIntent,
  FALLBACK_REPLY,
  FALLBACK_REPLY_MANAGER,
} from "../lib/chatbotKnowledge";

const RESIDENT_SUGGESTIONS = ["Signaler une fuite", "Voir mon solde", "Menu du restaurant", "Réserver un rendez-vous"];
const MANAGER_SUGGESTIONS = ["Voir les incidents", "Planning des interventions", "Baux en attente", "Statistiques"];

export function Chatbot() {
  const { user } = useAuth();

  // Hooks below must run unconditionally on every render (rules of hooks) — `user`
  // can flip from an account to null on logout, so the "hide when logged out" check
  // happens in the render output, not by early-returning before other hooks.
  const navigate = useNavigate();
  const speech = useSpeech();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const scrollRef = useRef(null);
  const greetedRef = useRef(false);

  const isManager = user?.role === "manager";
  const intents = isManager ? MANAGER_INTENTS : RESIDENT_INTENTS;
  const fallback = isManager ? FALLBACK_REPLY_MANAGER : FALLBACK_REPLY;
  const suggestions = isManager ? MANAGER_SUGGESTIONS : RESIDENT_SUGGESTIONS;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open && !greetedRef.current) {
      greetedRef.current = true;
      addBotMessage(
        isManager
          ? "Bonjour, je suis votre assistant. Posez-moi une question ou dites-moi où vous souhaitez aller."
          : "Bonjour 👋 Je suis votre assistant Résidence Ops. Posez-moi une question ou dites-moi ce que vous cherchez."
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function addBotMessage(text) {
    setMessages((prev) => [...prev, { role: "bot", text }]);
    if (speakEnabled) speech.speak(text);
  }

  function addUserMessage(text) {
    setMessages((prev) => [...prev, { role: "user", text }]);
  }

  function handleSend(rawText) {
    const text = (rawText ?? input).trim();
    if (!text) return;
    addUserMessage(text);
    setInput("");

    const intent = matchIntent(text, intents);
    if (!intent) {
      addBotMessage(fallback);
      maybeContinueListening();
      return;
    }

    addBotMessage(intent.reply);

    if (intent.route) {
      setTimeout(() => navigate(intent.route), 900);
    }
    maybeContinueListening();
  }

  // "Conversation mode": once enabled, the assistant keeps listening again after each
  // reply so the user can hold a hands-free back-and-forth exchange.
  function maybeContinueListening() {
    if (!voiceMode || !speech.isRecognitionSupported) return;
    setTimeout(() => startListening(), speakEnabled ? 1400 : 400);
  }

  async function startListening() {
    try {
      const transcript = await speech.listen();
      if (transcript) handleSend(transcript);
    } catch {
      // permission denied or no speech detected — silently stop, user can retry manually
    }
  }

  function toggleVoiceMode() {
    const next = !voiceMode;
    setVoiceMode(next);
    if (next) startListening();
    else speech.stopListening();
  }

  const bubbleOffset = isManager
    ? "calc(1.25rem + env(safe-area-inset-bottom))"
    : "calc(4.75rem + env(safe-area-inset-bottom))";

  if (!user) return null;

  return (
    <div className="fixed z-40" style={{ right: "1rem", bottom: bubbleOffset }}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-16 right-0 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="hero-gradient flex items-center justify-between px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <span className="font-semibold">Assistant</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSpeakEnabled((v) => !v)}
                  className="rounded-full p-1.5 hover:bg-white/15"
                  title={speakEnabled ? "Désactiver la voix" : "Activer la voix"}
                >
                  {speakEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
                <button onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-white/15">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex items-start gap-2", m.role === "user" && "flex-row-reverse")}
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      m.role === "bot" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {m.role === "bot" ? <Bot className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
                  </div>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                      m.role === "bot" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
                    )}
                  >
                    {m.text}
                  </div>
                </motion.div>
              ))}
              {speech.isListening && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <motion.span
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="h-2 w-2 rounded-full bg-destructive"
                  />
                  Je vous écoute…
                </div>
              )}
            </div>

            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-1.5 border-t border-border p-2"
            >
              {speech.isRecognitionSupported && (
                <Button
                  type="button"
                  size="icon"
                  variant={voiceMode ? "default" : "outline"}
                  onClick={toggleVoiceMode}
                  title={voiceMode ? "Désactiver le mode conversation vocale" : "Activer le mode conversation vocale"}
                >
                  {voiceMode ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </Button>
              )}
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Écrivez votre question…"
                className="flex-1"
              />
              <Button type="submit" size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
      >
        <AnimatePresence mode="popLayout">
          {open ? (
            <motion.span key="x" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0 }}>
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span key="chat" initial={{ opacity: 0, rotate: 90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0 }}>
              <MessageCircle className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
