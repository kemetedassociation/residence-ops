import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Pencil, Trash2, X, Leaf } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
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
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { api } from "../../lib/api";
import { useRealtime } from "../../lib/socket";

const emptyForm = { menu_date: "", meal: "midi", items: [{ name: "", max_portions: "" }] };

export function MenuManager() {
  const queryClient = useQueryClient();
  const { data: menus = [] } = useQuery({ queryKey: ["menus"], queryFn: () => api.get("/menus").then((d) => d.menus) });
  const { data: wasteStats } = useQuery({
    queryKey: ["waste-logs", "stats"],
    queryFn: () => api.get("/waste-logs/stats"),
  });

  useRealtime(["menu:stock-updated"], () => queryClient.invalidateQueries({ queryKey: ["menus"] }));

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [wasteDialog, setWasteDialog] = useState(null); // { menu, item }
  const [savedInput, setSavedInput] = useState("");

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
    setForm({
      menu_date: menu.menu_date,
      meal: menu.meal,
      items: menu.items.map((it) => ({ name: it.name, max_portions: it.max_portions ?? "" })),
    });
    setOpen(true);
  }

  function updateItem(index, field, value) {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === index ? { ...it, [field]: value } : it)) }));
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { name: "", max_portions: "" }] }));
  }

  function removeItem(index) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      items: form.items
        .map((it) => ({
          name: it.name.trim(),
          max_portions: it.max_portions ? Number(it.max_portions) : undefined,
        }))
        .filter((it) => it.name),
    };
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

  function openWasteDialog(menu, item) {
    setWasteDialog({ menu, item });
    setSavedInput("");
  }

  async function submitWasteLog(e) {
    e.preventDefault();
    const { menu, item } = wasteDialog;
    try {
      await api.post("/waste-logs", { menu_id: menu.id, dish: item.name, saved: Number(savedInput) || 0 });
      toast.success("Bilan anti-gaspillage enregistré.");
      setWasteDialog(null);
      queryClient.invalidateQueries({ queryKey: ["waste-logs", "stats"] });
      invalidate();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const wasteRemaining = wasteDialog?.item.remaining ?? 0;
  const wasteSavedNum = Math.min(wasteRemaining, Math.max(0, Number(savedInput) || 0));
  const wasteLostComputed = Math.max(0, wasteRemaining - wasteSavedNum);

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
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(i, "name", e.target.value)}
                      placeholder="Ex : Poulet basquaise"
                    />
                    <Input
                      type="number"
                      min={1}
                      className="w-36"
                      value={item.max_portions}
                      onChange={(e) => updateItem(i, "max_portions", e.target.value)}
                      placeholder="Portions (facultatif)"
                    />
                    {form.items.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Indiquez un nombre de portions préparées pour bloquer les réservations une fois le plat épuisé
                  (anti-gaspillage) — laissez vide pour un plat en quantité illimitée.
                </p>
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

      {wasteStats && (wasteStats.total_saved > 0 || wasteStats.total_lost > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Leaf className="h-4 w-4 text-status-resolved" />
              Anti-gaspillage
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-6">
            <div className="flex gap-6">
              <div>
                <p className="text-2xl font-bold text-status-resolved">{wasteStats.total_saved}</p>
                <p className="text-xs text-muted-foreground">Portions sauvées</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-status-urgent">{wasteStats.total_lost}</p>
                <p className="text-xs text-muted-foreground">Portions perdues</p>
              </div>
              {wasteStats.rate != null && (
                <div>
                  <p className="text-2xl font-bold">{Math.round(wasteStats.rate * 100)}%</p>
                  <p className="text-xs text-muted-foreground">Taux de sauvegarde</p>
                </div>
              )}
            </div>
            <div className="h-32 w-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Sauvé", value: wasteStats.total_saved },
                      { name: "Perdu", value: wasteStats.total_lost },
                    ]}
                    dataKey="value"
                    innerRadius={28}
                    outerRadius={48}
                  >
                    <Cell fill="#22c55e" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

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
                <Button variant="ghost" size="icon" onClick={() => openEdit(menu)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(menu.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="space-y-1.5">
                {menu.items.map((item) => (
                  <li key={item.name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.name}</span>
                    {item.max_portions != null && (
                      <div className="flex items-center gap-2">
                        <Badge variant={item.remaining <= 0 ? "urgent" : "secondary"}>
                          {item.reserved}/{item.max_portions}
                          {item.remaining <= 0 ? " — complet" : ` · ${item.remaining} restant(s)`}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => openWasteDialog(menu, item)}>
                          <Leaf className="h-3.5 w-3.5" /> Bilan
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!wasteDialog} onOpenChange={(v) => !v && setWasteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bilan anti-gaspillage — {wasteDialog?.item.name}</DialogTitle>
            <DialogDescription>
              Indiquez combien de portions restantes ont été sauvées (données, revendues à prix réduit...). Le
              reste sera compté comme perdu, automatiquement.
            </DialogDescription>
          </DialogHeader>
          {wasteDialog && (
            <form onSubmit={submitWasteLog} className="space-y-4">
              <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted p-3 text-center text-sm">
                <div>
                  <p className="font-semibold">{wasteDialog.item.max_portions}</p>
                  <p className="text-xs text-muted-foreground">Préparé</p>
                </div>
                <div>
                  <p className="font-semibold">{wasteDialog.item.reserved}</p>
                  <p className="text-xs text-muted-foreground">Réservé</p>
                </div>
                <div>
                  <p className="font-semibold">{wasteRemaining}</p>
                  <p className="text-xs text-muted-foreground">Restant</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Portions sauvées</Label>
                <Input
                  type="number"
                  min={0}
                  max={wasteRemaining}
                  value={savedInput}
                  onChange={(e) => setSavedInput(e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Perdu (calculé automatiquement) : <span className="font-semibold text-status-urgent">{wasteLostComputed}</span>
              </p>
              <DialogFooter>
                <Button type="submit">Enregistrer le bilan</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
