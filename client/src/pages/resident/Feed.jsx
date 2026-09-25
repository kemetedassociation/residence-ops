import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  ListChecks,
  Wallet,
  UtensilsCrossed,
  FileText,
  PartyPopper,
  MegaphoneIcon,
  HeartHandshake,
  ChevronRight,
} from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import { SwipeableIncidentCard } from "../../components/SwipeableIncidentCard";
import { IncidentDetailSheet } from "../../components/IncidentDetailSheet";
import { FeedbackModal } from "../../components/FeedbackModal";
import { RestrictedBanner } from "../../components/RestrictedBanner";
import { Skeleton } from "../../components/ui/skeleton";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { useRealtime } from "../../lib/socket";
import { INCIDENT_STATUSES, DEFAULT_POST_IMAGE } from "../../lib/constants";
import { formatDate } from "../../lib/utils";

const DISMISSED_KEY = "residence_ops_dismissed";

const quickActions = [
  { to: "/ma-carte", label: "Ma carte", icon: Wallet },
  { to: "/restaurant", label: "Restaurant", icon: UtensilsCrossed },
  { to: "/administration", label: "Administration", icon: FileText },
  { to: "/loisirs", label: "Loisirs", icon: PartyPopper },
];

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

  const { data: incidents = [], isLoading: incidentsLoading } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => api.get("/incidents").then((d) => d.incidents),
  });
  const { data: buildings = [] } = useQuery({
    queryKey: ["buildings"],
    queryFn: () => api.get("/residences").then((d) => d.buildings),
  });
  const { data: posts = [] } = useQuery({
    queryKey: ["posts"],
    queryFn: () => api.get("/posts").then((d) => d.posts),
  });
  const featuredPost = useMemo(() => posts.find((p) => p.pinned) || posts[0] || null, [posts]);

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
      <div className="hero-gradient relative overflow-hidden px-4 pb-10 pt-6 text-white">
        <p className="text-sm opacity-90">Bonjour 👋</p>
        <h1 className="text-2xl font-bold leading-tight">
          {user?.name?.split(" ")[0]},<br />bienvenue chez vous
        </h1>
        <NavLink
          to="/signaler"
          className="mt-5 flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-foreground shadow-lg transition-transform active:scale-[0.98]"
        >
          <span className="flex items-center gap-2">
            <MegaphoneIcon className="h-4 w-4 text-primary" />
            Signaler un incident
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </NavLink>
      </div>

      <div className="mx-auto -mt-6 max-w-lg space-y-4 px-4">
        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-card p-3 card-elevated">
          {quickActions.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-1.5 text-center transition-transform active:scale-95"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="w-full truncate text-[11px] font-medium text-muted-foreground">{label}</span>
            </NavLink>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Actifs", value: stats.active, icon: ListChecks },
            { label: "En cours", value: stats.enCours, icon: Clock },
            { label: "Résolus", value: stats.resolus, icon: CheckCircle2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl bg-card p-3 text-center card-elevated">
              <Icon className="mx-auto mb-1 h-4 w-4 text-primary" />
              <p className="text-lg font-bold">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <NavLink to="/aide" className="flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3 active:scale-[0.99]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-600">
            <HeartHandshake className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Besoin de parler ?</span>
            <span className="block text-xs text-muted-foreground">Des psychologues sont là pour vous, en toute confidentialité.</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </NavLink>

        {featuredPost && (
          <NavLink
            to="/actualites"
            className="flex items-center gap-3 overflow-hidden rounded-2xl bg-card card-elevated"
          >
            <img
              src={featuredPost.cover_image_url || DEFAULT_POST_IMAGE}
              alt=""
              className="h-20 w-20 shrink-0 object-cover"
            />
            <div className="min-w-0 flex-1 py-2 pr-3">
              <p className="text-[11px] font-medium text-primary">À la une</p>
              <p className="truncate text-sm font-semibold">{featuredPost.title}</p>
              <p className="text-xs text-muted-foreground">{formatDate(featuredPost.published_at)}</p>
            </div>
            <ChevronRight className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
          </NavLink>
        )}

        {user?.lease_status !== "verified" && <RestrictedBanner compact />}

        <h2 className="pt-1 text-sm font-semibold text-muted-foreground">Suivi des signalements</h2>

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
          {incidentsLoading ? (
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </>
          ) : (
            visible.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucun incident à afficher pour le moment.</p>
            )
          )}
          {!incidentsLoading &&
            visible.map((incident) => (
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
