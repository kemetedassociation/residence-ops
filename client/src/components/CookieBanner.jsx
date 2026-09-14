import { useState } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";
import { Button } from "./ui/button";

const STORAGE_KEY = "residence_ops_cookie_consent";

export function CookieBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  });

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      // localStorage unavailable (private mode) — the banner will simply reappear next visit.
    }
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card p-4 shadow-lg">
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Résidence Ops n'utilise aucun cookie de suivi ni de publicité. Nous stockons uniquement ce qui est
            nécessaire au fonctionnement de votre session et de vos préférences (connexion, thème choisi).{" "}
            <Link to="/confidentialite" className="text-primary underline-offset-4 hover:underline">
              En savoir plus
            </Link>
            .
          </p>
        </div>
        <Button size="sm" onClick={accept} className="w-full shrink-0 sm:w-auto">
          Compris
        </Button>
      </div>
    </div>
  );
}
