import { useEffect, useState } from "react";
import { FileText, Lock, Users } from "lucide-react";
import { getToken } from "../lib/api";
import { openPrivateFile } from "../lib/files";

const cache = new Map();

// Les fichiers privés exigent le jeton de connexion : une balise <img src> ne peut pas l'envoyer.
// On les récupère donc avec l'en-tête d'autorisation et on les affiche via une URL locale.
function ProtectedImage({ url, className }) {
  const [src, setSrc] = useState(url.startsWith("/api/files/") ? cache.get(url) || null : url);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url.startsWith("/api/files/") || cache.has(url)) return;
    let cancelled = false;
    fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        cache.set(url, objectUrl);
        if (!cancelled) setSrc(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed) return <div className={`${className} flex items-center justify-center bg-muted text-xs text-muted-foreground`}>Indisponible</div>;
  if (!src) return <div className={`${className} animate-pulse bg-muted`} />;
  return <img src={src} alt="" className={className} />;
}

export function Attachments({ incident }) {
  const attachments = incident.attachments || [];
  if (incident.photos_hidden) {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" /> Les pièces jointes de ce signalement sont réservées à la gestion.
      </p>
    );
  }
  if (attachments.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex gap-2 overflow-x-auto">
        {attachments
          .filter((a) => a.mime?.startsWith("image/"))
          .map((a) => (
            <button key={a.url} type="button" onClick={() => openPrivateFile(a.url)} className="shrink-0">
              <ProtectedImage url={a.url} className="h-40 w-40 rounded-lg object-cover" />
            </button>
          ))}
      </div>
      {attachments
        .filter((a) => !a.mime?.startsWith("image/"))
        .map((a) => (
          <button
            key={a.url}
            type="button"
            onClick={() => openPrivateFile(a.url)}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-card p-2.5 text-left text-sm active:scale-[0.99]"
          >
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">{a.name}</span>
            <span className="text-xs text-primary">Ouvrir</span>
          </button>
        ))}
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {incident.photos_visibility === "private" ? (
          <>
            <Lock className="h-3 w-3" /> Visibles uniquement par la gestion
          </>
        ) : (
          <>
            <Users className="h-3 w-3" /> Visibles par les résidents de la résidence
          </>
        )}
      </p>
    </div>
  );
}
