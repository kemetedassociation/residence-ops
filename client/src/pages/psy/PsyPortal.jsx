import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { HeartHandshake, LogOut, CalendarPlus, Trash2, Copy, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { PasswordInput } from "../../components/ui/password-input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";

const KEY = "residence_ops_care_token";
const fmt = (iso, p) => format(new Date(iso), p, { locale: fr });

// Accès séparé de celui des résidents/gestionnaires : la gestion de la résidence ne peut pas lire cet agenda.
async function careApi(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`/api/care${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error || `Erreur ${res.status}`), { status: res.status });
  return data;
}

function AuthForms({ onAuthed, initialInvite }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState(initialInvite || "");
  const [busy, setBusy] = useState(false);

  async function submit(kind) {
    setBusy(true);
    try {
      const data =
        kind === "login"
          ? await careApi("/pro/login", { method: "POST", body: { email, password } })
          : await careApi("/pro/claim", { method: "POST", body: { invite_code: invite.trim(), password } });
      onAuthed(data.token, data.feed_token);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <HeartHandshake className="h-8 w-8 text-primary" />
        <CardTitle>Espace professionnel</CardTitle>
        <CardDescription>Accès réservé aux psychologues et professionnels de santé de la résidence.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={initialInvite ? "claim" : "login"}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Connexion</TabsTrigger>
            <TabsTrigger value="claim">Activer mon accès</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Mot de passe</Label>
              <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button className="w-full" disabled={busy} onClick={() => submit("login")}>
              Se connecter
            </Button>
          </TabsContent>
          <TabsContent value="claim" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">
              Vous avez reçu une invitation de la résidence ? Collez son code et choisissez votre mot de passe (12 caractères minimum). Personne d'autre que vous
              ne pourra lire votre agenda, pas même la gestion.
            </p>
            <div className="space-y-1.5">
              <Label>Code d'invitation</Label>
              <Input value={invite} onChange={(e) => setInvite(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>Choisissez votre mot de passe</Label>
              <PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button className="w-full" disabled={busy} onClick={() => submit("claim")}>
              Activer mon accès
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function SlotForm({ token, onCreated }) {
  const [date, setDate] = useState("");
  const [start, setStart] = useState("10:00");
  const [duration, setDuration] = useState(50);
  const [weeks, setWeeks] = useState(1);
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    if (!date) return;
    const slots = [];
    for (let w = 0; w < weeks; w++) {
      const startAt = addWeeks(new Date(`${date}T${start}:00`), w);
      slots.push({ start_at: startAt.toISOString(), end_at: new Date(startAt.getTime() + duration * 60000).toISOString() });
    }
    setBusy(true);
    try {
      const { created } = await careApi("/pro/slots", { method: "POST", token, body: { slots } });
      toast.success(created ? `${created} créneau(x) ajouté(s).` : "Aucun créneau ajouté (chevauchement ou date passée).");
      onCreated();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="space-y-1.5">
        <Label>Date</Label>
        <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Début</Label>
        <Input type="time" required value={start} onChange={(e) => setStart(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Durée (min)</Label>
        <Input type="number" min={15} max={180} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
      </div>
      <div className="space-y-1.5">
        <Label>Répéter (semaines)</Label>
        <Input type="number" min={1} max={12} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} />
      </div>
      <Button type="submit" disabled={busy} className="col-span-2 sm:col-span-4">
        <CalendarPlus className="h-4 w-4" /> Ajouter ce créneau
      </Button>
    </form>
  );
}

function Dashboard({ token, feedToken, onLogout, onNewFeed }) {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["care-pro", "me"], queryFn: () => careApi("/pro/me", { token }), retry: false });
  const appts = useQuery({ queryKey: ["care-pro", "appts"], queryFn: () => careApi("/pro/appointments", { token }), retry: false });
  const slots = useQuery({ queryKey: ["care-pro", "slots"], queryFn: () => careApi("/pro/slots", { token }), retry: false });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["care-pro"] });

  useEffect(() => {
    if (me.error?.status === 401) onLogout();
  }, [me.error]); // eslint-disable-line react-hooks/exhaustive-deps

  const feedUrl = feedToken ? `${window.location.origin}/api/care/feed/${feedToken}.ics` : null;

  async function cancel(id) {
    if (!confirm("Annuler ce rendez-vous ? Le résident sera prévenu.")) return;
    try {
      await careApi(`/pro/appointments/${id}/cancel`, { method: "PATCH", token });
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function removeSlot(id) {
    try {
      await careApi(`/pro/slots/${id}`, { method: "DELETE", token });
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function regenerateFeed() {
    try {
      const { feed_token } = await careApi("/pro/feed-token", { method: "POST", token });
      onNewFeed(feed_token);
      toast.success("Nouvelle adresse d'agenda créée : l'ancienne ne fonctionne plus.");
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{me.data?.professional.name || "Espace professionnel"}</h1>
          <p className="text-sm text-muted-foreground">{me.data?.professional.title}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut className="h-4 w-4" /> Déconnexion
        </Button>
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        Cet espace est confidentiel : la gestion de la résidence n'a accès ni à votre agenda, ni à l'identité de vos consultants.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mes prochains rendez-vous</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(appts.data?.appointments || []).length === 0 && <p className="text-sm text-muted-foreground">Aucun rendez-vous à venir.</p>}
          {(appts.data?.appointments || []).map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0 text-sm">
                <p className="font-semibold capitalize">{fmt(a.start_at, "EEEE d MMMM 'à' HH'h'mm")}</p>
                <p>
                  {a.resident.name}
                  {a.resident.room ? ` · chambre ${a.resident.room}` : ""}
                </p>
                {(a.resident.email || a.resident.phone) && (
                  <p className="text-xs text-muted-foreground">{[a.resident.email, a.resident.phone].filter(Boolean).join(" · ")}</p>
                )}
                {a.note && <p className="mt-1 text-xs italic text-muted-foreground">« {a.note} »</p>}
              </div>
              <button onClick={() => cancel(a.id)} className="rounded-full p-1.5 text-muted-foreground hover:bg-accent" aria-label="Annuler">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agenda partagé</CardTitle>
          <CardDescription>Abonnez votre agenda personnel : les nouveaux rendez-vous y apparaissent tout seuls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {feedUrl ? (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-muted p-2">
                <code className="min-w-0 flex-1 break-all text-xs">{feedUrl}</code>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(feedUrl);
                    toast.success("Adresse copiée.");
                  }}
                  aria-label="Copier"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Google Agenda : « Autres agendas » → « À partir de l'URL ». Apple Calendar : Fichier → Nouvel abonnement à un calendrier. Outlook : Ajouter un
                calendrier → S'abonner depuis le web. <b>Gardez cette adresse secrète</b> : elle donne accès à votre agenda. Elle n'est affichée qu'une fois.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Pour des raisons de sécurité, l'adresse n'est affichée qu'à sa création.</p>
          )}
          <Button size="sm" variant="outline" onClick={regenerateFeed}>
            {feedUrl ? "Créer une nouvelle adresse" : "Obtenir mon adresse d'agenda"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mes créneaux</CardTitle>
          <CardDescription>Les résidents réservent parmi ces créneaux libres.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SlotForm token={token} onCreated={refresh} />
          <div className="space-y-1.5">
            {(slots.data?.slots || []).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="capitalize">
                  {fmt(s.start_at, "EEE d MMM, HH'h'mm")} – {fmt(s.end_at, "HH'h'mm")}
                </span>
                {s.is_booked ? (
                  <span className="text-xs font-medium text-primary">Réservé</span>
                ) : (
                  <button onClick={() => removeSlot(s.id)} className="text-muted-foreground hover:text-destructive" aria-label="Supprimer le créneau">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {(slots.data?.slots || []).length === 0 && <p className="text-sm text-muted-foreground">Aucun créneau publié.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PsyPortal() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(() => sessionStorage.getItem(KEY));
  const [feedToken, setFeedToken] = useState(null);

  function authed(t, feed) {
    sessionStorage.setItem(KEY, t);
    setToken(t);
    if (feed) setFeedToken(feed);
  }
  function logout() {
    sessionStorage.removeItem(KEY);
    setToken(null);
    setFeedToken(null);
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8" style={{ paddingTop: "calc(2rem + env(safe-area-inset-top))" }}>
      {token ? (
        <Dashboard token={token} feedToken={feedToken} onLogout={logout} onNewFeed={setFeedToken} />
      ) : (
        <AuthForms onAuthed={authed} initialInvite={params.get("invite") || ""} />
      )}
    </div>
  );
}
