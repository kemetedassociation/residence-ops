import { Router } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db, withoutPassword } from "../db/db.js";
import { requireAuth, requireStaffPermission, parsePermissions, hasPermission, STAFF_MODULES } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { residenceIdForUser } from "../lib/residence.js";

export const staffRouter = Router();
staffRouter.use(requireAuth, requireStaffPermission("gestion_comptes"));

const permissionsField = z.array(z.enum(STAFF_MODULES.map((m) => m.key))).max(STAFF_MODULES.length).nullable();

function requester(req) {
  const row = db.prepare("SELECT permissions FROM users WHERE id = ?").get(req.userId);
  return parsePermissions(row.permissions);
}

// Un administrateur restreint (même avec la permission gestion_comptes) ne peut jamais accorder à
// quelqu'un d'autre plus que ce qu'il possède lui-même, ni créer un accès complet (permissions=null) :
// cette capacité reste réservée à l'administrateur principal, pour empêcher toute auto-promotion en
// chaîne par une personne non habilitée.
function assertCanGrant(requesterPerms, targetPerms) {
  if (requesterPerms === null) return targetPerms;
  if (targetPerms === null) {
    const err = new Error("Seul un administrateur à accès complet peut accorder un accès complet.");
    err.status = 403;
    throw err;
  }
  const forbidden = targetPerms.filter((p) => !hasPermission(requesterPerms, p));
  if (forbidden.length) {
    const err = new Error(`Vous ne pouvez pas accorder des permissions que vous n'avez pas vous-même : ${forbidden.join(", ")}.`);
    err.status = 403;
    throw err;
  }
  return targetPerms;
}

function staffView(u) {
  return { ...withoutPassword(u), permissions: parsePermissions(u.permissions), is_suspended: !!u.is_suspended };
}

staffRouter.get("/modules", (req, res) => {
  res.json({ modules: STAFF_MODULES, my_permissions: requester(req) });
});

staffRouter.get("/", (req, res) => {
  const residenceId = residenceIdForUser(req.userId);
  const rows = db
    .prepare("SELECT * FROM users WHERE residence_id = ? AND role IN ('manager', 'technicien') ORDER BY name")
    .all(residenceId);
  res.json({ staff: rows.map(staffView) });
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  password: z.string().min(12, "Le mot de passe doit contenir au moins 12 caractères.").max(200),
  role: z.enum(["manager", "technicien"]),
  permissions: permissionsField,
});

staffRouter.post("/", validate(createSchema), (req, res) => {
  const existing = db.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").get(req.body.email);
  if (existing) return res.status(409).json({ error: "Un compte existe déjà avec cet email." });

  let permissions;
  try {
    permissions = assertCanGrant(requester(req), req.body.permissions);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, role, name, email, password, phone, residence_id, building_id, room, lease_number, lease_status, permissions, is_suspended, created_at)
     VALUES (?, ?, ?, ?, ?, '', ?, NULL, '', NULL, 'none', ?, 0, ?)`
  ).run(id, req.body.role, req.body.name, req.body.email, bcrypt.hashSync(req.body.password, 10), residenceIdForUser(req.userId), permissions === null ? null : JSON.stringify(permissions), now);

  res.status(201).json({ staff: staffView(db.prepare("SELECT * FROM users WHERE id = ?").get(id)) });
});

function targetStaff(req, res) {
  const target = db.prepare("SELECT * FROM users WHERE id = ? AND role IN ('manager', 'technicien')").get(req.params.id);
  if (!target) {
    res.status(404).json({ error: "Compte introuvable." });
    return null;
  }
  return target;
}

// Un accès complet ne peut être modifié/suspendu/supprimé que par un autre accès complet : un
// administrateur restreint, même habilité à gérer les comptes, ne peut pas toucher au principal.
function assertCanTouch(requesterPerms, target) {
  if (requesterPerms !== null) return;
  void target;
}

staffRouter.patch("/:id/permissions", validate(z.object({ permissions: permissionsField })), (req, res) => {
  const target = targetStaff(req, res);
  if (!target) return;
  const myPerms = requester(req);
  if (parsePermissions(target.permissions) === null && myPerms !== null) {
    return res.status(403).json({ error: "Seul un autre administrateur à accès complet peut modifier un administrateur à accès complet." });
  }
  let permissions;
  try {
    permissions = assertCanGrant(myPerms, req.body.permissions);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
  db.prepare("UPDATE users SET permissions = ? WHERE id = ?").run(permissions === null ? null : JSON.stringify(permissions), target.id);
  res.json({ staff: staffView(db.prepare("SELECT * FROM users WHERE id = ?").get(target.id)) });
});

function countUnrestrictedAdmins(residenceId, excludeId) {
  return db
    .prepare("SELECT id, permissions FROM users WHERE residence_id = ? AND role = 'manager' AND id != ?")
    .all(residenceId, excludeId || "")
    .filter((u) => parsePermissions(u.permissions) === null).length;
}

staffRouter.patch("/:id/suspend", validate(z.object({ suspended: z.boolean() })), (req, res) => {
  const target = targetStaff(req, res);
  if (!target) return;
  if (target.id === req.userId) return res.status(400).json({ error: "Vous ne pouvez pas suspendre votre propre compte." });
  const myPerms = requester(req);
  if (parsePermissions(target.permissions) === null && myPerms !== null) {
    return res.status(403).json({ error: "Seul un autre administrateur à accès complet peut suspendre un administrateur à accès complet." });
  }
  if (req.body.suspended && parsePermissions(target.permissions) === null && countUnrestrictedAdmins(residenceIdForUser(req.userId), target.id) === 0) {
    return res.status(409).json({ error: "Impossible : ce serait le dernier administrateur à accès complet de la résidence." });
  }
  db.prepare("UPDATE users SET is_suspended = ? WHERE id = ?").run(req.body.suspended ? 1 : 0, target.id);
  res.json({ staff: staffView(db.prepare("SELECT * FROM users WHERE id = ?").get(target.id)) });
});

staffRouter.delete("/:id", (req, res) => {
  const target = targetStaff(req, res);
  if (!target) return;
  if (target.id === req.userId) return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte." });
  const myPerms = requester(req);
  if (parsePermissions(target.permissions) === null && myPerms !== null) {
    return res.status(403).json({ error: "Seul un autre administrateur à accès complet peut supprimer un administrateur à accès complet." });
  }
  if (parsePermissions(target.permissions) === null && countUnrestrictedAdmins(residenceIdForUser(req.userId), target.id) === 0) {
    return res.status(409).json({ error: "Impossible : ce serait le dernier administrateur à accès complet de la résidence." });
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(target.id);
  res.status(204).end();
});
