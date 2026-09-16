import { Droplet, Zap, ShieldAlert, Volume2, HelpCircle } from "lucide-react";

export const INCIDENT_TYPES = [
  { value: "eau", label: "Eau", icon: Droplet, color: "#2563eb", bg: "bg-blue-500/10", text: "text-blue-600" },
  { value: "electricite", label: "Électricité", icon: Zap, color: "#eab308", bg: "bg-yellow-500/10", text: "text-yellow-600" },
  { value: "securite", label: "Sécurité", icon: ShieldAlert, color: "#ef4444", bg: "bg-red-500/10", text: "text-red-600" },
  { value: "bruit", label: "Bruit", icon: Volume2, color: "#a855f7", bg: "bg-purple-500/10", text: "text-purple-600" },
  { value: "autre", label: "Autre", icon: HelpCircle, color: "#f97316", bg: "bg-orange-500/10", text: "text-orange-600" },
];

export const HERO_IMAGES = {
  eau: "https://images.unsplash.com/photo-1519046904884-53103b34b206?q=80&w=1200&auto=format&fit=crop",
  electricite: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=1200&auto=format&fit=crop",
  securite: "https://images.unsplash.com/photo-1558002038-1055907df827?q=80&w=1200&auto=format&fit=crop",
  bruit: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop",
  autre: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1200&auto=format&fit=crop",
  default: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1200&auto=format&fit=crop",
};

export const INCIDENT_STATUSES = [
  { value: "signale", label: "Signalé", variant: "secondary" },
  { value: "confirme", label: "Confirmé", variant: "in-progress" },
  { value: "en_cours", label: "En cours", variant: "in-progress" },
  { value: "resolu", label: "Résolu", variant: "resolved" },
  { value: "rejete", label: "Rejeté", variant: "destructive" },
];

export const INCIDENT_PRIORITIES = [
  { value: "urgent", label: "Urgent", variant: "urgent" },
  { value: "normal", label: "Normal", variant: "secondary" },
  { value: "faible", label: "Faible", variant: "outline" },
];

export const INTERVENTION_STATUSES = [
  { value: "planifiee", label: "Planifiée", variant: "secondary" },
  { value: "en_cours", label: "En cours", variant: "in-progress" },
  { value: "terminee", label: "Terminée", variant: "resolved" },
  { value: "annulee", label: "Annulée", variant: "destructive" },
];

export const POST_CATEGORIES = [
  { value: "intervention", label: "Intervention", color: "#2563eb" },
  { value: "reglementation", label: "Règlementation", color: "#a855f7" },
  { value: "travaux", label: "Travaux", color: "#f97316" },
  { value: "information", label: "Information", color: "#10b981" },
  { value: "alerte", label: "Alerte", color: "#ef4444" },
];

export const LEASE_STATUSES = [
  { value: "none", label: "Non renseigné", variant: "secondary" },
  { value: "pending", label: "En attente de vérification", variant: "in-progress" },
  { value: "verified", label: "Bail vérifié", variant: "resolved" },
  { value: "rejected", label: "Bail refusé", variant: "destructive" },
];

export const DOCUMENT_TYPES = [
  { value: "attestation_residence", label: "Attestation de résidence" },
  { value: "avis_echeance", label: "Avis d'échéance" },
  { value: "autre", label: "Autre document" },
];

export const DOCUMENT_STATUSES = [
  { value: "demande", label: "Demandé", variant: "secondary" },
  { value: "en_traitement", label: "En traitement", variant: "in-progress" },
  { value: "pret", label: "Prêt", variant: "resolved" },
  { value: "refuse", label: "Refusé", variant: "destructive" },
];

export const ACTIVITY_CATEGORIES = [
  { value: "sport", label: "Sport", color: "#10b981" },
  { value: "jeux", label: "Soirée jeux", color: "#a855f7" },
  { value: "projection", label: "Projection", color: "#2563eb" },
  { value: "soiree", label: "Soirée", color: "#f97316" },
  { value: "autre", label: "Autre", color: "#94a3b8" },
];

export const NOTIFICATION_TYPES = {
  info: { color: "#2563eb", bg: "bg-blue-500/10", text: "text-blue-600" },
  alerte: { color: "#ef4444", bg: "bg-red-500/10", text: "text-red-600" },
  resolution: { color: "#10b981", bg: "bg-emerald-500/10", text: "text-emerald-600" },
  intervention: { color: "#f59e0b", bg: "bg-amber-500/10", text: "text-amber-600" },
};

export function findMeta(list, value) {
  return list.find((i) => i.value === value);
}

export function labelFor(list, value) {
  return findMeta(list, value)?.label || value;
}

export function variantFor(list, value) {
  return findMeta(list, value)?.variant || "secondary";
}

export function severityColor(count) {
  if (count === 0) return "#10b981";
  if (count <= 2) return "#f59e0b";
  return "#ef4444";
}

// Image générique utilisée quand une actualité n'a pas encore de photo de couverture,
// pour que la page ne paraisse jamais "vide" même avant que la gestion n'ajoute ses propres
// visuels via l'upload existant.
export const DEFAULT_POST_IMAGE = "https://images.unsplash.com/photo-1493397212122-2b85dda8106b?w=1200&q=70";
