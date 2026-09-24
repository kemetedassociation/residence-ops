import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, AlertTriangle, Lock, Clock, ChevronLeft, ChevronRight, Check, FileText, Users, Paperclip } from "lucide-react";
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
import { api } from "../../lib/api";
import { uploadPrivateFile } from "../../lib/files";
import { INCIDENT_TYPES, HERO_IMAGES, INCIDENT_PRIORITIES, labelFor } from "../../lib/constants";
import { containsBadWords, censorText, getSuggestion } from "../../lib/profanity";
import { cn } from "../../lib/utils";

const MAX_PHOTOS = 6;
const ATTACHMENT_ACCEPT = "image/*,.pdf,.heic,.heif";
const VISIBILITY_OPTIONS = [
  { value: "private", icon: Lock, title: "Réservé à la gestion", hint: "Seuls la gestion et le technicien voient vos pièces jointes (recommandé)." },
  { value: "public", icon: Users, title: "Visible par les résidents", hint: "Les résidents de la résidence peuvent aussi les voir." },
];
const STEPS = ["Type et lieu", "Détails", "Photos", "Récapitulatif"];

export function Report() {
  const { user } = useAuth();
  const hasLease = user?.lease_status === "verified";
  const isPending = user?.lease_status === "pending";
  const fileInputRef = useRef(null);

  const [buildings, setBuildings] = useState([]);
  const [form, setForm] = useState({ type: "", title: "", floor: "", building_id: "", description: "", priority: "normal" });
  const [photos, setPhotos] = useState([]);
  const [visibility, setVisibility] = useState("private");
  const [submitting, setSubmitting] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [step, setStep] = useState(0);
  const [sent, setSent] = useState(false);

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
    const next = files.map((file) => ({ file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null }));
    setPhotos((prev) => [...prev, ...next]);
    e.target.value = "";
  }

  function removePhoto(index) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (step < STEPS.length - 1) {
      if (canContinue) {
        setSent(false);
        setStep(step + 1);
      }
      return;
    }
    setSubmitting(true);
    try {
      // Envois en parallèle, vers le stockage sécurisé (photos ET documents PDF) : l'accès est ensuite
      // contrôlé selon le choix de visibilité du résident.
      const photo_urls = (await Promise.all(photos.map(({ file }) => uploadPrivateFile(file)))).map((f) => f.url);

      await api.post("/incidents", {
        ...form,
        description: censorText(form.description),
        photo_urls,
        photos_visibility: visibility,
      });

      toast.success("Signalement envoyé avec succès.");
      setForm({ type: "", title: "", floor: "", building_id: "", description: "", priority: "normal" });
      setPhotos([]);
      setVisibility("private");
      setStep(0);
      setSent(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const heroImage = HERO_IMAGES[form.type] || HERO_IMAGES.default;
  const canContinue =
    step === 0 ? !!form.type && !!form.building_id : step === 1 ? form.description.trim().length >= 5 : true;
  const buildingName = buildings.find((b) => b.id === form.building_id)?.name;

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
        {sent && (
          <div className="flex items-start gap-3 rounded-xl border border-status-resolved/30 bg-status-resolved/10 p-4 text-sm">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-status-resolved" />
            <div>
              <p className="font-semibold">Signalement envoyé !</p>
              <p className="text-muted-foreground">
                Vous pouvez suivre son avancement depuis l'accueil (Suivi des signalements) ou votre profil.
              </p>
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{STEPS[step]}</span>
            <span>
              Étape {step + 1} sur {STEPS.length}
            </span>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((label, i) => (
              <div key={label} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")} />
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 0 && (
            <>
              <div>
                <Label className="mb-2 block">Type d'incident</Label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {INCIDENT_TYPES.map((t) => (
                    <button
                      type="button"
                      key={t.value}
                      onClick={() => setForm({ ...form, type: t.value })}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all active:scale-95",
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
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label>Priorité</Label>
                <div className="grid grid-cols-3 gap-2">
                  {INCIDENT_PRIORITIES.map((p) => (
                    <button
                      type="button"
                      key={p.value}
                      onClick={() => setForm({ ...form, priority: p.value })}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-sm font-medium transition-all active:scale-95",
                        form.priority === p.value
                          ? p.value === "urgent"
                            ? "border-status-urgent bg-status-urgent/10 text-status-urgent"
                            : "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="title">Titre (optionnel)</Label>
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
                  rows={5}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Décrivez le problème le plus précisément possible (5 caractères minimum)…"
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
            </>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>
                  Photos et documents (optionnels, {photos.length}/{MAX_PHOTOS})
                </Label>
                <p className="text-xs text-muted-foreground">
                  Photos, PDF (constat, devis, courrier…) : 10 Mo maximum par fichier.
                </p>
                <div className="flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <div key={`${p.file.name}-${i}`} className="relative">
                      {p.preview ? (
                        <img src={p.preview} alt="Aperçu" className="h-20 w-20 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-muted p-1 text-center">
                          <FileText className="h-6 w-6 text-primary" />
                          <span className="w-full truncate text-[10px] text-muted-foreground">{p.file.name}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                        aria-label="Retirer"
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
                      <Paperclip className="h-5 w-5" />
                      <span className="text-[11px]">Ajouter</span>
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept={ATTACHMENT_ACCEPT} multiple className="hidden" onChange={handlePhotoChange} />
              </div>

              {photos.length > 0 && (
                <div className="space-y-2">
                  <Label>Qui peut voir ces pièces jointes ?</Label>
                  <div className="space-y-2">
                    {VISIBILITY_OPTIONS.map(({ value, icon: Icon, title, hint }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setVisibility(value)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                          visibility === value ? "border-primary bg-primary/10" : "border-border"
                        )}
                      >
                        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", visibility === value ? "text-primary" : "text-muted-foreground")} />
                        <span>
                          <span className="block text-sm font-semibold">{title}</span>
                          <span className="block text-xs text-muted-foreground">{hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <Card>
              <CardContent className="space-y-3 p-4 text-sm">
                <div className="flex items-center gap-3">
                  <IncidentTypeIcon type={form.type} size="sm" />
                  <div>
                    <p className="font-semibold">{form.title || INCIDENT_TYPES.find((t) => t.value === form.type)?.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {buildingName} {form.floor && `· ${form.floor}`} · Priorité {labelFor(INCIDENT_PRIORITIES, form.priority).toLowerCase()}
                    </p>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-muted-foreground">{form.description}</p>
                {photos.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex gap-2 overflow-x-auto">
                      {photos.map((p, i) =>
                        p.preview ? (
                          <img key={i} src={p.preview} alt="Aperçu" className="h-16 w-16 shrink-0 rounded-md object-cover" />
                        ) : (
                          <div key={i} className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-md bg-muted p-1">
                            <FileText className="h-5 w-5 text-primary" />
                            <span className="w-full truncate text-center text-[9px] text-muted-foreground">{p.file.name}</span>
                          </div>
                        )
                      )}
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {visibility === "private" ? <Lock className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                      {visibility === "private" ? "Pièces jointes visibles uniquement par la gestion" : "Pièces jointes visibles par les résidents"}
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Vérifiez ces informations, puis envoyez votre signalement.</p>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            {step > 0 && (
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(step - 1)} disabled={submitting}>
                <ChevronLeft className="h-4 w-4" />
                Retour
              </Button>
            )}
            <Button type="submit" className="flex-1" size="lg" disabled={submitting || !canContinue}>
              {step < STEPS.length - 1 ? (
                <>
                  Continuer <ChevronRight className="h-4 w-4" />
                </>
              ) : submitting ? (
                "Envoi…"
              ) : (
                "Envoyer le signalement"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
