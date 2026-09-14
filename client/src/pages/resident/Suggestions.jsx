import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Lightbulb } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Button } from "../../components/ui/button";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/utils";

export function Suggestions() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justSent, setJustSent] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["feedback", "suggestion"],
    queryFn: () => api.get("/feedback?type=suggestion").then((d) => d.feedback),
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/feedback", { title, message, type: "suggestion" });
      setTitle("");
      setMessage("");
      setJustSent(true);
      queryClient.invalidateQueries({ queryKey: ["feedback", "suggestion"] });
      setTimeout(() => setJustSent(false), 3000);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-6">
      <div className="hero-gradient flex items-center gap-3 px-4 py-6 text-white">
        <Lightbulb className="h-6 w-6" />
        <h1 className="text-xl font-bold">Boîte à idées</h1>
      </div>

      <div className="mx-auto max-w-lg space-y-6 px-4 py-4">
        <div className="rounded-xl border border-border bg-card p-4 card-elevated">
          <AnimatePresence mode="wait">
            {justSent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-2 py-6 text-center"
              >
                <CheckCircle2 className="h-10 w-10 text-status-resolved" />
                <p className="font-medium">Merci pour votre suggestion !</p>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={handleSubmit} className="space-y-3">
                <Input placeholder="Titre (optionnel)" value={title} onChange={(e) => setTitle(e.target.value)} />
                <Textarea
                  rows={3}
                  required
                  placeholder="Une idée pour améliorer la résidence ?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <Button type="submit" className="w-full" disabled={submitting || !message.trim()}>
                  {submitting ? "Envoi…" : "Envoyer ma suggestion"}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Idées de la communauté</h2>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-card p-4 card-elevated">
                {item.title && <p className="font-medium">{item.title}</p>}
                <p className="text-sm text-muted-foreground">{item.message}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.is_mine ? "Vous" : item.author_email_masked}</span>
                  <span>{formatDate(item.created_at)}</span>
                </div>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-muted-foreground">Aucune suggestion pour le moment.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
