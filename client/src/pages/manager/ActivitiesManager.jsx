import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { api } from "../../lib/api";
import { ACTIVITY_CATEGORIES, findMeta } from "../../lib/constants";

const emptyForm = {
  title: "",
  description: "",
  category: "autre",
  activity_date: "",
  start_time: "",
  end_time: "",
  location: "",
};

export function ActivitiesManager() {
  const queryClient = useQueryClient();
  const { data: activities = [] } = useQuery({ queryKey: ["activities"], queryFn: () => api.get("/activities").then((d) => d.activities) });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["activities"] });
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(activity) {
    setEditing(activity);
    setForm({ ...activity, end_time: activity.end_time || "" });
    setOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = { ...form, end_time: form.end_time || null };
      if (editing) await api.put(`/activities/${editing.id}`, payload);
      else await api.post("/activities", payload);
      toast.success(editing ? "Activité mise à jour." : "Activité publiée.");
      setOpen(false);
      invalidate();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cette activité ?")) return;
    await api.del(`/activities/${id}`);
    invalidate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des loisirs</h1>
          <p className="text-sm text-muted-foreground">{activities.length} activité(s) planifiée(s)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nouvelle activité
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier l'activité" : "Nouvelle activité"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Titre</Label>
                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" required value={form.activity_date} onChange={(e) => setForm({ ...form, activity_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Début</Label>
                  <Input type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fin</Label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Lieu</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ex : Salle commune" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="submit">{editing ? "Enregistrer" : "Publier"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {activities.map((activity) => {
          const category = findMeta(ACTIVITY_CATEGORIES, activity.category);
          return (
            <Card key={activity.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <Badge variant="outline" style={{ borderColor: category?.color, color: category?.color }} className="mb-1">
                    {category?.label}
                  </Badge>
                  <CardTitle className="text-base">{activity.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(activity.activity_date), "EEEE d MMMM", { locale: fr })} · {activity.start_time}
                    {activity.end_time && ` – ${activity.end_time}`}
                    {activity.location && ` · ${activity.location}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(activity)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(activity.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              {activity.description && <CardContent className="text-sm text-muted-foreground">{activity.description}</CardContent>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
