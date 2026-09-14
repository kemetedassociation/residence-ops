import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Pin, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { api } from "../../lib/api";
import { POST_CATEGORIES, findMeta } from "../../lib/constants";
import { formatDate } from "../../lib/utils";
import { cn } from "../../lib/utils";

const emptyForm = { title: "", content: "", category: "information", pinned: false, published: true };

export function NewsManager() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data: posts = [] } = useQuery({ queryKey: ["posts", "all"], queryFn: () => api.get("/posts").then((d) => d.posts) });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["posts", "all"] });
    queryClient.invalidateQueries({ queryKey: ["posts"] });
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(post) {
    setEditing(post);
    setForm({ title: post.title, content: post.content, category: post.category, pinned: post.pinned, published: post.published });
    setOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editing) await api.put(`/posts/${editing.id}`, form);
      else await api.post("/posts", form);
      toast.success(editing ? "Actualité mise à jour." : "Actualité publiée.");
      setOpen(false);
      invalidate();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cette actualité ?")) return;
    await api.del(`/posts/${id}`);
    invalidate();
  }

  async function togglePin(post) {
    await api.put(`/posts/${post.id}`, { pinned: !post.pinned });
    invalidate();
  }

  async function togglePublish(post) {
    await api.put(`/posts/${post.id}`, { published: !post.published });
    invalidate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des actualités</h1>
          <p className="text-sm text-muted-foreground">{posts.length} publication(s)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nouvelle actualité
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier l'actualité" : "Nouvelle actualité"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Titre</Label>
                <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POST_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="content">Contenu</Label>
                <Textarea
                  id="content"
                  rows={5}
                  required
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
                  Épingler
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm({ ...form, published: e.target.checked })}
                  />
                  Publier immédiatement
                </label>
              </div>
              <DialogFooter>
                <Button type="submit">{editing ? "Enregistrer" : "Publier"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {posts.map((post) => {
          const category = findMeta(POST_CATEGORIES, post.category);
          return (
            <Card key={post.id} className={cn("overflow-hidden", !post.published && "opacity-60")}>
              <div className="flex">
                <div className="w-1.5 shrink-0" style={{ background: category?.color || "#2563eb" }} />
                <div className="flex-1">
                  <CardHeader className="flex-row items-start justify-between space-y-0">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        {post.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                        <Badge variant="outline">{category?.label}</Badge>
                        {!post.published && <Badge variant="secondary">Brouillon</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(post.published_at)}</p>
                      <CardTitle className="text-base">{post.title}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => togglePin(post)} title="Épingler">
                        <Pin className={cn("h-4 w-4", post.pinned && "fill-primary text-primary")} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => togglePublish(post)} title="Publier/dépublier">
                        {post.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(post)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(post.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{post.content}</CardContent>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
