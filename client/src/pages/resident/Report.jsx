import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, AlertTriangle, Lock, Clock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Button } from "../../components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import { IncidentTypeIcon } from "../../components/IncidentTypeIcon";
import { RestrictedBanner } from "../../components/RestrictedBanner";
import { useAuth } from "../../context/AuthContext";
import { api, getToken } from "../../lib/api";
import { INCIDENT_TYPES, HERO_IMAGES, INCIDENT_PRIORITIES } from "../../lib/constants";
import { containsBadWords, censorText, getSuggestion } from "../../lib/profanity";
import { cn } from "../../lib/utils";

const MAX_PHOTOS = 6;

export function Report() {
  const { user } = useAuth();
  const hasLease = user?.lease_status === "verified";
  const isPending = user?.lease_status === "pending";
  const fileInputRef = useRef(null);

  const [buildings, setBuildings] = useState([]);
  const [form, setForm] = useState({ type: "", title: "", floor: "", building_id: "", description: "", priority: "normal" });
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [suggestion, setSuggestion] = useState("");

  useEffect(() => {
    api.get("/residences").then((d) => setBuildings(d.buildings));
  }, []);

  useEffect(() => {
    if (form.description && containsBadWords(form.description)) {
      setSuggestion(getSuggestion());
    } else {
      setSuggestion("");
    }
  }, [form.description]);

  function handlePhotoChange(e) {
    const files = Array.from(e.target.files || []).slice(0, MAX_PHOTOS - photos.length);
    const next = files.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPhotos((prev) => [...prev, ...next]);
    e.target.value = "";
  }

  function removePhoto(index) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const photo_urls = [];
      for (const { file } of photos) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/uploads", {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Échec de l'envoi de la photo.");
        photo_urls.push(data.url);
      }

      await api.post("/incidents", {
        ...form,
        description: censorText(form.description),
        photo_urls,
      });

      toast.success("Signalement envoyé avec succès.");
      setForm({ type: "", title: "", floor: "", building_id: "", description: "", priority: "normal" });
      setPhotos([]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const heroImage = HERO_IMAGES[form.type] || HERO_IMAGES.default;

  if (!hasLease) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <h1 className="text-xl font-bold">Signaler un incident</h1>
        <RestrictedBanner />
        <Card className="opacity-60">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            {isPending ? <Clock className="h-8 w-8 text-muted-foreground" /> : <Lock className="h-8 w-8 text-muted-foreground" />}
            <p className="text-sm text-muted-foreground">
              {isPending
                ? "Votre numéro de bail est en cours de vérification par la gestion. Vous pourrez signaler des incidents une fois validé."
                : "Cette section est verrouillée tant qu'un numéro de bail vérifié n'est pas associé à votre compte."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <motion.div
        key={form.type}
        initial={{ opacity: 0.6 }}
        animate={{ opacity: 1 }}
        className="relative flex h-48 items-end overflow-hidden"
        style={{ backgroundImage: `url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="absolute inset-0 hero-gradient opacity-80" />
        <div className="relative z-10 p-4 text-white">
          <h1 className="text-2xl font-bold">Signaler un incident</h1>
          <p className="text-sm opacity-90">Aidez-nous à maintenir la résidence en bon état.</p>
        </div>
      </motion.div>

      <div className="mx-auto max-w-lg space-y-5 px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="mb-2 block">Type d'incident</Label>
            <div className="grid grid-cols-5 gap-2">
              {INCIDENT_TYPES.map((t) => (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setForm({ ...form, type: t.value })}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all",
                    form.type === t.value ? "border-primary ring-2 ring-primary/30" : "border-border"
                  )}
                >
                  <IncidentTypeIcon type={t.value} size="sm" />
                  <span className="text-[11px] leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bâtiment</Label>
              <Select value={form.building_id} onValueChange={(v) => setForm({ ...form, building_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {buildings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="floor">Étage / lieu</Label>
              <Input id="floor" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="Ex : 2, RDC…" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Priorité</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex : Fuite d'eau sous l'évier"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={4}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Décrivez le problème le plus précisément possible…"
            />
            <AnimatePresence>
              {suggestion && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-xs text-amber-700"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{suggestion}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-1.5">
            <Label>Photos (optionnelles, {photos.length}/{MAX_PHOTOS})</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={p.preview} className="relative">
                  <img src={p.preview} alt="Aperçu" className="h-20 w-20 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground"
                >
                  <Camera className="h-5 w-5" />
                  <span className="text-[11px]">Ajouter</span>
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={submitting || !form.type || !form.building_id}>
            {submitting ? "Envoi…" : "Envoyer le signalement"}
          </Button>
        </form>
      </div>
    </div>
  );
}
