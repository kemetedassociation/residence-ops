import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { api } from "../lib/api";
import { formatDateTime, cn } from "../lib/utils";

function formatCents(cents) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function WalletDialog({ userId, userName, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("TPE");
  const [reason, setReason] = useState("Recharge à l'accueil");
  const [submitting, setSubmitting] = useState(false);

  const { data } = useQuery({
    queryKey: ["card", userId],
    queryFn: () => api.get(`/cards/${userId}`),
    enabled: open && !!userId,
  });

  async function handleCredit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/cards/${userId}/credit`, {
        amount_cents: Math.round(Number(amount.replace(",", ".")) * 100),
        reason: `${reason} — ${method}`,
      });
      toast.success("Solde crédité.");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["card", userId] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const card = data?.card;
  const transactions = data?.transactions || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Porte-monnaie — {userName}
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl bg-muted p-4 text-center">
          <p className="text-2xl font-bold">{card ? formatCents(card.balance_cents) : "—"}</p>
          <p className="text-xs text-muted-foreground">Solde actuel</p>
        </div>

        <form onSubmit={handleCredit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Moyen de paiement encaissé à l'accueil</Label>
            <div className="grid grid-cols-4 gap-2">
              {["TPE", "Espèces", "Chèque", "Autre"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    method === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Montant (€)</Label>
              <Input inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} />
            </div>
            <div className="space-y-1.5">
              <Label>Motif</Label>
              <Input required value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Crédit…" : "Créditer"}
            </Button>
          </DialogFooter>
        </form>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">Historique</p>
          {transactions.length === 0 && <p className="text-sm text-muted-foreground">Aucune transaction.</p>}
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
              {t.type === "credit" ? (
                <ArrowDownCircle className="h-4 w-4 text-status-resolved" />
              ) : (
                <ArrowUpCircle className="h-4 w-4 text-status-urgent" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{t.reason}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(t.created_at)}</p>
              </div>
              <span className={cn("text-sm font-semibold", t.type === "credit" ? "text-status-resolved" : "text-status-urgent")}>
                {t.type === "credit" ? "+" : ""}
                {formatCents(t.amount_cents)}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
