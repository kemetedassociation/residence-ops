import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

export function FeedbackModal({ incident, open, onOpenChange }) {
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await api.post("/feedback", { type: "satisfaction", incident_id: incident.id, rating, message });
      toast.success("Merci pour votre retour !");
      onOpenChange(false);
      setMessage("");
      setRating(5);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Votre incident a été résolu</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Comment évaluez-vous le traitement de « {incident?.title} » ?</p>
        <div className="flex justify-center gap-1 py-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)}>
              <Star className={cn("h-8 w-8", n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
            </button>
          ))}
        </div>
        <Textarea
          rows={3}
          placeholder="Un commentaire à ajouter ? (optionnel)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Plus tard
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Envoi…" : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
