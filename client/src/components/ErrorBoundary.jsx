import { Component } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { reportError } from "../lib/errorReporting";

// Filet de sécurité global : sans ceci, une erreur de rendu (n'importe où dans l'app)
// démonte tout l'arbre React et laisse une page blanche silencieuse — l'utilisateur n'a
// alors aucun moyen de savoir qu'il faut recharger. Ici, on affiche un écran explicite
// avec un bouton de rechargement à la place.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Erreur applicative interceptée :", error, info);
    reportError(error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Un problème est survenu</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              L'application a rencontré une erreur inattendue. Un rechargement suffit en général à la résoudre.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg active:scale-95"
          >
            <RotateCw className="h-4 w-4" />
            Recharger l'application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
