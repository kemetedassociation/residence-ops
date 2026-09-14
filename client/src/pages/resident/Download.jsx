import { Link } from "react-router-dom";
import { Smartphone, Share, PlusSquare, MoreVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export function Download() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center px-4 py-10">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Smartphone className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold">Télécharger l'application</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Résidence Ops fonctionne comme une application installable directement depuis votre navigateur, sans passer par un store.
      </p>

      <div className="mt-8 w-full space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Share className="h-4 w-4" /> Sur iPhone (Safari)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Appuyez sur l'icône de partage, puis sur « Sur l'écran d'accueil ».
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MoreVertical className="h-4 w-4" /> Sur Android (Chrome)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Ouvrez le menu (⋮) puis sélectionnez « Ajouter à l'écran d'accueil ».
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlusSquare className="h-4 w-4" /> Sur ordinateur
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Cliquez sur l'icône d'installation dans la barre d'adresse de votre navigateur.
          </CardContent>
        </Card>
      </div>

      <Link to="/select" className="mt-8 text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Retour
      </Link>
    </div>
  );
}
