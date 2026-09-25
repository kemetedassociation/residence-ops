import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartHandshake, Plus, Copy, ShieldCheck, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { api } from "../../lib/api";
import { MODE_LABELS } from "../../lib/care";

const EMPTY = { name: "", title: "", specialties: "", languages: "Français", bio: "", phone: "", email: "", address: "", mode: "les_deux", free: true };
const list = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function CareProfessionals() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["care-manage"], queryFn: () => api.get("/care/manage/professionals") });
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [invite, setInvite] = useState(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["care-manage"] });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function openEdit(p) {
    setEditingId(p.id);
    setForm({ ...p, specialties: p.specialties.join(", "), languages: p.languages.join(", ") });
  }

  async function save(e) {
    e.preventDefault();
    const body = { ...form, specialties: list(form.specialties), languages: list(form.languages) };
    delete body.id; delete body.claimed; delete body.open_slots; delete body.appointments_total; delete body.appointments_upcoming; delete body.active;
    try {
      if (editingId) {
        await api.patch(`/care/manage/professionals/${editingId}`, body);
        toast.success("Fiche mise à jour.");
      } else {
        const res = await api.post("/care/manage/professionals", body);
        setInvite({ name: res.professional.name, code: res.invite_code });
      }
      setForm(null);
      setEditingId(null);
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function reinvite(p) {
    try {
      const { invite_code } = await api.post(`/care/manage/professionals/${p.id}/invite`, {});
      setInvite({ name: p.name, code: invite_code });
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function toggle(p) {
    await api.patch(`/care/manage/professionals/${p.id}`, { active: !p.active });
    refresh();
  }

  async function remove(p) {
    if (!confirm(`Supprimer ${p.name} ? Ses rendez-vous seront annulés et les résidents prévenus.`)) return;
    await api.del(`/care/manage/professionals/${p.id}`);
    refresh();
  }

  const inviteUrl = invite ? `${window.location.origin}/psy?invite=${invite.code}` : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <HeartHandshake className="h-6 w-6" /> Accompagnement psychologique
          </h1>
          <p className="text-sm text-muted-foreground">Annuaire des professionnels proposés aux résidents (bouton « Besoin d'aide »).</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(EMPTY); }}>
          <Plus className="h-4 w-4" /> Ajouter un professionnel
        </Button>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-status-resolved" />
        <span>
          <b>Confidentialité :</b> vous gérez uniquement l'annuaire. Chaque professionnel active lui-même son accès (via une invitation à usage unique) et
          seul lui voit son agenda et l'identité de ses consultants. Vous ne voyez ici que des compteurs anonymes.
        </span>
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {(data?.professionals || []).map((p) => (
          <Card key={p.id} className={p.active ? "" : "opacity-60"}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{p.title}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={p.claimed ? "resolved" : "in-progress"}>{p.claimed ? "Accès activé" : "En attente d'activation"}</Badge>
                  {!p.active && <Badge variant="outline">Masqué</Badge>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {MODE_LABELS[p.mode]} · {p.email} · {p.open_slots} créneau(x) libre(s) · {p.appointments_upcoming} rendez-vous à venir
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </Button>
                {!p.claimed && (
                  <Button size="sm" variant="outline" onClick={() => reinvite(p)}>
                    Nouvelle invitation
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => toggle(p)}>
                  {p.active ? "Masquer" : "Afficher"}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {data && data.professionals.length === 0 && <p className="text-sm text-muted-foreground">Aucun professionnel pour l'instant.</p>}
      </div>

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier la fiche" : "Nouveau professionnel"}</DialogTitle>
            <DialogDescription>Ces informations sont visibles de tous les résidents, avec l'accord du professionnel.</DialogDescription>
          </DialogHeader>
          {form && (
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-1.5"><Label>Nom</Label><Input required value={form.name} onChange={set("name")} /></div>
              <div className="space-y-1.5"><Label>Titre</Label><Input required placeholder="Psychologue clinicien, médecin généraliste…" value={form.title} onChange={set("title")} /></div>
              <div className="space-y-1.5"><Label>Spécialités (séparées par des virgules)</Label><Input placeholder="Dépression, anxiété, sommeil" value={form.specialties} onChange={set("specialties")} /></div>
              <div className="space-y-1.5"><Label>Langues (séparées par des virgules)</Label><Input value={form.languages} onChange={set("languages")} /></div>
              <div className="space-y-1.5"><Label>Présentation</Label><Textarea rows={3} value={form.bio} onChange={set("bio")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>E-mail (sert aussi à la connexion)</Label><Input type="email" required value={form.email} onChange={set("email")} /></div>
                <div className="space-y-1.5"><Label>Téléphone</Label><Input value={form.phone} onChange={set("phone")} /></div>
              </div>
              <div className="space-y-1.5"><Label>Adresse du cabinet / lieu</Label><Input value={form.address} onChange={set("address")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Mode</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.mode} onChange={set("mode")}>
                    {Object.entries(MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <label className="mt-6 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.free} onChange={(e) => setForm({ ...form, free: e.target.checked })} /> Gratuit pour les résidents
                </label>
              </div>
              <Button type="submit" className="w-full">{editingId ? "Enregistrer" : "Créer et générer l'invitation"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!invite} onOpenChange={(v) => !v && setInvite(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitation pour {invite?.name}</DialogTitle>
            <DialogDescription>
              Transmettez ce lien au professionnel (message privé, en main propre…). Il est valable 14 jours et à usage unique : il choisira lui-même son mot
              de passe. <b>Il ne sera plus jamais affiché.</b>
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg bg-muted p-2">
            <code className="min-w-0 flex-1 break-all text-xs">{inviteUrl}</code>
            <button onClick={() => { navigator.clipboard?.writeText(inviteUrl); toast.success("Lien copié."); }} aria-label="Copier"><Copy className="h-4 w-4" /></button>
          </div>
          <Button onClick={() => setInvite(null)}>J'ai transmis le lien</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
