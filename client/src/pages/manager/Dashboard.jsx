import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ListChecks, Clock, CheckCircle2, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { IncidentTypeIcon } from "../../components/IncidentTypeIcon";
import { StatusBadge } from "../../components/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { api } from "../../lib/api";
import { useRealtime } from "../../lib/socket";
import { INCIDENT_TYPES, labelFor } from "../../lib/constants";
import { formatDate } from "../../lib/utils";

export function Dashboard() {
  const queryClient = useQueryClient();

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

  const stats = useMemo(() => {
    const active = incidents.filter((i) => i.status !== "resolu" && i.status !== "rejete").length;
    const critiques = incidents.filter((i) => i.priority === "urgent" && i.status !== "resolu" && i.status !== "rejete").length;
    const resolus = incidents.filter((i) => i.status === "resolu").length;
    const resolvedWithDates = incidents.filter((i) => i.status === "resolu" && i.resolved_date);
    const avgHours =
      resolvedWithDates.length > 0
        ? resolvedWithDates.reduce((sum, i) => sum + (new Date(i.resolved_date) - new Date(i.created_at)), 0) /
          resolvedWithDates.length /
          3_600_000
        : 0;
    return { active, critiques, resolus, avgHours: avgHours.toFixed(1) };
  }, [incidents]);

  const byType = useMemo(() => {
    const counts = {};
    incidents.forEach((i) => (counts[i.type] = (counts[i.type] || 0) + 1));
    return INCIDENT_TYPES.map((t) => ({ name: t.label, value: counts[t.value] || 0 })).filter((t) => t.value > 0);
  }, [incidents]);

  const buildingStats = useMemo(() => {
    return buildings.map((b) => ({
      ...b,
      active: incidents.filter((i) => i.building_id === b.id && i.status !== "resolu" && i.status !== "rejete").length,
    }));
  }, [buildings, incidents]);

  const recent = incidents.filter((i) => i.status !== "resolu" && i.status !== "rejete").slice(0, 5);

  const cards = [
    { label: "Incidents actifs", value: stats.active, icon: ListChecks, color: "text-primary" },
    { label: "Critiques", value: stats.critiques, icon: AlertTriangle, color: "text-status-urgent" },
    { label: "Résolus", value: stats.resolus, icon: CheckCircle2, color: "text-status-resolved" },
    { label: "Temps moyen (h)", value: stats.avgHours, icon: Clock, color: "text-status-in-progress" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble de la résidence.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
              <Icon className={`h-6 w-6 ${color}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Incidents actifs récents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.length === 0 && <p className="text-sm text-muted-foreground">Aucun incident actif.</p>}
            {recent.map((incident) => (
              <div key={incident.id} className="flex items-center gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                <IncidentTypeIcon type={incident.type} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{incident.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(incident.created_at)}</p>
                </div>
                <StatusBadge status={incident.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bâtiments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {buildingStats.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{b.name}</span>
                </div>
                <Badge variant={b.active > 2 ? "urgent" : b.active > 0 ? "in-progress" : "resolved"}>
                  {b.active} actif(s)
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incidents par type</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byType}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
