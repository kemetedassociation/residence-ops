import { Link } from "react-router-dom";
import { Lock, Clock } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { useAuth } from "../context/AuthContext";

export function RestrictedBanner({ compact = false }) {
  const { user } = useAuth();
  const isPending = user?.lease_status === "pending";

  return (
    <Card className="border-amber-300/50 bg-amber-500/5">
      <CardContent className={compact ? "flex items-center gap-3 p-3" : "flex flex-col items-center gap-3 p-6 text-center"}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
          {isPending ? <Clock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
        </div>
        <div className={compact ? "flex-1" : ""}>
          <p className="text-sm font-medium">{isPending ? "Bail en cours de vérification" : "Accès limité"}</p>
          <p className="text-xs text-muted-foreground">
            {isPending
              ? "La gestion doit vérifier votre numéro de bail avant de débloquer le signalement et les confirmations."
              : "Renseignez votre numéro de bail dans votre profil : une fois vérifié par la gestion, vous pourrez signaler un incident et confirmer ceux des autres résidents."}
          </p>
        </div>
        {!isPending && (
          <Button asChild size="sm" variant="outline">
            <Link to="/profil">Mon profil</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
