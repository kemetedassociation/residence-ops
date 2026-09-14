import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { subMonths, format, isSameMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { api } from "../../lib/api";
import { INCIDENT_TYPES, findMeta } from "../../lib/constants";

const TYPE_COLORS = { eau: "#2563eb", electricite: "#eab308", securite: "#ef4444", bruit: "#a855f7", autre: "#f97316" };

export function Analytics() {
  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => api.get("/incidents").then((d) => d.incidents),
  });
  const { data: interventions = [] } = useQuery({
    queryKey: ["interventions"],
    queryFn: () => api.get("/interventions").then((d) => d.interventions),
  });
  const { data: buildings = [] } = useQuery({
    queryKey: ["buildings"],
    queryFn: () => api.get("/residences").then((d) => d.buildings),
  });

  const byType = useMemo(() => {
    const counts = {};
    incidents.forEach((i) => (counts[i.type] = (counts[i.type] || 0) + 1));
    return INCIDENT_TYPES.map((t) => ({ name: t.label, value: counts[t.value] || 0, key: t.value })).filter((t) => t.value > 0);
  }, [incidents]);

  const monthlyTrend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
    return months.map((month) => ({
      month: format(month, "MMM", { locale: fr }),
      value: incidents.filter((i) => isSameMonth(new Date(i.created_at), month)).length,
    }));
  }, [incidents]);

  const byBuilding = useMemo(() => {
    return buildings
      .map((b) => ({ name: b.name, value: incidents.filter((i) => i.building_id === b.id).length }))
      .sort((a, b) => b.value - a.value);
  }, [buildings, incidents]);

  const avgResolutionHours = useMemo(() => {
    const resolved = incidents.filter((i) => i.status === "resolu" && i.resolved_date);
    if (resolved.length === 0) return 0;
    const total = resolved.reduce((sum, i) => sum + (new Date(i.resolved_date) - new Date(i.created_at)), 0);
    return (total / resolved.length / 3_600_000).toFixed(1);
  }, [incidents]);

  const terminees = interventions.filter((iv) => iv.status === "terminee").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Statistiques globales de la résidence.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total incidents</p>
            <p className="text-2xl font-bold">{incidents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Résolus</p>
            <p className="text-2xl font-bold">{incidents.filter((i) => i.status === "resolu").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Temps moyen (h)</p>
            <p className="text-2xl font-bold">{avgResolutionHours}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Interventions terminées</p>
            <p className="text-2xl font-bold">{terminees}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tendance mensuelle</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par type</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byType} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {byType.map((entry) => (
                    <Cell key={entry.key} fill={TYPE_COLORS[entry.key]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zones problématiques par bâtiment</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byBuilding} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
