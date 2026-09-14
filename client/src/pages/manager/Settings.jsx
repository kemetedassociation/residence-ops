import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Building2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { api, getToken } from "../../lib/api";

export function Settings() {
  const queryClient = useQueryClient();
  const { data: residences = [] } = useQuery({
    queryKey: ["residences"],
    queryFn: () => api.get("/residences").then((d) => d.residences),
  });
  const { data: buildings = [] } = useQuery({
    queryKey: ["buildings"],
    queryFn: () => api.get("/residences").then((d) => d.buildings),
  });
  const residence = residences[0];

  const [residenceForm, setResidenceForm] = useState(null);
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState(null);
  const [buildingForm, setBuildingForm] = useState({ name: "", floors: 1 });
  const [brandingForm, setBrandingForm] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["residences"] });
    queryClient.invalidateQueries({ queryKey: ["buildings"] });
  }

  function startEditResidence() {
    setResidenceForm({
      name: residence.name,
      address: residence.address || "",
      city: residence.city || "",
      latitude: residence.latitude,
      longitude: residence.longitude,
    });
  }

  async function saveResidence(e) {
    e.preventDefault();
    try {
      await api.put(`/residences/${residence.id}`, {
        ...residenceForm,
        latitude: Number(residenceForm.latitude),
        longitude: Number(residenceForm.longitude),
      });
      toast.success("Résidence mise à jour.");
      setResidenceForm(null);
      invalidate();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function openCreateBuilding() {
    setEditingBuilding(null);
    setBuildingForm({ name: "", floors: 1 });
    setBuildingOpen(true);
  }

  function openEditBuilding(b) {
    setEditingBuilding(b);
    setBuildingForm({ name: b.name, floors: b.floors });
    setBuildingOpen(true);
  }

  async function submitBuilding(e) {
    e.preventDefault();
    try {
      const payload = { ...buildingForm, floors: Number(buildingForm.floors) };
      if (editingBuilding) await api.put(`/buildings/${editingBuilding.id}`, payload);
      else await api.post("/buildings", payload);
      toast.success(editingBuilding ? "Bâtiment mis à jour." : "Bâtiment ajouté.");
      setBuildingOpen(false);
      invalidate();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function deleteBuilding(id) {
    if (!confirm("Supprimer ce bâtiment ?")) return;
    try {
      await api.del(`/buildings/${id}`);
      invalidate();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function startEditBranding() {
    setBrandingForm({
      display_name: residence.display_name || "",
      logo_url: residence.logo_url || "",
      primary_color: residence.primary_color || "#2563eb",
    });
  }

  async function saveBranding(e) {
    e.preventDefault();
    try {
      await api.put(`/residences/${residence.id}`, brandingForm);
      toast.success("Marque mise à jour.");
      setBrandingForm(null);
      invalidate();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'envoi du logo.");
      setBrandingForm((f) => ({ ...f, logo_url: data.url }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingLogo(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres de la résidence</h1>
        <p className="text-sm text-muted-foreground">Informations générales et bâtiments.</p>
      </div>

      {residence && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Résidence</CardTitle>
          </CardHeader>
          <CardContent>
            {residenceForm ? (
              <form onSubmit={saveResidence} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nom</Label>
                  <Input value={residenceForm.name} onChange={(e) => setResidenceForm({ ...residenceForm, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Adresse</Label>
                  <Input
                    value={residenceForm.address}
                    onChange={(e) => setResidenceForm({ ...residenceForm, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Ville</Label>
                    <Input value={residenceForm.city} onChange={(e) => setResidenceForm({ ...residenceForm, city: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={residenceForm.latitude}
                      onChange={(e) => setResidenceForm({ ...residenceForm, latitude: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={residenceForm.longitude}
                      onChange={(e) => setResidenceForm({ ...residenceForm, longitude: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Enregistrer</Button>
                  <Button type="button" variant="ghost" onClick={() => setResidenceForm(null)}>
                    Annuler
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{residence.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {residence.address}, {residence.city}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {residence.latitude}, {residence.longitude}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={startEditResidence}>
                  <Pencil className="h-4 w-4" />
                  Modifier
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {residence && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Marque
            </CardTitle>
            <Badge variant={residence.plan === "premium" ? "resolved" : "secondary"}>
              {residence.plan === "premium" ? "Premium" : "Standard"}
            </Badge>
          </CardHeader>
          <CardContent>
            {residence.plan !== "premium" ? (
              <p className="text-sm text-muted-foreground">
                La personnalisation de l'identité (nom affiché, logo, couleur) est réservée à l'offre Premium.
                Contactez l'équipe Résidence Ops pour l'activer sur votre résidence.
              </p>
            ) : brandingForm ? (
              <form onSubmit={saveBranding} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nom affiché</Label>
                  <Input
                    placeholder={residence.name}
                    value={brandingForm.display_name}
                    onChange={(e) => setBrandingForm({ ...brandingForm, display_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-3">
                    {brandingForm.logo_url && (
                      <img src={brandingForm.logo_url} alt="Logo" className="h-12 w-12 rounded-lg object-cover" />
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                      <Upload className="h-4 w-4" />
                      {uploadingLogo ? "Envoi…" : "Choisir un logo"}
                    </Button>
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Couleur principale</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      className="h-10 w-14 cursor-pointer rounded border border-input"
                      value={brandingForm.primary_color}
                      onChange={(e) => setBrandingForm({ ...brandingForm, primary_color: e.target.value })}
                    />
                    <span className="text-sm text-muted-foreground">{brandingForm.primary_color}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Enregistrer</Button>
                  <Button type="button" variant="ghost" onClick={() => setBrandingForm(null)}>
                    Annuler
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {residence.logo_url && (
                    <img src={residence.logo_url} alt="Logo" className="h-10 w-10 rounded-lg object-cover" />
                  )}
                  <div>
                    <p className="font-medium">{residence.display_name || residence.name}</p>
                    {residence.primary_color && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-3 w-3 rounded-full border" style={{ background: residence.primary_color }} />
                        {residence.primary_color}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={startEditBranding}>
                  <Pencil className="h-4 w-4" />
                  Modifier
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Bâtiments</CardTitle>
          <Dialog open={buildingOpen} onOpenChange={setBuildingOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreateBuilding}>
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingBuilding ? "Modifier le bâtiment" : "Nouveau bâtiment"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={submitBuilding} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nom</Label>
                  <Input required value={buildingForm.name} onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nombre d'étages</Label>
                  <Input
                    type="number"
                    min={1}
                    required
                    value={buildingForm.floors}
                    onChange={(e) => setBuildingForm({ ...buildingForm, floors: e.target.value })}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">{editingBuilding ? "Enregistrer" : "Ajouter"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2">
          {buildings.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.floors} étages</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEditBuilding(b)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteBuilding(b.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
