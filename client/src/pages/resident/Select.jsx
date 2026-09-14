import { Link, Navigate } from "react-router-dom";
import { Building2, User, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { useAuth } from "../../context/AuthContext";
import { useBranding } from "../../context/BrandingContext";

export function Select() {
  const { user } = useAuth();
  const { displayName, logoUrl } = useBranding();

  if (user) {
    return <Navigate to={user.role === "manager" ? "/manager" : "/"} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-10 flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground">
          {logoUrl ? <img src={logoUrl} alt={displayName} className="h-full w-full object-cover" /> : <Building2 className="h-7 w-7" />}
        </div>
        <h1 className="text-2xl font-bold">{displayName}</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          L'outil intelligent de gestion des incidents pour la vie en résidence étudiante.
        </p>
      </div>

      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        <Link to="/inscription-resident">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-6 w-6" />
              </div>
              <h2 className="font-semibold">Je suis résident</h2>
              <p className="text-sm text-muted-foreground">
                Signalez un incident, suivez son traitement et restez informé de la vie de votre résidence.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin-login">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="font-semibold">Je suis gestionnaire</h2>
              <p className="text-sm text-muted-foreground">
                Gérez les incidents, planifiez les interventions et pilotez votre résidence.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Link to="/telecharger" className="mt-8 text-sm text-muted-foreground underline-offset-4 hover:underline">
        Télécharger l'application mobile
      </Link>
    </div>
  );
}
