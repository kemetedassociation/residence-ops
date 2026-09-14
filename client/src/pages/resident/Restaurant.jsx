import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { motion } from "framer-motion";
import { UtensilsCrossed, Lock, Check, X, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { RestrictedBanner } from "../../components/RestrictedBanner";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";

const MEAL_LABELS = { midi: "Midi", soir: "Soir" };
const MEAL_PRICE = 3.5;

export function Restaurant() {
  const { user } = useAuth();
  const hasLease = user?.lease_status === "verified";
  const queryClient = useQueryClient();

  const { data: menus = [] } = useQuery({ queryKey: ["menus"], queryFn: () => api.get("/menus").then((d) => d.menus) });
  const { data: reservations = [] } = useQuery({
    queryKey: ["reservations", "mine"],
    queryFn: () => api.get("/reservations").then((d) => d.reservations),
    enabled: hasLease,
  });
  const { data: card } = useQuery({
    queryKey: ["card", "me"],
    queryFn: () => api.get("/cards/me"),
    enabled: hasLease,
  });

  const reservationFor = (menuId) => reservations.find((r) => r.menu_id === menuId && r.status === "reservee");

  const grouped = useMemo(() => {
    const byDate = {};
    menus.forEach((m) => {
      byDate[m.menu_date] = byDate[m.menu_date] || [];
      byDate[m.menu_date].push(m);
    });
    return Object.entries(byDate).sort(([a], [b]) => new Date(a) - new Date(b));
  }, [menus]);

  async function reserve(menuId, dish, payWithCard) {
    try {
      await api.post("/reservations", { menu_id: menuId, dish, pay_with_card: payWithCard });
      toast.success("Réservation confirmée.");
      queryClient.invalidateQueries({ queryKey: ["reservations", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["card", "me"] });
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function cancel(reservationId) {
    try {
      await api.patch(`/reservations/${reservationId}/cancel`, {});
      toast.success("Réservation annulée.");
      queryClient.invalidateQueries({ queryKey: ["reservations", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["card", "me"] });
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="pb-6">
      <div className="hero-gradient flex items-center justify-between px-4 py-6 text-white">
        <div className="flex items-center gap-3">
          <UtensilsCrossed className="h-6 w-6" />
          <h1 className="text-xl font-bold">Restaurant</h1>
        </div>
        {hasLease && card?.card && (
          <div className="text-right text-sm opacity-90">
            Solde : {(card.card.balance_cents / 100).toFixed(2)} €
          </div>
        )}
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
        {!hasLease && <RestrictedBanner />}

        {grouped.length === 0 && <p className="text-sm text-muted-foreground">Aucun menu publié pour le moment.</p>}

        {grouped.map(([date, meals]) => (
          <div key={date}>
            <h2 className="mb-2 text-sm font-semibold capitalize text-muted-foreground">
              {format(new Date(date), "EEEE d MMMM", { locale: fr })}
            </h2>
            <div className="space-y-3">
              {meals.map((menu, index) => {
                const reservation = reservationFor(menu.id);
                return (
                  <motion.div
                    key={menu.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.25 }}
                  >
                  <Card>
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <Badge variant="secondary">{MEAL_LABELS[menu.meal]}</Badge>
                        {reservation && (
                          <span className="flex items-center gap-1 text-xs text-status-resolved">
                            <Check className="h-3.5 w-3.5" /> Réservé : {reservation.dish}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {menu.items.map((dish) => (
                          <div
                            key={dish}
                            className={cn(
                              "flex items-center justify-between rounded-lg border p-2.5",
                              reservation?.dish === dish ? "border-primary bg-primary/5" : "border-border"
                            )}
                          >
                            <span className="text-sm">{dish}</span>
                            {!hasLease ? (
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            ) : reservation?.dish === dish ? (
                              <Button size="sm" variant="ghost" onClick={() => cancel(reservation.id)}>
                                <X className="h-3.5 w-3.5" />
                                Annuler
                              </Button>
                            ) : !reservation ? (
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" onClick={() => reserve(menu.id, dish, false)}>
                                  Réserver
                                </Button>
                                <Button size="sm" onClick={() => reserve(menu.id, dish, true)}>
                                  <CreditCard className="h-3.5 w-3.5" />
                                  {MEAL_PRICE.toFixed(2)}€
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
