import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { postCreateSchema, postPatchSchema } from "../schemas.js";
import { emitToResidence } from "../realtime.js";
import { residenceIdForUser } from "../lib/residence.js";
import { notifyResidence } from "./notifications.js";

export const postsRouter = Router();
postsRouter.use(requireAuth);

function withBools(post) {
  return post && { ...post, pinned: !!post.pinned, published: !!post.published };
}

function sortPosts(posts) {
  return [...posts].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.published_at) - new Date(a.published_at);
  });
}

postsRouter.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM posts").all().map(withBools);
  const posts = req.userRole === "manager" ? rows : rows.filter((p) => p.published);
  res.json({ posts: sortPosts(posts) });
});

postsRouter.post("/", requireRole("manager"), validate(postCreateSchema), (req, res) => {
  const { title, content, category, pinned, published, cover_image_url } = req.body;
  const now = new Date().toISOString();
  const post = {
    id: nanoid(),
    title,
    content,
    category,
    pinned: pinned ? 1 : 0,
    published: published ? 1 : 0,
    cover_image_url: cover_image_url || null,
    author_id: req.userId,
    published_at: now,
  };

  db.prepare(
    `INSERT INTO posts (id, title, content, category, pinned, published, cover_image_url, author_id, published_at)
     VALUES (@id, @title, @content, @category, @pinned, @published, @cover_image_url, @author_id, @published_at)`
  ).run(post);

  const full = withBools(post);
  const residenceId = residenceIdForUser(req.userId);
  emitToResidence(residenceId, "post:created", full);

  if (full.published && residenceId) {
    notifyResidence(residenceId, {
      title: "Nouvelle actualité",
      message: title,
      type: "info",
    });
  }

  res.status(201).json({ post: full });
});

postsRouter.put("/:id", requireRole("manager"), validate(postPatchSchema), (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Actualité introuvable." });

  const body = req.body;
  const updated = {
    ...post,
    ...body,
    pinned: body.pinned !== undefined ? (body.pinned ? 1 : 0) : post.pinned,
    published: body.published !== undefined ? (body.published ? 1 : 0) : post.published,
  };

  db.prepare(
    "UPDATE posts SET title=@title, content=@content, category=@category, pinned=@pinned, published=@published, cover_image_url=@cover_image_url WHERE id=@id"
  ).run(updated);

  const full = withBools(db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id));
  emitToResidence(residenceIdForUser(req.userId), "post:updated", full);
  res.json({ post: full });
});

postsRouter.delete("/:id", requireRole("manager"), (req, res) => {
  db.prepare("DELETE FROM posts WHERE id = ?").run(req.params.id);
  emitToResidence(residenceIdForUser(req.userId), "post:deleted", { id: req.params.id });
  res.status(204).end();
});
