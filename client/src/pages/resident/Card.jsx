import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Wallet, ArrowDownCircle, ArrowUpCircle, Lock } from "lucide-react";
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
