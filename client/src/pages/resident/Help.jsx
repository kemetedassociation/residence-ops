import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Phone, HeartHandshake, ShieldCheck, Video, MapPin, CalendarPlus, Download, X, Mail, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { Skeleton } from "../../components/ui/skeleton";
import { MonthCalendar, DaySlotPicker } from "../../components/AvailabilityCalendar";
import { useAuth } from "../../context/AuthContext";
import { api, getToken } from "../../lib/api";
import { URGENT_NUMBERS, LISTENING_NUMBERS, MODE_LABELS, calendarLinks } from "../../lib/care";
import { cn } from "../../lib/utils";

const fmt = (iso, pattern) => format(new Date(iso), pattern, { locale: fr });

async function downloadIcs(appointment) {
  try {
    const res = await fetch(`/api/care/appointments/${appointment.id}/ics`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error("Téléchargement impossible.");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "rendez-vous.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    toast.error(err.message);
  }
}

function CalendarButtons({ appointment }) {
  const links = calendarLinks(appointment);
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline">
        <a href={links.google} target="_blank" rel="noreferrer">
          <CalendarPlus className="h-3.5 w-3.5" /> Google Agenda
        </a>
      </Button>
      <Button size="sm" variant="outline" onClick={() => downloadIcs(appointment)}>
        <Download className="h-3.5 w-3.5" /> Apple / Outlook (.ics)
      </Button>
      <Button asChild size="sm" variant="ghost">
        <a href={links.outlook} target="_blank" rel="noreferrer">
          Outlook web
        </a>
      </Button>
    </div>
  );
}

function BookingDialog({ professional, open, onOpenChange, onBooked }) {
  const [slotId, setSlotId] = useState(null);
  const [pickedDay, setPickedDay] = useState(null);
  const [note, setNote] = useState("");
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["care-slots", professional?.id],
    queryFn: () => api.get(`/care/professionals/${professional.id}/slots`),
    enabled: open && !!professional,
  });

  const days = useMemo(() => {
    const byDay = {};
    (data?.slots || []).forEach((s) => (byDay[s.start_at.slice(0, 10) + fmt(s.start_at, "d")] ||= { label: fmt(s.start_at, "EEEE d MMMM"), slots: [] }).slots.push(s));
    return Object.values(byDay);
  }, [data]);

  async function confirm() {
    setBusy(true);
    try {
      const { appointment } = await api.post("/care/appointments", { slot_id: slotId, note, share_contact: share });
      setDone(appointment);
      onBooked();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  function close(v) {
    if (!v) {
      setSlotId(null);
      setPickedDay(null);
      setNote("");
      setShare(false);
      setDone(null);
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle>Rendez-vous confirmé</DialogTitle>
              <DialogDescription>
                {fmt(done.start_at, "EEEE d MMMM 'à' HH'h'mm")} avec {done.professional_name}. Ajoutez-le à votre agenda pour ne pas l'oublier :
              </DialogDescription>
            </DialogHeader>
            <CalendarButtons appointment={done} />
            <Button onClick={() => close(false)}>Terminer</Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Prendre rendez-vous</DialogTitle>
              <DialogDescription>{professional?.name}</DialogDescription>
            </DialogHeader>
            {isLoading && <Skeleton className="h-24 w-full" />}
            {!isLoading && days.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun créneau disponible pour le moment. Vous pouvez contacter directement le professionnel avec les coordonnées de sa fiche.
              </p>
            )}
            {!isLoading && days.length > 0 && (
              <div className="space-y-3">
                <MonthCalendar slots={data.slots} selectedDay={pickedDay} onSelectDay={(d) => { setPickedDay(d); setSlotId(null); }} />
                {pickedDay ? (
                  <DaySlotPicker day={pickedDay} slots={data.slots} selectedId={slotId} onSelect={(s) => setSlotId(s.id)} />
                ) : (
                  <p className="text-xs text-muted-foreground">Choisissez un jour en couleur pour voir les horaires.</p>
                )}
              </div>
            )}
            {slotId && (
              <div className="space-y-3">
                <Textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ce que vous souhaitez partager avant le rendez-vous (facultatif)" />
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5" />
                  Partager mon e-mail et mon téléphone avec le professionnel, pour qu'il puisse me joindre.
                </label>
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  Confidentiel : seuls vous et le professionnel voyez ce rendez-vous. La gestion de la résidence n'y a pas accès.
                </p>
                <Button className="w-full" size="lg" onClick={confirm} disabled={busy}>
                  {busy ? "Réservation…" : "Confirmer le rendez-vous"}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Help() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [booking, setBooking] = useState(null);
  const isResident = user?.role === "resident";

  const { data, isLoading } = useQuery({ queryKey: ["care-professionals"], queryFn: () => api.get("/care/professionals") });
  const { data: mine } = useQuery({
    queryKey: ["care-mine"],
    queryFn: () => api.get("/care/appointments/mine"),
    enabled: isResident,
  });

  const professionals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.professionals || []).filter((p) => !q || [p.name, p.title, ...p.specialties, ...p.languages].join(" ").toLowerCase().includes(q));
  }, [data, query]);

  async function cancel(id) {
    if (!confirm("Annuler ce rendez-vous ?")) return;
    try {
      await api.patch(`/care/appointments/${id}/cancel`, {});
      toast.success("Rendez-vous annulé.");
      queryClient.invalidateQueries({ queryKey: ["care-mine"] });
      queryClient.invalidateQueries({ queryKey: ["care-slots"] });
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="hero-gradient px-4 pb-8 pt-6 text-white" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}>
        <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} className="mb-4 flex items-center gap-1 text-sm opacity-90">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <HeartHandshake className="mb-2 h-8 w-8" />
        <h1 className="text-2xl font-bold">Besoin d'aide ?</h1>
        <p className="mt-1 max-w-md text-sm opacity-90">
          Vous n'êtes pas seul(e). Parler à quelqu'un est un premier pas, et ce n'est jamais trop tôt ni « pas assez grave ».
        </p>
      </div>

      <div className="mx-auto -mt-4 max-w-lg space-y-6 px-4">
        <section className="rounded-2xl border-2 border-destructive/40 bg-card p-4 shadow-sm">
          <h2 className="font-bold text-destructive">En danger ou en détresse immédiate ?</h2>
          <p className="mb-3 text-sm text-muted-foreground">Appelez maintenant, c'est gratuit et il y a toujours quelqu'un pour répondre.</p>
          <div className="space-y-2">
            {URGENT_NUMBERS.map((n) => (
              <a
                key={n.number}
                href={`tel:${n.number}`}
                className="flex items-center gap-3 rounded-xl bg-destructive p-3 text-destructive-foreground active:scale-[0.98]"
              >
                <Phone className="h-5 w-5 shrink-0" />
                <span className="text-2xl font-extrabold">{n.number}</span>
                <span className="min-w-0 flex-1 text-right text-xs leading-tight">
                  <b className="block text-sm">{n.label}</b>
                  {n.detail}
                </span>
              </a>
            ))}
          </div>
        </section>

        {isResident && (mine?.appointments || []).length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Mes rendez-vous</h2>
            {mine.appointments.map((a) => (
              <div key={a.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold capitalize">{fmt(a.start_at, "EEEE d MMMM 'à' HH'h'mm")}</p>
                    <p className="text-sm text-muted-foreground">{a.professional_name}</p>
                  </div>
                  <button onClick={() => cancel(a.id)} className="rounded-full p-1.5 text-muted-foreground hover:bg-accent" aria-label="Annuler le rendez-vous">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <CalendarButtons appointment={a} />
              </div>
            ))}
          </section>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold">Parler à un professionnel</h2>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Vos rendez-vous sont confidentiels : la gestion de la résidence ne voit ni qui consulte, ni quand.
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Rechercher (dépression, anxiété, sommeil, langue…)" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {isLoading && <Skeleton className="h-32 w-full" />}
          {!isLoading && professionals.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun professionnel ne correspond. Les numéros ci-dessus et ci-dessous restent disponibles à tout moment.</p>
          )}

          {professionals.map((p) => (
            <div key={p.id} className="space-y-3 rounded-2xl border border-border bg-card p-4 card-elevated">
              <div>
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-sm text-muted-foreground">{p.title}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.free && <Badge variant="resolved">Gratuit pour les résidents</Badge>}
                <Badge variant="outline" className="gap-1">
                  {p.mode === "visio" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                  {MODE_LABELS[p.mode]}
                </Badge>
                {p.specialties.map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
              </div>
              {p.languages.length > 0 && <p className="text-xs text-muted-foreground">Langues : {p.languages.join(", ")}</p>}
              {p.bio && <p className="text-sm text-muted-foreground">{p.bio}</p>}
              {p.address && <p className="text-xs text-muted-foreground">📍 {p.address}</p>}
              <div className="flex flex-wrap gap-2">
                {isResident ? (
                  <Button size="sm" onClick={() => setBooking(p)}>
                    <CalendarPlus className="h-3.5 w-3.5" /> Prendre rendez-vous
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <Link to="/inscription-resident">Se connecter pour réserver</Link>
                  </Button>
                )}
                {p.phone && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`tel:${p.phone.replace(/\s/g, "")}`}>
                      <Phone className="h-3.5 w-3.5" /> Appeler
                    </a>
                  </Button>
                )}
                {p.email && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`mailto:${p.email}`}>
                      <Mail className="h-3.5 w-3.5" /> Écrire
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold">Écoute et ressources</h2>
          {LISTENING_NUMBERS.map((n) => (
            <a key={n.number} href={`tel:${n.tel}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 active:scale-[0.99]">
              <Phone className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{n.label}</span>
                <span className="block text-xs text-muted-foreground">{n.detail}</span>
              </span>
              <span className="text-sm font-bold text-primary">{n.number}</span>
            </a>
          ))}
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Cette page n'est pas un service médical d'urgence et ne remplace pas un professionnel de santé. En cas de danger immédiat, appelez le 15 ou le 112.
        </p>
      </div>

      <BookingDialog
        professional={booking}
        open={!!booking}
        onOpenChange={(v) => !v && setBooking(null)}
        onBooked={() => {
          queryClient.invalidateQueries({ queryKey: ["care-mine"] });
          queryClient.invalidateQueries({ queryKey: ["care-slots"] });
        }}
      />
    </div>
  );
}
