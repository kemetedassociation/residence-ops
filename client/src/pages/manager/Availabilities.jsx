import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addWeeks, isSameDay, format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { MonthCalendar } from "../../components/AvailabilityCalendar";
import { api } from "../../lib/api";

export function Availabilities() {
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: "", from: "09:00", to: "12:00", duration: 30, weeks: 1 });

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

  // Découpe la plage horaire (ex. 9h-12h) en créneaux de la durée choisie, éventuellement répétés chaque semaine.
  async function createRange(e) {
    e.preventDefault();
    const slotsToCreate = [];
    for (let w = 0; w < form.weeks; w++) {
      const rangeStart = addWeeks(new Date(`${form.date}T${form.from}:00`), w);
      const rangeEnd = addWeeks(new Date(`${form.date}T${form.to}:00`), w);
      for (let t = rangeStart.getTime(); t + form.duration * 60000 <= rangeEnd.getTime(); t += form.duration * 60000) {
        slotsToCreate.push({ start_at: new Date(t).toISOString(), end_at: new Date(t + form.duration * 60000).toISOString() });
      }
    }
    if (slotsToCreate.length === 0) return toast.error("La plage horaire est trop courte pour la durée choisie.");
    if (slotsToCreate.length > 100) return toast.error("Trop de créneaux d'un coup (100 maximum).");
    try {
      const { created, skipped } = await api.post("/availability-slots/bulk", { slots: slotsToCreate });
      toast.success(`${created} créneau(x) ajouté(s)${skipped ? `, ${skipped} ignoré(s) (passé ou déjà occupé)` : ""}.`);
      setOpen(false);
      setSelectedDay(new Date(`${form.date}T12:00:00`));
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
              Ajouter une plage horaire
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une plage de disponibilité</DialogTitle>
              <DialogDescription>Elle est découpée automatiquement en créneaux que les résidents réservent depuis le calendrier.</DialogDescription>
            </DialogHeader>
            <form onSubmit={createRange} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Jour</Label>
                <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>De</Label>
                  <Input type="time" required value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>À</Label>
                  <Input type="time" required value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Durée d'un rendez-vous</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  >
                    {[15, 20, 30, 45, 60].map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Répéter (semaines)</Label>
                  <Input type="number" min={1} max={12} value={form.weeks} onChange={(e) => setForm({ ...form, weeks: Number(e.target.value) })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Ajouter</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <MonthCalendar slots={slots} selectedDay={selectedDay} onSelectDay={setSelectedDay} />

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
