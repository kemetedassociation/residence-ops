import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { IncidentTypeIcon } from "../../components/IncidentTypeIcon";
import { StatusBadge } from "../../components/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import { IncidentActionSheet } from "../../components/IncidentActionSheet";
import { api } from "../../lib/api";
import { useRealtime } from "../../lib/socket";
import { INCIDENT_TYPES, INCIDENT_STATUSES, INCIDENT_PRIORITIES, labelFor, variantFor } from "../../lib/constants";
import { formatDate } from "../../lib/utils";

export function IncidentsList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => api.get("/incidents").then((d) => d.incidents),
  });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then((d) => d.users) });
  const { data: buildings = [] } = useQuery({
    queryKey: ["buildings"],
    queryFn: () => api.get("/residences").then((d) => d.buildings),
  });

  useRealtime(["incident:created", "incident:updated", "incident:deleted"], () => {
    queryClient.invalidateQueries({ queryKey: ["incidents"] });
  });

  const userName = (id) => users.find((u) => u.id === id)?.name || "—";
  const buildingName = (id) => buildings.find((b) => b.id === id)?.name || "—";
  const technicians = users.filter((u) => u.role === "technicien");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return incidents.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (typeFilter !== "all" && i.type !== typeFilter) return false;
      if (
        q &&
        !(
          i.title?.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          buildingName(i.building_id).toLowerCase().includes(q)
        )
      )
        return false;
      return true;
    });
  }, [incidents, statusFilter, typeFilter, search, buildings]);

  function handleUpdated(updated) {
    queryClient.invalidateQueries({ queryKey: ["incidents"] });
    setSelected(updated);
  }

  function handleDeleted() {
    queryClient.invalidateQueries({ queryKey: ["incidents"] });
    setSelected(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Incidents</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} incident(s)</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {INCIDENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead>
                <TableHead>Localisation</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Priorité</TableHead>
                <TableHead>Confirmations</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((incident) => (
                <TableRow key={incident.id} className="cursor-pointer" onClick={() => setSelected(incident)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <IncidentTypeIcon type={incident.type} size="sm" />
                      <div>
                        <p className="font-medium">{incident.title}</p>
                        <p className="text-xs text-muted-foreground">{userName(incident.reporter_id)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {buildingName(incident.building_id)} {incident.floor && `· Ét. ${incident.floor}`}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={incident.status} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={variantFor(INCIDENT_PRIORITIES, incident.priority)}>
                      {labelFor(INCIDENT_PRIORITIES, incident.priority)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{incident.confirmation_count || 0}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(incident.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selected && (
        <IncidentActionSheet
          incident={selected}
          buildingName={buildingName(selected.building_id)}
          reporterName={userName(selected.reporter_id)}
          technicians={technicians}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
