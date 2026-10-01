import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Plus, Trash2, Lock, Unlock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { PasswordInput } from "../../components/ui/password-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";

const EMPTY = { name: "", email: "", password: "", role: "manager", permissions: [] };

function PermissionPicker({ modules, myPermissions, value, onChange, full, onToggleFull }) {
  const canGrantFull = myPermissions === null; // seul un accès complet peut en accorder un autre
  return (
    <div className="space-y-2">
      {canGrantFull && (
        <label className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm font-medium">
          <input type="checkbox" checked={full} onChange={(e) => onToggleFull(e.target.checked)} />
          Accès complet (administrateur principal)
        </label>
      )}
      {!full && (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {modules.map((m) => {
            const allowed = myPermissions === null || myPermissions.includes(m.key);
            const checked = value.includes(m.key);
            return (
              <label
                key={m.key}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-2 text-xs",
                  !allowed && "cursor-not-allowed opacity-40",
                  checked ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <input
                  type="checkbox"
                  disabled={!allowed}
                  checked={checked}
                  onChange={(e) => onChange(e.target.checked ? [...value, m.key] : value.filter((k) => k !== m.key))}
                />
                {m.label}
              </label>
            );
          })}
        </div>
      )}
      {!canGrantFull && (
        <p className="text-xs text-muted-foreground">Vous ne pouvez accorder que des fonctionnalités que vous possédez vous-même.</p>
      )}
    </div>
  );
}

export function StaffAccess() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const { data: modulesData } = useQuery({ queryKey: ["staff-modules"], queryFn: () => api.get("/staff/modules") });
  const { data: staffData, isLoading } = useQuery({ queryKey: ["staff"], queryFn: () => api.get("/staff") });
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null); // { id } en édition de permissions
  const [full, setFull] = useState(false);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["staff"] });
    queryClient.invalidateQueries({ queryKey: ["staff-modules"] });
  };

  const modules = modulesData?.modules.filter((m) => m.key !== "gestion_comptes") || [];
  const allModules = modulesData?.modules || [];
  const myPermissions = modulesData?.my_permissions ?? null;

  function openCreate() {
    setEditing(null);
    setFull(false);
    setForm({ ...EMPTY });
  }
  function openEdit(s) {
    setEditing(s);
    setFull(s.permissions === null);
    setForm({ permissions: s.permissions || [] });
  }

  async function submit(e) {
    e.preventDefault();
    const permissions = full ? null : form.permissions;
    try {
      if (editing) {
        await api.patch(`/staff/${editing.id}/permissions`, { permissions });
        toast.success("Accès mis à jour.");
      } else {
        await api.post("/staff", { ...form, permissions });
        toast.success("Compte créé.");
      }
      setForm(null);
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function toggleSuspend(s) {
    try {
      await api.patch(`/staff/${s.id}/suspend`, { suspended: !s.is_suspended });
      toast.success(s.is_suspended ? "Accès réactivé." : "Compte suspendu : il perd l'accès immédiatement.");
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove(s) {
    if (!confirm(`Supprimer définitivement le compte de ${s.name} ?`)) return;
    try {
      await api.del(`/staff/${s.id}`);
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldCheck className="h-6 w-6" /> Équipe et accès
          </h1>
          <p className="text-sm text-muted-foreground">
            Créez un compte par personne et limitez-le à son domaine : un technicien n'a besoin que des incidents, un
            responsable loisirs que des loisirs. Personne ne peut accorder plus que ce qu'il possède lui-même.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nouveau compte
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      <div className="grid gap-3 lg:grid-cols-2">
        {(staffData?.staff || []).map((s) => (
          <Card key={s.id} className={s.is_suspended ? "opacity-60" : ""}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {s.name} {s.id === me?.id && <span className="text-xs text-muted-foreground">(vous)</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{s.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline">{s.role === "manager" ? "Gestionnaire" : "Technicien"}</Badge>
                  {s.is_suspended && <Badge variant="urgent">Suspendu</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.permissions === null ? (
                  <Badge variant="resolved">Accès complet</Badge>
                ) : s.permissions.length === 0 ? (
                  <Badge variant="outline">Aucun accès</Badge>
                ) : (
                  s.permissions.map((p) => (
                    <Badge key={p} variant="secondary">
                      {allModules.find((m) => m.key === p)?.label || p}
                    </Badge>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                  <Pencil className="h-3.5 w-3.5" /> Modifier l'accès
                </Button>
                {s.id !== me?.id && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => toggleSuspend(s)}>
                      {s.is_suspended ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      {s.is_suspended ? "Réactiver" : "Suspendre"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(s)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {staffData && staffData.staff.length === 0 && <p className="text-sm text-muted-foreground">Aucun compte pour l'instant.</p>}
      </div>

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Accès de ${editing.name}` : "Nouveau compte administrateur"}</DialogTitle>
            <DialogDescription>
              {editing ? "Ajustez les fonctionnalités accessibles à ce compte." : "Le compte sera limité aux fonctionnalités cochées."}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <form onSubmit={submit} className="space-y-4">
              {!editing && (
                <>
                  <div className="space-y-1.5">
                    <Label>Nom</Label>
                    <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail (sert à la connexion)</Label>
                    <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mot de passe (12 caractères minimum)</Label>
                    <PasswordInput required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rôle</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                    >
                      <option value="manager">Gestionnaire</option>
                      <option value="technicien">Technicien</option>
                    </select>
                  </div>
                </>
              )}
              <PermissionPicker
                modules={modules}
                myPermissions={myPermissions}
                value={form.permissions}
                onChange={(v) => setForm({ ...form, permissions: v })}
                full={full}
                onToggleFull={setFull}
              />
              <Button type="submit" className="w-full">
                {editing ? "Enregistrer" : "Créer le compte"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
