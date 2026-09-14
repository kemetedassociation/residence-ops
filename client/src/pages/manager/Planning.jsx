import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { startOfWeek, addDays, isSameDay, format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarClock, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { IncidentTypeIcon } from "../../components/IncidentTypeIcon";
import { api } from "../../lib/api";
import { useRealtime } from "../../lib/socket";
import { INTERVENTION_STATUSES, findMeta } from "../../lib/constants";
import { cn } from "../../lib/utils";

const STATUS_BAR = { planifiee: "#94a3b8", en_cours: "#f59e0b", terminee: "#10b981", annulee: "#ef4444" };

export function Planning() {
  const queryClient = useQueryClient();
  const [weekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ incident_id: "", technician_id: "", scheduled_date: "", notes: "" });

  const { data: interventions = [] } = useQuery({
    queryKey: ["interventions"],
    queryFn: () => api.get("/interventions").then((d) => d.interventions),
  });
  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => api.get("/incidents").then((d) => d.incidents),
  });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then((d) => d.users) });

  useRealtime(["intervention:created", "intervention:updated"], () => {
    queryClient.invalidateQueries({ queryKey: ["interventions"] });
    queryClient.invalidateQueries({ queryKey: ["incidents"] });
  });

  const technicians = users.filter((u) => u.role === "technicien");
  const openIncidents = incidents.filter((i) => i.status !== "resolu" && i.status !== "rejete");
  const incidentById = (id) => incidents.find((i) => i.id === id);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const dayInterventions = interventions.filter((iv) => isSameDay(new Date(iv.scheduled_date), selectedDay));

  function countFor(day) {
    return interventions.filter((iv) => isSameDay(new Date(iv.scheduled_date), day)).length;
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.post("/interventions", form);
      toast.success("Intervention planifiée.");
      setOpen(false);
      setForm({ incident_id: "", technician_id: "", scheduled_date: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function updateStatus(id, status) {
    await api.patch(`/interventions/${id}`, { status });
    queryClient.invalidateQueries({ queryKey: ["interventions"] });
    queryClient.invalidateQueries({ queryKey: ["incidents"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Planification</h1>
          <p className="text-sm text-muted-foreground">{interventions.length} intervention(s) cette période</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Nouvelle intervention
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Planifier une intervention</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Incident</Label>
                <Select value={form.incident_id} onValueChange={(v) => setForm({ ...form, incident_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un incident" />
                  </SelectTrigger>
                  <SelectContent>
                    {openIncidents.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Technicien</Label>
                <Select value={form.technician_id} onValueChange={(v) => setForm({ ...form, technician_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assigner" />
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
              <div className="space-y-1.5">
                <Label htmlFor="scheduled_date">Date prévue</Label>
                <Input
                  id="scheduled_date"
                  type="datetime-local"
                  required
                  value={form.scheduled_date}
                  onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!form.incident_id}>
                  Confirmer
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const count = countFor(day);
          const active = isSameDay(day, selectedDay);
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDay(day)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors",
                active ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              <span className="text-xs capitalize text-muted-foreground">{format(day, "EEE", { locale: fr })}</span>
              <span className="text-lg font-semibold">{format(day, "d")}</span>
              {count > 0 && (
                <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-medium text-primary">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold capitalize text-muted-foreground">
          {format(selectedDay, "EEEE d MMMM", { locale: fr })}
        </h2>
        {dayInterventions.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aucune intervention prévue ce jour.
          </p>
        )}
        {dayInterventions.map((iv) => {
          const incident = incidentById(iv.incident_id);
          return (
            <Card key={iv.id} className="overflow-hidden">
              <div className="flex">
                <div className="w-1.5 shrink-0" style={{ background: STATUS_BAR[iv.status] }} />
                <CardContent className="flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {incident ? <IncidentTypeIcon type={incident.type} /> : <CalendarClock className="h-10 w-10 text-muted-foreground" />}
                    <div>
                      <p className="font-medium">{incident?.title || "Intervention"}</p>
                      <p className="text-sm text-muted-foreground">
                        {iv.technician_name || "Non assigné"} · {format(new Date(iv.scheduled_date), "HH:mm")}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {iv.status !== "terminee" && iv.status !== "annulee" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(iv.id, "terminee")}>
                          Terminer
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(iv.id, "annulee")}>
                          Annuler
                        </Button>
                      </>
                    )}
                    {(iv.status === "terminee" || iv.status === "annulee") && (
                      <span className="text-xs font-medium" style={{ color: STATUS_BAR[iv.status] }}>
                        {findMeta(INTERVENTION_STATUSES, iv.status)?.label}
                      </span>
                    )}
                  </div>
                </CardContent>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
