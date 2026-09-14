import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Building2, Check, X, Clock, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { WalletDialog } from "../../components/WalletDialog";
import { api } from "../../lib/api";
import { LEASE_STATUSES, labelFor, variantFor } from "../../lib/constants";

const roleLabels = {
  resident: { label: "Résident", variant: "secondary" },
  manager: { label: "Admin", variant: "default" },
  technicien: { label: "Technicien", variant: "in-progress" },
};

export function UsersDirectory() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [walletUser, setWalletUser] = useState(null);

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then((d) => d.users) });
  const { data: buildings = [] } = useQuery({
    queryKey: ["buildings"],
    queryFn: () => api.get("/residences").then((d) => d.buildings),
  });

  const buildingName = (id) => buildings.find((b) => b.id === id)?.name || "Non assigné";

  async function reviewLease(userId, lease_status) {
    try {
      await api.patch(`/users/${userId}/lease`, { lease_status });
      toast.success(lease_status === "verified" ? "Bail vérifié." : "Bail refusé.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      toast.error(err.message);
    }
  }

  const pendingLeases = users.filter((u) => u.lease_status === "pending");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, query]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((u) => {
      const key = u.building_id ? buildingName(u.building_id) : "Non assigné";
      groups[key] = groups[key] || [];
      groups[key].push(u);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, buildings]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Annuaire des utilisateurs</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} utilisateur(s)</p>
      </div>

      {pendingLeases.length > 0 && (
        <Card className="border-amber-300/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-amber-600" />
              Baux en attente de vérification ({pendingLeases.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingLeases.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.email} · Bail : {u.lease_number}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => reviewLease(u.id, "verified")}>
                    <Check className="h-4 w-4" />
                    Vérifier
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => reviewLease(u.id, "rejected")}>
                    <X className="h-4 w-4" />
                    Refuser
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="space-y-6">
        {grouped.map(([groupName, groupUsers]) => (
          <div key={groupName}>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Building2 className="h-4 w-4" />
              {groupName}
              <span className="font-normal">({groupUsers.length})</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groupUsers.map((u) => {
                const r = roleLabels[u.role] || roleLabels.resident;
                return (
                  <div key={u.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 card-elevated">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{u.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{u.name}</p>
                        <Badge variant={r.variant}>{r.label}</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      {u.role === "resident" && (
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant={variantFor(LEASE_STATUSES, u.lease_status)}>
                            {labelFor(LEASE_STATUSES, u.lease_status)}
                          </Badge>
                          {u.lease_status === "verified" && (
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setWalletUser(u)}>
                              <Wallet className="h-3.5 w-3.5" />
                              Solde
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {walletUser && (
        <WalletDialog
          userId={walletUser.id}
          userName={walletUser.name}
          open={!!walletUser}
          onOpenChange={(open) => !open && setWalletUser(null)}
        />
      )}
    </div>
  );
}
