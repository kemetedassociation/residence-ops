import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Smartphone, Share, PlusSquare, MoreVertical, Download as DownloadIcon, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useInstallPrompt, isRunningInstalled } from "../../hooks/useInstallPrompt";

export function Download() {
  const { available, promptInstall } = useInstallPrompt();
  const [installed] = useState(isRunningInstalled);
  const [installing, setInstalling] = useState(false);

  async function handleInstall() {
    setInstalling(true);
    try {
      const outcome = await promptInstall();
      if (outcome === "accepted") toast.success("Résidence Ops a été installée !");
      else if (outcome === "dismissed") toast("Installation annulée.");
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center px-4 py-10">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Smartphone className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold">Télécharger l'application</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Résidence Ops s'installe directement depuis votre navigateur, sur ordinateur comme sur mobile — sans passer par
        un store.
      </p>

      {installed ? (
        <div className="mt-8 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          <CheckCircle2 className="h-5 w-5" />
          Déjà installée sur cet appareil ✨
        </div>
      ) : available ? (
        <Button size="lg" className="mt-8 w-full" onClick={handleInstall} disabled={installing}>
          <DownloadIcon className="h-4 w-4" />
          {installing ? "Installation…" : "Installer maintenant"}
        </Button>
      ) : null}

      {!installed && (
        <div className="mt-8 w-full space-y-4">
          {!available && (
            <p className="text-center text-xs text-muted-foreground">
              Votre navigateur ne propose pas d'installation en un clic — suivez les instructions ci-dessous.
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Share className="h-4 w-4" /> Sur iPhone / iPad (Safari)
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
              Ouvrez le menu (⋮) puis sélectionnez « Ajouter à l'écran d'accueil » ou « Installer l'application ».
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PlusSquare className="h-4 w-4" /> Sur ordinateur (Chrome, Edge)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Cliquez sur l'icône d'installation ⊕ dans la barre d'adresse, ou ouvrez le menu (⋮) → « Installer
              Résidence Ops ».
            </CardContent>
          </Card>
        </div>
      )}

      <Link to="/select" className="mt-8 text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Retour
      </Link>
    </div>
  );
}
