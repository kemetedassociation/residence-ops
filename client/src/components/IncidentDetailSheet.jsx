import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, ThumbsUp, Calendar, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Attachments } from "./Attachments";
import { IncidentTypeIcon } from "./IncidentTypeIcon";
import { StatusBadge } from "./StatusBadge";
import { INCIDENT_PRIORITIES, labelFor, variantFor } from "../lib/constants";
import { Badge } from "./ui/badge";
import { formatDateTime } from "../lib/utils";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

const TIMELINE = [
  { status: "signale", label: "Signalé", hint: "Votre signalement a bien été reçu." },
  { status: "confirme", label: "Confirmé", hint: "Confirmé par la gestion ou d'autres résidents." },
  { status: "en_cours", label: "En cours de traitement", hint: "Une intervention est en cours ou planifiée." },
  { status: "resolu", label: "Résolu", hint: "Le problème a été traité." },
];

// Ligne du temps dérivée du statut actuel : on n'affiche une date que là où le serveur en
// fournit une réellement (création, résolution) plutôt que d'en inventer pour les étapes
// intermédiaires.
function IncidentTimeline({ incident }) {
  if (incident.status === "rejete") {
    return (
      <div className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
        Ce signalement a été clôturé sans suite par la gestion.
      </div>
    );
  }
  const currentIndex = Math.max(0, TIMELINE.findIndex((s) => s.status === incident.status));
  const dateFor = (status) =>
    status === "signale" ? incident.created_at : status === "resolu" ? incident.resolved_date : status === incident.status ? incident.updated_at : null;

  return (
    <ol className="mt-5 space-y-0">
      {TIMELINE.map((step, i) => {
        const done = i <= currentIndex;
        const current = i === currentIndex;
        const date = done ? dateFor(step.status) : null;
        return (
          <li key={step.status} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-white",
                  done ? "border-primary bg-primary" : "border-border bg-card",
                  current && "ring-4 ring-primary/20"
                )}
              >
                {done && <Check className="h-3.5 w-3.5" />}
              </span>
              {i < TIMELINE.length - 1 && <span className={cn("h-8 w-0.5", i < currentIndex ? "bg-primary" : "bg-border")} />}
            </div>
            <div className="pb-3">
              <p className={cn("text-sm font-medium", !done && "text-muted-foreground")}>{step.label}</p>
              <p className="text-xs text-muted-foreground">{current ? step.hint : date ? formatDateTime(date) : ""}</p>
              {current && date && <p className="text-xs text-muted-foreground">{formatDateTime(date)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function IncidentDetailSheet({ incident, buildingName, currentUserId, canConfirm, onClose, onConfirmed }) {
  if (!incident) return null;

  const isOwn = incident.reporter_id === currentUserId;

  async function handleConfirm() {
    try {
      const { incident: updated } = await api.post("/confirmations", { incident_id: incident.id });
      toast.success("Merci pour votre confirmation !");
      onConfirmed?.(updated);
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-card p-5"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-accent">
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <IncidentTypeIcon type={incident.type} size="lg" />
          <div>
            <h2 className="text-lg font-bold">{incident.title}</h2>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {buildingName} {incident.floor && `· Étage ${incident.floor}`} {incident.room && `· ${incident.room}`}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge status={incident.status} />
          <Badge variant={variantFor(INCIDENT_PRIORITIES, incident.priority)}>{labelFor(INCIDENT_PRIORITIES, incident.priority)}</Badge>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-foreground">{incident.description}</p>

        <IncidentTimeline incident={incident} />

        <Attachments incident={incident} />

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDateTime(incident.created_at)}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3.5 w-3.5" />
            {incident.confirmation_count || 0} confirmation(s)
          </span>
        </div>

        {!isOwn && incident.status !== "resolu" && incident.status !== "rejete" && (
          <>
            <Button className="mt-5 w-full" size="lg" onClick={handleConfirm} disabled={!canConfirm}>
              <ThumbsUp className="h-4 w-4" />
              Je confirme cet incident
            </Button>
            {!canConfirm && (
              <p className="mt-2 text-center text-xs text-amber-600">
                Un bail vérifié est requis pour confirmer un incident.
              </p>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
