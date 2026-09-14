import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, Award, ListChecks, CheckCircle2, Clock, FileDown, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Separator } from "../../components/ui/separator";
import { Progress } from "../../components/ui/progress";
import { ThemeSwitcher } from "../../components/ThemeSwitcher";
import { StatusBadge } from "../../components/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { PushNotificationToggle } from "../../components/PushNotificationToggle";
import { useAuth } from "../../context/AuthContext";
import { api, getToken } from "../../lib/api";
import { formatDate } from "../../lib/utils";
import { LEASE_STATUSES, labelFor, variantFor } from "../../lib/constants";

function reliabilityTier(ratio) {
  if (ratio >= 0.7) return { label: "Expert", color: "#10b981" };
  if (ratio >= 0.35) return { label: "Actif", color: "#f59e0b" };
  return { label: "Débutant", color: "#94a3b8" };
}

export function Profile() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    room: user?.room || "",
    lease_number: user?.lease_number || "",
  });
  const [saving, setSaving] = useState(false);

  const { data: myIncidents = [] } = useQuery({
    queryKey: ["incidents", "mine"],
    queryFn: () => api.get("/incidents?mine=true").then((d) => d.incidents),
  });

  const stats = useMemo(() => {
    const total = myIncidents.length;
    const resolved = myIncidents.filter((i) => i.status === "resolu").length;
    const enCours = myIncidents.filter((i) => i.status === "en_cours" || i.status === "confirme").length;
    const ratio = total > 0 ? resolved / total : 0;
    return { total, resolved, enCours, ratio, tier: reliabilityTier(ratio) };
  }, [myIncidents]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/users/me", form);
      await refresh();
      toast.success("Profil mis à jour.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/select");
  }

  async function handleExport() {
    try {
      const res = await fetch("/api/privacy/export", { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error("Échec de l'export.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mes-donnees-residence-ops.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDeleteAccount() {
    if (!confirm("Anonymiser définitivement votre compte ? Cette action est irréversible.")) return;
    try {
      const data = await api.del("/privacy");
      toast.success(data.message);
      logout();
      navigate("/select");
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 text-xl">
          <AvatarFallback>{(user?.name || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-lg font-bold">{user?.name}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Award className="h-4 w-4" style={{ color: stats.tier.color }} />
              Score de fiabilité
            </span>
            <span className="text-sm font-semibold" style={{ color: stats.tier.color }}>
              {stats.tier.label}
            </span>
          </div>
          <Progress value={stats.ratio * 100} indicatorClassName="" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <ListChecks className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
              <p className="font-bold">{stats.total}</p>
              <p className="text-[11px] text-muted-foreground">Signalés</p>
            </div>
            <div>
              <Clock className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
              <p className="font-bold">{stats.enCours}</p>
              <p className="text-[11px] text-muted-foreground">En cours</p>
            </div>
            <div>
              <CheckCircle2 className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
              <p className="font-bold">{stats.resolved}</p>
              <p className="text-[11px] text-muted-foreground">Résolus</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {myIncidents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mes signalements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myIncidents.slice(0, 5).map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{i.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(i.created_at)}</p>
                </div>
                <StatusBadge status={i.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mes informations</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room">Chambre</Label>
              <Input id="room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="lease">Numéro de bail</Label>
                <Badge variant={variantFor(LEASE_STATUSES, user?.lease_status)}>
                  {labelFor(LEASE_STATUSES, user?.lease_status)}
                </Badge>
              </div>
              <Input
                id="lease"
                value={form.lease_number}
                onChange={(e) => setForm({ ...form, lease_number: e.target.value })}
                placeholder="BAIL-2025-XXXX"
              />
              <p className="text-xs text-muted-foreground">
                Une fois renseigné, la gestion doit vérifier votre bail avant de débloquer le signalement d'incidents.
              </p>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <ThemeSwitcher />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <PushNotificationToggle />
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Retrouvez Ma carte, Restaurant, Administration, Loisirs, la Boîte à idées et l'installation de l'app depuis le
        bouton ✨ en bas de l'écran.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mes données</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Conformément au RGPD, vous pouvez télécharger toutes vos données ou demander leur effacement. Voir la{" "}
            <Link to="/confidentialite" className="text-primary underline-offset-4 hover:underline">
              politique de confidentialité
            </Link>
            .
          </p>
          <Button variant="outline" className="w-full" onClick={handleExport}>
            <FileDown className="h-4 w-4" />
            Télécharger mes données
          </Button>
          <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={handleDeleteAccount}>
            <Trash2 className="h-4 w-4" />
            Supprimer mon compte
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Button variant="outline" className="w-full" onClick={handleLogout}>
        <LogOut className="h-4 w-4" />
        Se déconnecter
      </Button>
    </div>
  );
}
