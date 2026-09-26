import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FileText, CalendarClock, Download, X, Lock, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import { RestrictedBanner } from "../../components/RestrictedBanner";
import { MonthCalendar, DaySlotPicker } from "../../components/AvailabilityCalendar";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { uploadPrivateFile, openPrivateFile, DOCUMENT_ACCEPT, DOCUMENT_FORMATS_LABEL } from "../../lib/files";
import { DOCUMENT_TYPES, DOCUMENT_STATUSES, labelFor, variantFor } from "../../lib/constants";
import { formatDate, formatDateTime } from "../../lib/utils";

export function Administration() {
  const { user } = useAuth();
  const hasLease = user?.lease_status === "verified";
  const queryClient = useQueryClient();

  const [docType, setDocType] = useState("");
  const [docNote, setDocNote] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [sending, setSending] = useState(false);
  const attachmentInput = useRef(null);
  const [appointmentNote, setAppointmentNote] = useState("");
  const [pickedDay, setPickedDay] = useState(null);
  const [pickedSlot, setPickedSlot] = useState(null);

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
    setSending(true);
    try {
      const uploaded = attachment ? await uploadPrivateFile(attachment) : null;
      await api.post("/documents", { type: docType, note: docNote, attachment_url: uploaded?.url || null });
      toast.success("Demande envoyée.");
      setDocType("");
      setDocNote("");
      setAttachment(null);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  async function bookSlot(slotId) {
    try {
      await api.post("/appointments", { slot_id: slotId, note: appointmentNote });
      toast.success("Rendez-vous confirmé.");
      setAppointmentNote("");
      setPickedSlot(null);
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
                    <input
                      ref={attachmentInput}
                      type="file"
                      accept={DOCUMENT_ACCEPT}
                      className="hidden"
                      onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                    />
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => attachmentInput.current?.click()}>
                        <Paperclip className="h-3.5 w-3.5" />
                        Joindre un justificatif
                      </Button>
                      {attachment && (
                        <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                          <span className="truncate">{attachment.name}</span>
                          <button type="button" onClick={() => setAttachment(null)} aria-label="Retirer la pièce jointe">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Formats acceptés : {DOCUMENT_FORMATS_LABEL} (10 Mo maximum)</p>
                    <Button type="submit" className="w-full" disabled={!docType || sending}>
                      {sending ? "Envoi…" : "Envoyer la demande"}
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
                    {d.attachment_url && (
                      <button
                        type="button"
                        onClick={() => openPrivateFile(d.attachment_url)}
                        className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Paperclip className="h-3 w-3" /> Votre justificatif joint
                      </button>
                    )}
                    {d.status === "pret" && d.file_url && (
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => openPrivateFile(d.file_url)}>
                        <Download className="h-3.5 w-3.5" />
                        Ouvrir le document
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

              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground">Choisir un jour puis un créneau</p>
                {slots.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Aucune disponibilité pour le moment. Revenez bientôt ou contactez l'accueil.
                  </p>
                ) : (
                  <>
                    <MonthCalendar
                      slots={slots}
                      selectedDay={pickedDay}
                      onSelectDay={(d) => {
                        setPickedDay(d);
                        setPickedSlot(null);
                      }}
                    />
                    {pickedDay ? (
                      <DaySlotPicker day={pickedDay} slots={slots} selectedId={pickedSlot?.id} onSelect={setPickedSlot} />
                    ) : (
                      <p className="text-xs text-muted-foreground">Les jours en couleur ont des créneaux libres.</p>
                    )}
                    {pickedSlot && (
                      <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                        <p className="text-sm font-medium">
                          Rendez-vous le {format(new Date(pickedSlot.start_at), "EEEE d MMMM 'à' HH'h'mm", { locale: fr })}
                        </p>
                        <Textarea rows={2} placeholder="Motif du rendez-vous (optionnel)" value={appointmentNote} onChange={(e) => setAppointmentNote(e.target.value)} />
                        <Button className="w-full" onClick={() => bookSlot(pickedSlot.id)}>
                          Confirmer le rendez-vous
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
