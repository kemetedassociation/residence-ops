import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Pencil, Trash2, X, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
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

const emptyForm = { menu_date: "", meal: "midi", items: [""] };

export function MenuManager() {
  const queryClient = useQueryClient();
  const { data: menus = [] } = useQuery({ queryKey: ["menus"], queryFn: () => api.get("/menus").then((d) => d.menus) });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [aggregateFor, setAggregateFor] = useState(null);

  const { data: aggregate = [] } = useQuery({
    queryKey: ["reservations", "aggregate", aggregateFor],
    queryFn: () => api.get(`/reservations?menu_id=${aggregateFor}`).then((d) => d.aggregate),
    enabled: !!aggregateFor,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["menus"] });
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(menu) {
    setEditing(menu);
    setForm({ menu_date: menu.menu_date, meal: menu.meal, items: menu.items });
    setOpen(true);
  }

  function updateItem(index, value) {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === index ? value : it)) }));
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, ""] }));
  }

  function removeItem(index) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, items: form.items.map((i) => i.trim()).filter(Boolean) };
    try {
      if (editing) await api.put(`/menus/${editing.id}`, payload);
      else await api.post("/menus", payload);
      toast.success(editing ? "Menu mis à jour." : "Menu publié.");
      setOpen(false);
      invalidate();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer ce menu ?")) return;
    await api.del(`/menus/${id}`);
    invalidate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion du restaurant</h1>
          <p className="text-sm text-muted-foreground">{menus.length} menu(s) publié(s)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nouveau menu
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier le menu" : "Nouveau menu"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    required
                    value={form.menu_date}
                    onChange={(e) => setForm({ ...form, menu_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Repas</Label>
                  <Select value={form.meal} onValueChange={(v) => setForm({ ...form, meal: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="midi">Midi</SelectItem>
                      <SelectItem value="soir">Soir</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Plats proposés</Label>
                {form.items.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={item} onChange={(e) => updateItem(i, e.target.value)} placeholder="Ex : Poulet basquaise" />
                    {form.items.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4" />
                  Ajouter un plat
                </Button>
              </div>
              <DialogFooter>
                <Button type="submit">{editing ? "Enregistrer" : "Publier"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {menus.map((menu) => (
          <Card key={menu.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <Badge variant="outline" className="mb-1">
                  {menu.meal === "midi" ? "Midi" : "Soir"}
                </Badge>
                <CardTitle className="text-base capitalize">
                  {format(new Date(menu.menu_date), "EEEE d MMMM", { locale: fr })}
                </CardTitle>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setAggregateFor(aggregateFor === menu.id ? null : menu.id)}>
                  <UtensilsCrossed className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(menu)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(menu.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {menu.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {aggregateFor === menu.id && (
                <div className="mt-3 rounded-lg bg-muted p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Réservations par plat</p>
                  {aggregate.length === 0 && <p className="text-xs text-muted-foreground">Aucune réservation.</p>}
                  {aggregate.map((a) => (
                    <div key={a.dish} className="flex items-center justify-between text-sm">
                      <span>{a.dish}</span>
                      <Badge variant="secondary">{a.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
