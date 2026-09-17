import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { api } from "../../lib/api";
import { formatDateTime, cn } from "../../lib/utils";

export function ErrorLog() {
  const [expanded, setExpanded] = useState(null);
  const { data: errors = [], isLoading } = useQuery({
    queryKey: ["client-errors"],
    queryFn: () => api.get("/client-errors").then((d) => d.errors),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Erreurs applicatives</h1>
        <p className="text-sm text-muted-foreground">
          Les 50 dernières erreurs rencontrées par les résidents et gestionnaires dans l'app — sans outil de suivi
          externe (Sentry ou équivalent), c'est la seule visibilité disponible sur les plantages réels.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      {!isLoading && errors.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Aucune erreur signalée récemment. 🎉
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {errors.map((err) => (
          <Card key={err.id}>
            <button className="w-full text-left" onClick={() => setExpanded(expanded === err.id ? null : err.id)}>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <CardTitle className="text-sm font-semibold">{err.message}</CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {formatDateTime(err.created_at)} {err.url ? `· ${err.url}` : ""}
                    </CardDescription>
                  </div>
                </div>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded === err.id && "rotate-180")} />
              </CardHeader>
            </button>
            {expanded === err.id && (
              <CardContent className="pt-0">
                {err.stack && (
                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">{err.stack}</pre>
                )}
                <p className="mt-2 text-xs text-muted-foreground">{err.user_agent}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
