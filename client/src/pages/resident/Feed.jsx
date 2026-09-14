import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, ListChecks } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import { SwipeableIncidentCard } from "../../components/SwipeableIncidentCard";
import { IncidentDetailSheet } from "../../components/IncidentDetailSheet";
import { FeedbackModal } from "../../components/FeedbackModal";
import { RestrictedBanner } from "../../components/RestrictedBanner";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { useRealtime } from "../../lib/socket";
import { INCIDENT_STATUSES } from "../../lib/constants";

const DISMISSED_KEY = "residence_ops_dismissed";

export function Feed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => api.get("/incidents").then((d) => d.incidents),
  });
  const { data: buildings = [] } = useQuery({
    queryKey: ["buildings"],
    queryFn: () => api.get("/residences").then((d) => d.buildings),
  });

  useRealtime(["incident:created", "incident:updated", "incident:deleted"], () => {
    queryClient.invalidateQueries({ queryKey: ["incidents"] });
  });

  function dismiss(incident) {
    const next = [...dismissed, incident.id];
    setDismissed(next);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    if (incident.status === "resolu") setFeedbackTarget(incident);
  }

  const buildingName = (id) => buildings.find((b) => b.id === id)?.name || "—";

  const visible = useMemo(() => {
    return incidents.filter((i) => {
      if (dismissed.includes(i.id)) return false;
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (buildingFilter !== "all" && i.building_id !== buildingFilter) return false;
      return true;
    });
  }, [incidents, dismissed, statusFilter, buildingFilter]);

  const stats = useMemo(
    () => ({
      active: incidents.filter((i) => i.status === "signale" || i.status === "confirme").length,
      enCours: incidents.filter((i) => i.status === "en_cours").length,
      resolus: incidents.filter((i) => i.status === "resolu").length,
    }),
    [incidents]
  );

  return (
    <div className="pb-6">
      <div className="hero-gradient relative overflow-hidden px-4 pb-8 pt-6 text-white">
        <p className="text-sm opacity-90">Bonjour,</p>
        <h1 className="text-2xl font-bold">{user?.name?.split(" ")[0]} 👋</h1>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: "Actifs", value: stats.active, icon: ListChecks },
            { label: "En cours", value: stats.enCours, icon: Clock },
            { label: "Résolus", value: stats.resolus, icon: CheckCircle2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl bg-white/15 p-3 text-center backdrop-blur">
              <Icon className="mx-auto mb-1 h-4 w-4" />
              <p className="text-lg font-bold">{value}</p>
              <p className="text-[11px] opacity-90">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto -mt-4 max-w-lg space-y-4 px-4">
        {user?.lease_status !== "verified" && <RestrictedBanner compact />}

        <div className="flex gap-2 rounded-xl bg-card p-2 card-elevated">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="border-0 shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {INCIDENT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger className="border-0 shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les bâtiments</SelectItem>
              {buildings.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {visible.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucun incident à afficher pour le moment.</p>
          )}
          {visible.map((incident) => (
            <motion.div key={incident.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SwipeableIncidentCard
                incident={incident}
                buildingName={buildingName(incident.building_id)}
                onTap={setSelected}
                onSwipeReject={dismiss}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {selected && (
        <IncidentDetailSheet
          incident={selected}
          buildingName={buildingName(selected.building_id)}
          currentUserId={user?.id}
          canConfirm={user?.lease_status === "verified"}
          onClose={() => setSelected(null)}
          onConfirmed={(updated) => {
            queryClient.invalidateQueries({ queryKey: ["incidents"] });
            setSelected(updated);
          }}
        />
      )}

      <FeedbackModal
        incident={feedbackTarget}
        open={!!feedbackTarget}
        onOpenChange={(open) => !open && setFeedbackTarget(null)}
      />
    </div>
  );
}
