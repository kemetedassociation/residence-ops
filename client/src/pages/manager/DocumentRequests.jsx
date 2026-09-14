import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Upload, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import { api, getToken } from "../../lib/api";
import { DOCUMENT_TYPES, DOCUMENT_STATUSES, labelFor, variantFor } from "../../lib/constants";
import { formatDateTime } from "../../lib/utils";

export function DocumentRequests() {
  const queryClient = useQueryClient();
  const { data: documents = [] } = useQuery({ queryKey: ["documents", "all"], queryFn: () => api.get("/documents").then((d) => d.documents) });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then((d) => d.users) });
  const [notes, setNotes] = useState({});
  const fileInputRefs = useRef({});

  const userName = (id) => users.find((u) => u.id === id)?.name || "—";

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["documents", "all"] });
  }

  async function updateStatus(id, status) {
    try {
      await api.patch(`/documents/${id}`, { status, admin_note: notes[id] });
      toast.success("Demande mise à jour.");
      invalidate();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleFile(id, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await api.patch(`/documents/${id}`, { file_url: data.url, status: "pret" });
      toast.success("Document envoyé au résident.");
      invalidate();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const pending = documents.filter((d) => d.status === "demande" || d.status === "en_traitement");
  const done = documents.filter((d) => d.status === "pret" || d.status === "refuse");

  function DocCard({ d }) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{userName(d.user_id)}</p>
              <p className="text-sm text-muted-foreground">{labelFor(DOCUMENT_TYPES, d.type)}</p>
            </div>
            <Badge variant={variantFor(DOCUMENT_STATUSES, d.status)}>{labelFor(DOCUMENT_STATUSES, d.status)}</Badge>
          </div>
          {d.note && <p className="text-sm text-muted-foreground">« {d.note} »</p>}
          <p className="text-xs text-muted-foreground">{formatDateTime(d.created_at)}</p>

          {(d.status === "demande" || d.status === "en_traitement") && (
            <>
              <Textarea
                rows={2}
                placeholder="Note interne (visible par le résident si refusé)"
                value={notes[d.id] ?? d.admin_note ?? ""}
                onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })}
              />
              <div className="flex flex-wrap gap-2">
                {d.status === "demande" && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(d.id, "en_traitement")}>
                    Prendre en charge
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => fileInputRefs.current[d.id]?.click()}>
                  <Upload className="h-3.5 w-3.5" />
                  Joindre le document
                </Button>
                <input
                  ref={(el) => (fileInputRefs.current[d.id] = el)}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFile(d.id, e)}
                />
                <Button size="sm" variant="ghost" onClick={() => updateStatus(d.id, "refuse")}>
                  <X className="h-3.5 w-3.5" />
                  Refuser
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Demandes de documents</h1>
        <p className="text-sm text-muted-foreground">{pending.length} en attente</p>
      </div>

      <div className="space-y-3">
        {pending.map((d) => (
          <DocCard key={d.id} d={d} />
        ))}
        {pending.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>}
      </div>

      {done.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <FileText className="h-4 w-4" />
            Historique
          </h2>
          <div className="space-y-3">
            {done.map((d) => (
              <DocCard key={d.id} d={d} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
