import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export function ResidentSignup() {
  const { user, register, login } = useAuth();
  const navigate = useNavigate();
  const [buildings, setBuildings] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    building_id: "",
    room: "",
    lease_number: "",
    accepted_privacy: false,
  });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  useEffect(() => {
    api.get("/residences").then((data) => setBuildings(data.buildings)).catch(() => {});
  }, []);

  if (user) {
    return <Navigate to={user.role === "manager" ? "/manager" : "/"} replace />;
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <User className="h-6 w-6" />
          </div>
          <CardTitle>Espace résident</CardTitle>
          <CardDescription>Créez votre compte ou connectez-vous.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="register">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="register">Créer un compte</TabsTrigger>
              <TabsTrigger value="login">Se connecter</TabsTrigger>
            </TabsList>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nom complet</Label>
                  <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Mot de passe</Label>
                  <Input id="signup-password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
                    <Label htmlFor="room">Chambre</Label>
                    <Input id="room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="214" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lease">Numéro de bail (optionnel)</Label>
                  <Input
                    id="lease"
                    value={form.lease_number}
                    onChange={(e) => setForm({ ...form, lease_number: e.target.value })}
                    placeholder="BAIL-2025-0214"
                  />
                  <p className="text-xs text-muted-foreground">
                    Sans bail vérifié, votre accès sera limité à la lecture seule. Vous pourrez l'ajouter plus tard depuis votre profil.
                  </p>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    required
                    className="mt-0.5"
                    checked={form.accepted_privacy}
                    onChange={(e) => setForm({ ...form, accepted_privacy: e.target.checked })}
                  />
                  <span>
                    J'accepte la{" "}
                    <Link to="/confidentialite" target="_blank" className="text-primary underline-offset-4 hover:underline">
                      politique de confidentialité
                    </Link>{" "}
                    et les{" "}
                    <Link to="/conditions" target="_blank" className="text-primary underline-offset-4 hover:underline">
                      conditions générales
                    </Link>
                    .
                  </span>
                </label>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading || !form.accepted_privacy}>
                  {loading ? "Création…" : "Créer mon compte"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    required
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    placeholder="etudiant@residence-ops.fr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Mot de passe</Label>
                  <Input
                    id="login-password"
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Connexion…" : "Se connecter"}
                </Button>
                <Link to="/mot-de-passe-oublie" className="block text-center text-sm text-primary hover:underline">
                  Mot de passe oublié ?
                </Link>
                <p className="text-center text-xs text-muted-foreground">
                  Compte de démo : etudiant@residence-ops.fr / resident123
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <Link to="/select" className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground">
            ← Retour
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
