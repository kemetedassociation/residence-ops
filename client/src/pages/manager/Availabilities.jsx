import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { startOfWeek, addDays, isSameDay, format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";

export function Availabilities() {
  const queryClient = useQueryClient();
  const [weekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ start_at: "", end_at: "" });

  const { data: slots = [] } = useQuery({ queryKey: ["slots", "all"], queryFn: () => api.get("/availability-slots").then((d) => d.slots) });
  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments", "all"],
    queryFn: () => api.get("/appointments").then((d) => d.appointments),
  });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then((d) => d.users) });

  const userName = (id) => users.find((u) => u.id === id)?.name || "—";

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["slots", "all"] });
    queryClient.invalidateQueries({ queryKey: ["appointments", "all"] });
  }

  async function createSlot(e) {
    e.preventDefault();
    try {
      await api.post("/availability-slots", form);
      toast.success("Créneau ajouté.");
      setOpen(false);
      setForm({ start_at: "", end_at: "" });
      invalidate();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function deleteSlot(id) {
    try {
      await api.del(`/availability-slots/${id}`);
      invalidate();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const daySlots = slots.filter((s) => isSameDay(new Date(s.start_at), selectedDay));
  const appointmentFor = (slotId) => appointments.find((a) => a.slot_id === slotId && a.status === "confirme");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Disponibilités & rendez-vous</h1>
          <p className="text-sm text-muted-foreground">{slots.filter((s) => s.is_booked).length} rendez-vous réservé(s)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Ajouter un créneau
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau créneau de disponibilité</DialogTitle>
            </DialogHeader>
            <form onSubmit={createSlot} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Début</Label>
                <Input type="datetime-local" required value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Fin</Label>
                <Input type="datetime-local" required value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="submit">Ajouter</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => (
          <button
            key={day.toISOString()}
            onClick={() => setSelectedDay(day)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors",
              isSameDay(day, selectedDay) ? "border-primary bg-primary/5" : "border-border"
            )}
          >
            <span className="text-xs capitalize text-muted-foreground">{format(day, "EEE", { locale: fr })}</span>
            <span className="text-lg font-semibold">{format(day, "d")}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold capitalize text-muted-foreground">
          {format(selectedDay, "EEEE d MMMM", { locale: fr })}
        </h2>
        {daySlots.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aucun créneau ce jour.
          </p>
        )}
        {daySlots.map((slot) => {
          const appointment = appointmentFor(slot.id);
          return (
            <Card key={slot.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <CalendarClock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {format(new Date(slot.start_at), "HH:mm")} – {format(new Date(slot.end_at), "HH:mm")}
                    </p>
                    {appointment && (
                      <p className="text-sm text-muted-foreground">
                        {userName(appointment.resident_id)} {appointment.note && `— ${appointment.note}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={slot.is_booked ? "in-progress" : "secondary"}>{slot.is_booked ? "Réservé" : "Libre"}</Badge>
                  {!slot.is_booked && (
                    <Button variant="ghost" size="icon" onClick={() => deleteSlot(slot.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
