import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FileText, CalendarClock, Download, X, Lock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import { RestrictedBanner } from "../../components/RestrictedBanner";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { DOCUMENT_TYPES, DOCUMENT_STATUSES, labelFor, variantFor } from "../../lib/constants";
import { formatDate, formatDateTime } from "../../lib/utils";

export function Administration() {
  const { user } = useAuth();
  const hasLease = user?.lease_status === "verified";
  const queryClient = useQueryClient();

  const [docType, setDocType] = useState("");
  const [docNote, setDocNote] = useState("");
  const [appointmentNote, setAppointmentNote] = useState("");

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => api.get("/documents").then((d) => d.documents),
    enabled: hasLease,
  });
  const { data: slots = [] } = useQuery({
    queryKey: ["slots"],
    queryFn: () => api.get("/availability-slots").then((d) => d.slots),
    enabled: hasLease,
  });
  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments", "mine"],
    queryFn: () => api.get("/appointments").then((d) => d.appointments),
    enabled: hasLease,
  });

  async function submitDocument(e) {
    e.preventDefault();
    try {
      await api.post("/documents", { type: docType, note: docNote });
      toast.success("Demande envoyée.");
      setDocType("");
      setDocNote("");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function bookSlot(slotId) {
    try {
      await api.post("/appointments", { slot_id: slotId, note: appointmentNote });
      toast.success("Rendez-vous confirmé.");
      setAppointmentNote("");
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      queryClient.invalidateQueries({ queryKey: ["appointments", "mine"] });
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function cancelAppointment(id) {
    try {
      await api.patch(`/appointments/${id}/cancel`, {});
      toast.success("Rendez-vous annulé.");
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      queryClient.invalidateQueries({ queryKey: ["appointments", "mine"] });
    } catch (err) {
      toast.error(err.message);
    }
  }

  const activeAppointments = appointments.filter((a) => a.status === "confirme");

  return (
    <div className="pb-6">
      <div className="hero-gradient flex items-center gap-3 px-4 py-6 text-white">
        <FileText className="h-6 w-6" />
        <h1 className="text-xl font-bold">Administration</h1>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
        {!hasLease ? (
          <>
            <RestrictedBanner />
            <Card className="opacity-60">
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <Lock className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Cette section est verrouillée tant qu'un bail vérifié n'est pas associé à votre compte.
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <Tabs defaultValue="documents">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="rdv">Rendez-vous</TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="space-y-4 pt-3">
              <Card>
                <CardContent className="p-4">
                  <form onSubmit={submitDocument} className="space-y-3">
                    <Select value={docType} onValueChange={setDocType} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Type de document" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      rows={2}
                      placeholder="Précisez votre demande si besoin (optionnel)"
                      value={docNote}
                      onChange={(e) => setDocNote(e.target.value)}
                    />
                    <Button type="submit" className="w-full" disabled={!docType}>
                      Envoyer la demande
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-2">
                {documents.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{labelFor(DOCUMENT_TYPES, d.type)}</p>
                      <Badge variant={variantFor(DOCUMENT_STATUSES, d.status)}>{labelFor(DOCUMENT_STATUSES, d.status)}</Badge>
                    </div>
                    {d.note && <p className="mt-1 text-xs text-muted-foreground">{d.note}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(d.created_at)}</p>
                    {d.status === "pret" && d.file_url && (
                      <Button asChild size="sm" variant="outline" className="mt-2">
                        <a href={d.file_url} target="_blank" rel="noreferrer">
                          <Download className="h-3.5 w-3.5" />
                          Télécharger
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
                {documents.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>}
              </div>
            </TabsContent>

            <TabsContent value="rdv" className="space-y-4 pt-3">
              {activeAppointments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">Mes rendez-vous</p>
                  {activeAppointments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                      <div>
                        <p className="text-sm font-medium">{formatDateTime(a.start_at)}</p>
                        {a.note && <p className="text-xs text-muted-foreground">{a.note}</p>}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => cancelAppointment(a.id)}>
                        <X className="h-3.5 w-3.5" />
                        Annuler
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="mb-2 text-sm font-semibold text-muted-foreground">Créneaux disponibles</p>
                <Textarea
                  rows={2}
                  placeholder="Motif du rendez-vous (optionnel)"
                  value={appointmentNote}
                  onChange={(e) => setAppointmentNote(e.target.value)}
                  className="mb-2"
                />
                <div className="space-y-2">
                  {slots.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                      <span className="flex items-center gap-2 text-sm">
                        <CalendarClock className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(s.start_at), "EEEE d MMMM, HH:mm", { locale: fr })}
                      </span>
                      <Button size="sm" onClick={() => bookSlot(s.id)}>
                        Réserver
                      </Button>
                    </div>
                  ))}
                  {slots.length === 0 && <p className="text-sm text-muted-foreground">Aucun créneau disponible.</p>}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
