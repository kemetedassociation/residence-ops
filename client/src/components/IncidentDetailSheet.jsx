import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, ThumbsUp, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { IncidentTypeIcon } from "./IncidentTypeIcon";
import { StatusBadge } from "./StatusBadge";
import { INCIDENT_PRIORITIES, labelFor, variantFor } from "../lib/constants";
import { Badge } from "./ui/badge";
import { formatDateTime } from "../lib/utils";
import { api } from "../lib/api";

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

        {incident.photo_urls?.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {incident.photo_urls.map((url) => (
              <img key={url} src={url} alt="Photo de l'incident" className="h-40 w-40 shrink-0 rounded-lg object-cover" />
            ))}
          </div>
        )}

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
