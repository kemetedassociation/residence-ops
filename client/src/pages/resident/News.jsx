import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pin, Newspaper } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { api } from "../../lib/api";
import { useRealtime } from "../../lib/socket";
import { POST_CATEGORIES, findMeta } from "../../lib/constants";
import { formatDate } from "../../lib/utils";

export function News() {
  const queryClient = useQueryClient();

  const { data: posts = [] } = useQuery({
    queryKey: ["posts"],
    queryFn: () => api.get("/posts").then((d) => d.posts),
  });

  useRealtime(["post:created", "post:updated", "post:deleted"], () => {
    queryClient.invalidateQueries({ queryKey: ["posts"] });
  });

  const pinned = posts.filter((p) => p.pinned);
  const recent = posts.filter((p) => !p.pinned);

  function PostCard({ post }) {
    const category = findMeta(POST_CATEGORIES, post.category);
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card card-elevated">
        {post.cover_image_url ? (
          <img src={post.cover_image_url} alt="" className="h-32 w-full object-cover" />
        ) : (
          <div className="h-1.5 w-full" style={{ background: category?.color || "#2563eb" }} />
        )}
        <div className="p-4">
          <div className="mb-2 flex items-center gap-2">
            {post.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
            <Badge variant="outline" style={{ borderColor: category?.color, color: category?.color }}>
              {category?.label || "Information"}
            </Badge>
            <span className="text-xs text-muted-foreground">{formatDate(post.published_at)}</span>
          </div>
          <h3 className="font-semibold">{post.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{post.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <div className="hero-gradient flex items-center gap-3 px-4 py-6 text-white">
        <Newspaper className="h-6 w-6" />
        <h1 className="text-xl font-bold">Actualités</h1>
      </div>

      <div className="mx-auto max-w-lg space-y-6 px-4 py-4">
        {pinned.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Épinglé</h2>
            {pinned.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        <div className="space-y-3">
          {pinned.length > 0 && <h2 className="text-sm font-semibold text-muted-foreground">Récentes</h2>}
          {recent.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {posts.length === 0 && <p className="text-sm text-muted-foreground">Aucune actualité pour le moment.</p>}
        </div>
      </div>
    </div>
  );
}
