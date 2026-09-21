import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, ExternalLink, Copy, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { api } from "../../lib/api";

function ProviderCard({ provider, onChanged }) {
  const [values, setValues] = useState({});
  const [enabled, setEnabled] = useState(provider.enabled);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.put(`/payments/settings/${provider.id}`, { enabled, config: values });
      toast.success(`${provider.label} : réglages enregistrés.`);
      setValues({});
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      await api.post(`/payments/settings/${provider.id}/test`, {});
      toast.success(`Connexion à ${provider.label} réussie.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {provider.label}
              {provider.enabled ? <Badge variant="resolved">Actif</Badge> : <Badge variant="outline">Inactif</Badge>}
            </CardTitle>
            <CardDescription>{provider.description}</CardDescription>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
            Proposer
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {provider.source === "env" && (
          <p className="text-xs text-muted-foreground">Configuré via les variables d'environnement du serveur.</p>
        )}

        {provider.fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label className="text-xs">{f.label}</Label>
            {f.type === "select" ? (
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={values[f.key] ?? f.value}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              >
                {f.options.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type={f.type === "secret" ? "password" : "text"}
                autoComplete="off"
                placeholder={f.type === "secret" && f.isSet ? "•••••••• (enregistré — laisser vide pour conserver)" : ""}
                value={values[f.key] ?? (f.type === "secret" ? "" : f.value)}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            )}
          </div>
        ))}

        {provider.webhookUrl && (
          <div className="rounded-lg bg-muted p-3 text-xs">
            <p className="mb-1 font-medium">
              {provider.id === "stripe" ? "Webhook à créer dans le tableau de bord Stripe :" : "Adresse de notification (facultatif) :"}
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all">{provider.webhookUrl}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(provider.webhookUrl);
                  toast.success("Adresse copiée.");
                }}
                aria-label="Copier"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            {provider.webhookEvents && <p className="mt-1 text-muted-foreground">Événements : {provider.webhookEvents.join(", ")}</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button size="sm" variant="outline" onClick={test} disabled={testing || !provider.configured}>
            {testing ? "Test…" : "Tester la connexion"}
          </Button>
          <a href={provider.helpUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
            Où trouver mes clés <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {provider.id === "helloasso" && (
          <p className="flex items-start gap-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Réservé aux associations. HelloAsso propose une contribution volontaire au payeur ; vérifiez qu'un rechargement de crédit
            est compatible avec leurs conditions.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function PaymentSettings() {
  const queryClient = useQueryClient();
  const [reconciling, setReconciling] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["payment-settings"], queryFn: () => api.get("/payments/settings") });

  async function reconcile() {
    setReconciling(true);
    try {
      const r = await api.post("/payments/reconcile", {});
      toast.success(`${r.checked} paiement(s) vérifié(s), ${r.credited} crédité(s).`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReconciling(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CreditCard className="h-6 w-6" /> Moyens de paiement en ligne
        </h1>
        <p className="text-sm text-muted-foreground">
          Choisissez les moyens que les résidents pourront utiliser pour recharger leur carte. Le paiement à l'accueil (TPE) reste toujours possible.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-resolved" />
        <span>
          L'argent est versé directement sur le compte du prestataire que <b>vous</b> configurez ici. Les clés sont enregistrées chiffrées et ne sont
          jamais réaffichées. Commencez par les clés de <b>test</b> de chaque prestataire.
        </span>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {data?.providers.map((p) => (
          <ProviderCard key={`${p.id}-${p.enabled}-${p.configured}`} provider={p} onChanged={() => queryClient.invalidateQueries({ queryKey: ["payment-settings"] })} />
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            Un résident a payé mais son solde n'a pas bougé ? Relancez la vérification auprès des prestataires.
          </p>
          <Button variant="outline" size="sm" onClick={reconcile} disabled={reconciling}>
            <RefreshCw className="h-3.5 w-3.5" />
            {reconciling ? "Vérification…" : "Vérifier les paiements en attente"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
