import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pin, Newspaper } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { Carousel } from "../../components/ui/carousel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { api } from "../../lib/api";
import { useRealtime } from "../../lib/socket";
import { POST_CATEGORIES, findMeta, DEFAULT_POST_IMAGE } from "../../lib/constants";
import { formatDate, cn } from "../../lib/utils";

export function News() {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [openPost, setOpenPost] = useState(null);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: () => api.get("/posts").then((d) => d.posts),
  });

  useRealtime(["post:created", "post:updated", "post:deleted"], () => {
    queryClient.invalidateQueries({ queryKey: ["posts"] });
  });

  const filtered = useMemo(
    () => (categoryFilter === "all" ? posts : posts.filter((p) => p.category === categoryFilter)),
    [posts, categoryFilter]
  );
  const pinned = filtered.filter((p) => p.pinned);
  const recent = filtered.filter((p) => !p.pinned);

  const carouselPosts = useMemo(() => {
    const sorted = [...posts].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    return sorted.slice(0, 5);
  }, [posts]);

  function CategoryDot({ post }) {
    const category = findMeta(POST_CATEGORIES, post.category);
    return (
      <Badge variant="outline" style={{ borderColor: category?.color, color: category?.color }}>
        {category?.label || "Information"}
      </Badge>
    );
  }

  function PostCard({ post }) {
    return (
      <button onClick={() => setOpenPost(post)} className="block w-full overflow-hidden rounded-xl border border-border bg-card text-left card-elevated">
        <img src={post.cover_image_url || DEFAULT_POST_IMAGE} alt="" className="h-32 w-full object-cover" />
        <div className="p-4">
          <div className="mb-2 flex items-center gap-2">
            {post.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
            <CategoryDot post={post} />
            <span className="text-xs text-muted-foreground">{formatDate(post.published_at)}</span>
          </div>
          <h3 className="font-semibold">{post.title}</h3>
          <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{post.content}</p>
          <span className="mt-1.5 inline-block text-xs font-semibold text-primary">Lire la suite</span>
        </div>
      </button>
    );
  }

  return (
    <div className="pb-6">
      <div className="hero-gradient flex items-center gap-3 px-4 py-6 text-white">
        <Newspaper className="h-6 w-6" />
        <h1 className="text-xl font-bold">Actualités</h1>
      </div>

      <div className="mx-auto max-w-lg space-y-6 px-4 py-4">
        {isLoading ? (
          <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
        ) : (
          carouselPosts.length > 0 && (
            <Carousel
              items={carouselPosts}
              renderItem={(post) => (
                <button onClick={() => setOpenPost(post)} className="relative block aspect-[16/9] w-full text-left">
                  <img src={post.cover_image_url || DEFAULT_POST_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    {post.pinned && (
                      <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold">
                        <Pin className="h-3 w-3" /> Épinglé
                      </span>
                    )}
                    <p className="text-base font-bold leading-snug">{post.title}</p>
                    <p className="text-xs opacity-90">{formatDate(post.published_at)}</p>
                  </div>
                </button>
              )}
            />
          )
        )}

        <div className="hide-scrollbar flex gap-2 overflow-x-auto">
          <button
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              categoryFilter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
            )}
          >
            Toutes
          </button>
          {POST_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                categoryFilter === cat.value ? "text-white" : "border-border bg-card text-muted-foreground"
              )}
              style={categoryFilter === cat.value ? { backgroundColor: cat.color, borderColor: cat.color } : undefined}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          [0, 1].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <Skeleton className="h-32 w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))
        ) : (
          <>
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
              {filtered.length === 0 && <p className="text-sm text-muted-foreground">Aucune actualité pour le moment.</p>}
            </div>
          </>
        )}
      </div>

      <Dialog open={!!openPost} onOpenChange={(open) => !open && setOpenPost(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {openPost && (
            <>
              <img src={openPost.cover_image_url || DEFAULT_POST_IMAGE} alt="" className="-mx-6 -mt-6 h-40 w-[calc(100%+3rem)] object-cover" />
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <CategoryDot post={openPost} />
                  <span className="text-xs text-muted-foreground">{formatDate(openPost.published_at)}</span>
                </div>
                <DialogTitle>{openPost.title}</DialogTitle>
                <DialogDescription className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {openPost.content}
                </DialogDescription>
              </DialogHeader>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
