import { Attachments } from "./Attachments";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, MapPin, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { Label } from "./ui/label";
import { IncidentTypeIcon } from "./IncidentTypeIcon";
import { Badge } from "./ui/badge";
import { INCIDENT_STATUSES, INCIDENT_PRIORITIES, labelFor, variantFor } from "../lib/constants";
import { formatDateTime } from "../lib/utils";
import { api } from "../lib/api";

export function IncidentActionSheet({ incident, buildingName, reporterName, technicians, onClose, onUpdated, onDeleted }) {
  if (!incident) return null;

  async function updateStatus(status) {
    try {
      const { incident: updated } = await api.patch(`/incidents/${incident.id}`, { status });
      toast.success("Statut mis à jour.");
      onUpdated(updated);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function assignTechnician(technicianId) {
    try {
      const { incident: updated } = await api.patch(`/incidents/${incident.id}`, { assigned_to: technicianId });
      toast.success("Technicien assigné, intervention planifiée.");
      onUpdated(updated);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer définitivement cet incident ?")) return;
    try {
      await api.del(`/incidents/${incident.id}`);
      toast.success("Incident supprimé.");
      onDeleted(incident.id);
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-card p-6 shadow-xl"
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-accent">
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <IncidentTypeIcon type={incident.type} size="lg" />
          <div>
            <h2 className="text-lg font-bold">{incident.title}</h2>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {buildingName} {incident.floor && `· Étage ${incident.floor}`}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={variantFor(INCIDENT_PRIORITIES, incident.priority)}>{labelFor(INCIDENT_PRIORITIES, incident.priority)}</Badge>
          <Badge variant="outline">{reporterName}</Badge>
        </div>

        <p className="mt-4 text-sm leading-relaxed">{incident.description}</p>

        <Attachments incident={incident} />

        <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" /> Signalé le {formatDateTime(incident.created_at)}
        </p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Statut</Label>
            <Select value={incident.status} onValueChange={updateStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Assigner un technicien</Label>
            <Select value={incident.assigned_to || ""} onValueChange={assignTechnician}>
              <SelectTrigger>
                <SelectValue placeholder="Non assigné" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button variant="destructive" className="mt-8 w-full" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
          Supprimer l'incident
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
