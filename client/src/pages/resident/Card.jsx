import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Wallet, ArrowDownCircle, ArrowUpCircle, Lock, CreditCard, Store } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card as UiCard, CardContent } from "../../components/ui/card";
import { RestrictedBanner } from "../../components/RestrictedBanner";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/utils";
import { cn } from "../../lib/utils";

function formatCents(cents) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function ResidentCard() {
  const { user } = useAuth();
  const hasLease = user?.lease_status === "verified";
  const canvasRef = useRef(null);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState(2000);
  const [custom, setCustom] = useState("");
  const [paying, setPaying] = useState(false);
  const [provider, setProvider] = useState(null);

  const { data: payConfig } = useQuery({
    queryKey: ["payments", "config"],
    queryFn: () => api.get("/payments/config"),
    enabled: hasLease,
  });

  // Retour depuis Stripe : le webhook qui crédite le solde peut arriver quelques secondes après
  // la redirection, on interroge donc le serveur jusqu'à confirmation.
  useEffect(() => {
    const result = searchParams.get("paiement");
    if (!result) return;
    const paymentId = searchParams.get("payment_id");
    setSearchParams({}, { replace: true });
    if (result === "annule") {
      toast("Paiement annulé, aucun montant n'a été débité.");
      return;
    }
    if (result !== "succes" || !paymentId) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 15 && !cancelled; i++) {
        try {
          const p = await api.get(`/payments/status?payment_id=${encodeURIComponent(paymentId)}`);
          if (p.status === "expired" || p.status === "failed") {
            toast.error("Le paiement n'a pas abouti, aucun montant n'a été débité.");
            return;
          }
          if (p.status === "paid") {
            toast.success("Paiement reçu : votre carte a été rechargée !");
            queryClient.invalidateQueries({ queryKey: ["card", "me"] });
            return;
          }
        } catch {
          // on réessaie
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) toast("Paiement en cours de validation : votre solde sera mis à jour dans quelques instants.");
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startPayment() {
    const cents = custom ? Math.round(Number(custom.replace(",", ".")) * 100) : selected;
    setPaying(true);
    try {
      const { url } = await api.post("/payments/checkout", { amount_cents: cents, provider: provider || payConfig.providers[0].id });
      window.location.href = url;
    } catch (err) {
      toast.error(err.message);
      setPaying(false);
    }
  }

  const { data } = useQuery({
    queryKey: ["card", "me"],
    queryFn: () => api.get("/cards/me"),
    enabled: hasLease,
  });

  useEffect(() => {
    if (data?.card?.qr_token && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, data.card.qr_token, { width: 200, margin: 1 });
    }
  }, [data?.card?.qr_token]);

  if (!hasLease) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <h1 className="text-xl font-bold">Ma carte résident</h1>
        <RestrictedBanner />
        <UiCard className="opacity-60">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Votre carte numérique sera disponible dès que votre bail sera vérifié par la gestion.
            </p>
          </CardContent>
        </UiCard>
      </div>
    );
  }

  const card = data?.card;
  const transactions = data?.transactions || [];

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <h1 className="text-xl font-bold">Ma carte résident</h1>

      <div className="hero-gradient rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">{user?.name}</p>
            <p className="text-xs opacity-70">{user?.room ? `Chambre ${user.room}` : ""}</p>
          </div>
          <Wallet className="h-6 w-6 opacity-80" />
        </div>
        <p className="mt-6 text-3xl font-bold">{card ? formatCents(card.balance_cents) : "—"}</p>
        <p className="text-xs opacity-70">Solde disponible</p>
      </div>

      <UiCard>
        <CardContent className="flex flex-col items-center gap-3 p-6">
          <canvas ref={canvasRef} className="rounded-lg" />
          <p className="text-center text-xs text-muted-foreground">
            Présentez ce code au personnel pour un règlement (ex. restaurant) ou une vérification d'identité.
          </p>
        </CardContent>
      </UiCard>

      <UiCard>
        <CardContent className="space-y-4 p-5">
          <p className="flex items-center gap-2 font-semibold">
            <CreditCard className="h-4 w-4" /> Recharger ma carte
          </p>

          {payConfig?.enabled ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {payConfig.presets_cents.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setSelected(c);
                      setCustom("");
                    }}
                    className={cn(
                      "rounded-lg border px-2 py-2.5 text-sm font-semibold transition-all active:scale-95",
                      !custom && selected === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    )}
                  >
                    {c / 100} €
                  </button>
                ))}
              </div>
              <Input
                inputMode="decimal"
                placeholder={`Autre montant (${payConfig.min_cents / 100} à ${payConfig.max_cents / 100} €)`}
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^\d.,]/g, ""))}
              />
              {payConfig.providers.length > 1 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Payer avec</p>
                  {payConfig.providers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProvider(p.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors",
                        (provider || payConfig.providers[0].id) === p.id ? "border-primary bg-primary/10" : "border-border"
                      )}
                    >
                      <span className="text-sm font-semibold">{p.label}</span>
                      <span className="text-xs text-muted-foreground">{p.description}</span>
                    </button>
                  ))}
                </div>
              )}
              <Button className="w-full" size="lg" onClick={startPayment} disabled={paying}>
                <CreditCard className="h-4 w-4" />
                {paying ? "Redirection vers le paiement…" : "Payer en ligne"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Paiement sécurisé sur la page du prestataire : vos coordonnées bancaires ne passent jamais par Résidence Ops.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Le paiement en ligne n'est pas encore activé dans votre résidence.</p>
          )}

          <div className="flex items-start gap-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <Store className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Vous préférez payer sur place ? Rendez-vous à l'accueil : réglez au terminal de paiement (TPE) de la résidence et le
              gestionnaire ajoute le montant à votre solde.
            </span>
          </div>
        </CardContent>
      </UiCard>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Historique</h2>
        <div className="space-y-2">
          {transactions.length === 0 && <p className="text-sm text-muted-foreground">Aucune transaction pour le moment.</p>}
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              {t.type === "credit" ? (
                <ArrowDownCircle className="h-5 w-5 text-status-resolved" />
              ) : (
                <ArrowUpCircle className="h-5 w-5 text-status-urgent" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.reason}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(t.created_at)}</p>
              </div>
              <span className={cn("text-sm font-semibold", t.type === "credit" ? "text-status-resolved" : "text-status-urgent")}>
                {t.type === "credit" ? "+" : ""}
                {formatCents(t.amount_cents)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
