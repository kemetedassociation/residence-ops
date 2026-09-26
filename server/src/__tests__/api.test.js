import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "node:fs";
import request from "supertest";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { app } from "../app.js";
import { db } from "../db/db.js";

let residenceId, buildingId, managerToken, managerId;

beforeAll(() => {
  residenceId = nanoid();
  buildingId = nanoid();
  managerId = nanoid();

  db.prepare(
    "INSERT INTO residences (id, name, address, city, latitude, longitude, total_buildings, manager_email, created_at) VALUES (?, 'Résidence Test', 'Adresse', 'Ville', 48.85, 2.35, 1, 'manager@test.fr', ?)"
  ).run(residenceId, new Date().toISOString());

  db.prepare("INSERT INTO buildings (id, residence_id, name, floors) VALUES (?, ?, 'Bâtiment A', 4)").run(buildingId, residenceId);

  db.prepare(
    "INSERT INTO users (id, role, name, email, password, phone, residence_id, building_id, room, lease_number, lease_status, created_at) VALUES (?, 'manager', 'Manager Test', 'manager@test.fr', ?, '', ?, NULL, '', NULL, 'none', ?)"
  ).run(managerId, bcrypt.hashSync("manager123", 10), residenceId, new Date().toISOString());
});

afterAll(() => {
  db.close();
  const file = process.env.DB_PATH;
  [file, `${file}-wal`, `${file}-shm`].forEach((f) => fs.existsSync(f) && fs.unlinkSync(f));
});

describe("health", () => {
  it("responds ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe("auth", () => {
  it("logs in the manager", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "manager@test.fr", password: "manager123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    managerToken = res.body.token;
  });

  it("rejects a wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "manager@test.fr", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("rejects a malformed registration payload", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "not-an-email", password: "123" });
    expect(res.status).toBe(400);
  });

  it("registers a new resident without a lease (limited access)", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Alice Dupuis",
      email: `alice-${nanoid(5)}@test.fr`,
      password: "password123",
      accepted_privacy: true,
      residence_id: residenceId,
      building_id: buildingId,
      room: "101",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.lease_status).toBe("none");
  });

  it("triggers a password reset email without leaking account existence", async () => {
    const known = await request(app).post("/api/auth/forgot-password").send({ email: "manager@test.fr" });
    const unknown = await request(app).post("/api/auth/forgot-password").send({ email: "nobody@test.fr" });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
  });

  it("rejects an invalid reset token", async () => {
    const res = await request(app).post("/api/auth/reset-password").send({ token: "invalid-token-1234567890", password: "newpassword123" });
    expect(res.status).toBe(400);
  });
});

describe("incidents lifecycle with lease gating", () => {
  let residentToken, residentId, reporter2Token, reporter2Id;

  beforeAll(async () => {
    const reg1 = await request(app).post("/api/auth/register").send({
      name: "Bruno Sans Bail",
      email: `bruno-${nanoid(5)}@test.fr`,
      password: "password123",
      accepted_privacy: true,
      residence_id: residenceId,
      building_id: buildingId,
      room: "202",
    });
    residentToken = reg1.body.token;
    residentId = reg1.body.user.id;

    const reg2 = await request(app).post("/api/auth/register").send({
      name: "Chloé Voisine",
      email: `chloe-${nanoid(5)}@test.fr`,
      password: "password123",
      accepted_privacy: true,
      residence_id: residenceId,
      building_id: buildingId,
      room: "303",
      lease_number: "BAIL-TEST",
    });
    reporter2Token = reg2.body.token;
    reporter2Id = reg2.body.user.id;
    // Manually verify the lease as a manager would.
    db.prepare("UPDATE users SET lease_status = 'verified' WHERE id = ?").run(reporter2Id);
  });

  it("blocks incident creation without a verified lease", async () => {
    const res = await request(app)
      .post("/api/incidents")
      .set("Authorization", `Bearer ${residentToken}`)
      .send({ type: "eau", description: "Fuite dans la salle de bain", building_id: buildingId });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("LEASE_REQUIRED");
  });

  it("rejects an invalid incident type", async () => {
    const res = await request(app)
      .post("/api/incidents")
      .set("Authorization", `Bearer ${reporter2Token}`)
      .send({ type: "meteorite", description: "Un problème très étrange" });
    expect(res.status).toBe(400);
  });

  let incidentId;

  it("allows a resident with a verified lease to report an incident", async () => {
    const res = await request(app)
      .post("/api/incidents")
      .set("Authorization", `Bearer ${reporter2Token}`)
      .send({ type: "eau", description: "Fuite dans la salle de bain commune", building_id: buildingId, priority: "normal" });
    expect(res.status).toBe(201);
    expect(res.body.incident.status).toBe("signale");
    incidentId = res.body.incident.id;
  });

  it("shows the incident to every resident of the residence (community feed)", async () => {
    const res = await request(app).get("/api/incidents").set("Authorization", `Bearer ${residentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.incidents.some((i) => i.id === incidentId)).toBe(true);
  });

  it("prevents the reporter from confirming their own incident", async () => {
    const res = await request(app)
      .post("/api/confirmations")
      .set("Authorization", `Bearer ${reporter2Token}`)
      .send({ incident_id: incidentId });
    expect(res.status).toBe(400);
  });

  it("blocks confirmation from a resident without a verified lease", async () => {
    const res = await request(app)
      .post("/api/confirmations")
      .set("Authorization", `Bearer ${residentToken}`)
      .send({ incident_id: incidentId });
    expect(res.status).toBe(403);
  });

  it("auto-validates the incident once the confirmation threshold is reached", async () => {
    db.prepare("UPDATE users SET lease_status = 'verified' WHERE id = ?").run(residentId);

    const res = await request(app)
      .post("/api/confirmations")
      .set("Authorization", `Bearer ${residentToken}`)
      .send({ incident_id: incidentId });

    expect(res.status).toBe(201);
    expect(res.body.incident.is_validated).toBe(true);
    expect(res.body.incident.status).toBe("confirme");
  });

  it("lets a manager assign a technician, which creates an intervention and moves the incident to en_cours", async () => {
    const techId = nanoid();
    db.prepare(
      "INSERT INTO users (id, role, name, email, password, created_at) VALUES (?, 'technicien', 'Tech Test', ?, ?, ?)"
    ).run(techId, `tech-${nanoid(5)}@test.fr`, bcrypt.hashSync("x", 10), new Date().toISOString());

    const res = await request(app)
      .patch(`/api/incidents/${incidentId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ assigned_to: techId });

    expect(res.status).toBe(200);
    expect(res.body.incident.status).toBe("en_cours");

    const interventions = await request(app).get("/api/interventions").set("Authorization", `Bearer ${managerToken}`);
    expect(interventions.body.interventions.some((iv) => iv.incident_id === incidentId)).toBe(true);
  });

  it("resolving the incident notifies the reporter", async () => {
    const res = await request(app)
      .patch(`/api/incidents/${incidentId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "resolu" });
    expect(res.status).toBe(200);
    expect(res.body.incident.resolved_date).toBeTruthy();

    const notifs = await request(app).get("/api/notifications").set("Authorization", `Bearer ${reporter2Token}`);
    expect(notifs.body.notifications.some((n) => n.type === "resolution")).toBe(true);
  });
});

describe("posts and feedback", () => {
  it("rejects post creation from a non-manager", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "Simple Résident",
      email: `simple-${nanoid(5)}@test.fr`,
      password: "password123",
      accepted_privacy: true,
    });
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${reg.body.token}`)
      .send({ title: "Test", content: "Contenu" });
    expect(res.status).toBe(403);
  });

  it("lets a manager publish a post and hides drafts from residents", async () => {
    const created = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "Actualité test", content: "Contenu de test", published: false });
    expect(created.status).toBe(201);

    const reg = await request(app).post("/api/auth/register").send({
      name: "Lecteur Actus",
      email: `lecteur-${nanoid(5)}@test.fr`,
      password: "password123",
      accepted_privacy: true,
    });
    const list = await request(app).get("/api/posts").set("Authorization", `Bearer ${reg.body.token}`);
    expect(list.body.posts.some((p) => p.id === created.body.post.id)).toBe(false);
  });

  it("masks the author email on community suggestions", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "Suggéreur",
      email: `suggereur-${nanoid(5)}@test.fr`,
      password: "password123",
      accepted_privacy: true,
    });
    await request(app)
      .post("/api/feedback")
      .set("Authorization", `Bearer ${reg.body.token}`)
      .send({ type: "suggestion", message: "Installer un vélo en libre-service" });

    const list = await request(app).get("/api/feedback?type=suggestion").set("Authorization", `Bearer ${managerToken}`);
    const item = list.body.feedback.find((f) => f.message.includes("vélo"));
    expect(item.author_email_masked).toMatch(/^.\*\*\*@/);
  });
});

describe("white-label branding (residence-as-tenant)", () => {
  it("defaults a fresh residence to the standard plan with no branding", async () => {
    const res = await request(app).get("/api/residences");
    const residence = res.body.residences.find((r) => r.id === residenceId);
    expect(residence.plan).toBe("standard");
    expect(residence.display_name).toBeNull();
  });

  it("rejects branding updates from a non-manager", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "Résident Quelconque",
      email: `quelconque-${nanoid(5)}@test.fr`,
      password: "password123",
      accepted_privacy: true,
    });
    const res = await request(app)
      .put(`/api/residences/${residenceId}`)
      .set("Authorization", `Bearer ${reg.body.token}`)
      .send({ plan: "premium" });
    expect(res.status).toBe(403);
  });

  it("rejects a malformed primary_color", async () => {
    const res = await request(app)
      .put(`/api/residences/${residenceId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ plan: "premium", primary_color: "not-a-color" });
    expect(res.status).toBe(400);
  });

  it("lets a manager upgrade to premium and set a custom brand", async () => {
    const res = await request(app)
      .put(`/api/residences/${residenceId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ plan: "premium", display_name: "Residence Ops — Les Oiseaux", primary_color: "#7c3aed" });

    expect(res.status).toBe(200);
    expect(res.body.residence.plan).toBe("premium");
    expect(res.body.residence.display_name).toBe("Residence Ops — Les Oiseaux");
    expect(res.body.residence.primary_color).toBe("#7c3aed");

    const publicRes = await request(app).get("/api/residences");
    const residence = publicRes.body.residences.find((r) => r.id === residenceId);
    expect(residence.display_name).toBe("Residence Ops — Les Oiseaux");
  });
});

describe("GDPR — consent, export and erasure", () => {
  it("refuses registration without accepting the privacy policy", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Sans Consentement",
      email: `sansconsentement-${nanoid(5)}@test.fr`,
      password: "password123",
    });
    expect(res.status).toBe(400);
  });

  it("records a timestamped consent when a resident registers", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "Consentant",
      email: `consentant-${nanoid(5)}@test.fr`,
      password: "password123",
      accepted_privacy: true,
    });
    expect(reg.status).toBe(201);

    const consent = db.prepare("SELECT * FROM consents WHERE user_id = ?").get(reg.body.user.id);
    expect(consent).toBeTruthy();
    expect(consent.type).toBe("privacy_policy");
  });

  it("lets a resident export all of their personal data", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "Export Moi",
      email: `export-${nanoid(5)}@test.fr`,
      password: "password123",
      accepted_privacy: true,
      residence_id: residenceId,
      building_id: buildingId,
      lease_number: "BAIL-EXPORT",
    });

    await request(app)
      .post("/api/feedback")
      .set("Authorization", `Bearer ${reg.body.token}`)
      .send({ type: "suggestion", message: "Une suggestion à retrouver dans mon export" });

    const res = await request(app).get("/api/privacy/export").set("Authorization", `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.profile.email).toBe(reg.body.user.email);
    expect(res.body.feedback_submitted.length).toBe(1);
    expect(res.body.consents.some((c) => c.type === "privacy_policy")).toBe(true);

    const logged = db.prepare("SELECT * FROM data_requests WHERE user_id = ? AND type = 'export'").get(reg.body.user.id);
    expect(logged).toBeTruthy();
  });

  it("anonymizes a resident's account on erasure while keeping their incident history", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "À Effacer",
      email: `aeffacer-${nanoid(5)}@test.fr`,
      password: "password123",
      accepted_privacy: true,
      residence_id: residenceId,
      building_id: buildingId,
      lease_number: "BAIL-EFFACE",
    });
    db.prepare("UPDATE users SET lease_status = 'verified' WHERE id = ?").run(reg.body.user.id);

    const incident = await request(app)
      .post("/api/incidents")
      .set("Authorization", `Bearer ${reg.body.token}`)
      .send({ type: "autre", description: "Incident conservé après effacement du compte" });
    expect(incident.status).toBe(201);

    const del = await request(app).delete("/api/privacy").set("Authorization", `Bearer ${reg.body.token}`);
    expect(del.status).toBe(200);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(reg.body.user.id);
    expect(user.name).toBe("Utilisateur supprimé");
    expect(user.is_anonymized).toBe(1);
    expect(user.email).not.toBe(reg.body.user.email);

    const stillThere = db.prepare("SELECT * FROM incidents WHERE id = ?").get(incident.body.incident.id);
    expect(stillThere).toBeTruthy();
    expect(stillThere.reporter_id).toBe(reg.body.user.id);

    // The anonymized account can no longer authenticate with its original password.
    const loginAttempt = await request(app)
      .post("/api/auth/login")
      .send({ email: reg.body.user.email, password: "password123" });
    expect(loginAttempt.status).toBe(401);
  });
});

describe("resident card and wallet", () => {
  let residentToken, residentId;

  beforeAll(async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "Porte Monnaie",
      email: `wallet-${nanoid(5)}@test.fr`,
      password: "password123",
      accepted_privacy: true,
      residence_id: residenceId,
      building_id: buildingId,
    });
    residentToken = reg.body.token;
    residentId = reg.body.user.id;
    db.prepare("UPDATE users SET lease_status = 'verified' WHERE id = ?").run(residentId);
  });

  it("creates a card on demand with a zero balance", async () => {
    const res = await request(app).get("/api/cards/me").set("Authorization", `Bearer ${residentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.card.balance_cents).toBe(0);
    expect(res.body.card.qr_token).toBeTruthy();
  });

  it("rejects a credit request from a resident (manager-only)", async () => {
    const res = await request(app)
      .post(`/api/cards/${residentId}/credit`)
      .set("Authorization", `Bearer ${residentToken}`)
      .send({ amount_cents: 1000, reason: "Test" });
    expect(res.status).toBe(403);
  });

  it("lets a manager credit a resident's card and notifies them", async () => {
    const res = await request(app)
      .post(`/api/cards/${residentId}/credit`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ amount_cents: 1500, reason: "Recharge à l'accueil" });

    expect(res.status).toBe(200);
    expect(res.body.card.balance_cents).toBe(1500);
    expect(res.body.transactions.length).toBe(1);

    const notifs = await request(app).get("/api/notifications").set("Authorization", `Bearer ${residentToken}`);
    expect(notifs.body.notifications.some((n) => n.message.includes("15.00"))).toBe(true);
  });

  it("never lets the balance go negative", async () => {
    // Direct debit attempt beyond the current balance must throw and leave the balance untouched.
    const { applyWalletTransaction } = await import("../lib/wallet.js");
    const card = db.prepare("SELECT * FROM resident_cards WHERE user_id = ?").get(residentId);
    expect(() => applyWalletTransaction(card.id, 999999, "debit", "Trop gros débit", null)).toThrow();

    const unchanged = db.prepare("SELECT * FROM resident_cards WHERE id = ?").get(card.id);
    expect(unchanged.balance_cents).toBe(1500);
  });

  it("blocks the card when the account is anonymized", async () => {
    await request(app).delete("/api/privacy").set("Authorization", `Bearer ${residentToken}`);
    const card = db.prepare("SELECT * FROM resident_cards WHERE user_id = ?").get(residentId);
    expect(card.status).toBe("blocked");
  });
});

describe("restaurant — menus and reservations", () => {
  let residentToken, residentId, menuId;

  beforeAll(async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "Gourmet Test",
      email: `gourmet-${nanoid(5)}@test.fr`,
      password: "password123",
      accepted_privacy: true,
      residence_id: residenceId,
      building_id: buildingId,
    });
    residentToken = reg.body.token;
    residentId = reg.body.user.id;
    db.prepare("UPDATE users SET lease_status = 'verified' WHERE id = ?").run(residentId);
  });

  it("rejects menu creation from a resident", async () => {
    const res = await request(app)
      .post("/api/menus")
      .set("Authorization", `Bearer ${residentToken}`)
      .send({ menu_date: "2026-10-01", meal: "midi", items: ["Test"] });
    expect(res.status).toBe(403);
  });

  it("lets a manager publish a menu", async () => {
    const res = await request(app)
      .post("/api/menus")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ menu_date: "2026-10-01", meal: "midi", items: ["Poulet basquaise", "Curry de légumes"] });
    expect(res.status).toBe(201);
    menuId = res.body.menu.id;
  });

  it("rejects a duplicate menu for the same date and meal", async () => {
    const res = await request(app)
      .post("/api/menus")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ menu_date: "2026-10-01", meal: "midi", items: ["Autre plat"] });
    expect(res.status).toBe(409);
  });

  it("lets a verified resident reserve a dish without paying by card", async () => {
    const res = await request(app)
      .post("/api/reservations")
      .set("Authorization", `Bearer ${residentToken}`)
      .send({ menu_id: menuId, dish: "Poulet basquaise", pay_with_card: false });
    expect(res.status).toBe(201);
    expect(res.body.reservation.paid_with_card).toBe(0);
  });

  it("rejects a reservation for a dish not on the menu", async () => {
    const res = await request(app)
      .post("/api/reservations")
      .set("Authorization", `Bearer ${residentToken}`)
      .send({ menu_id: menuId, dish: "Plat inexistant", pay_with_card: false });
    expect(res.status).toBe(400);
  });

  it("aggregates reservations by dish for the manager", async () => {
    const res = await request(app)
      .get(`/api/reservations?menu_id=${menuId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.aggregate.find((a) => a.dish === "Poulet basquaise").count).toBe(1);
  });

  it("debits the wallet when paying with the resident card, and refunds on cancellation", async () => {
    await request(app)
      .post(`/api/cards/${residentId}/credit`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ amount_cents: 1000, reason: "Recharge" });

    const paidMenu = await request(app)
      .post("/api/menus")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ menu_date: "2026-10-02", meal: "soir", items: ["Gratin"] });

    const reservation = await request(app)
      .post("/api/reservations")
      .set("Authorization", `Bearer ${residentToken}`)
      .send({ menu_id: paidMenu.body.menu.id, dish: "Gratin", pay_with_card: true });
    expect(reservation.status).toBe(201);

    let card = await request(app).get("/api/cards/me").set("Authorization", `Bearer ${residentToken}`);
    expect(card.body.card.balance_cents).toBe(650); // 1000 - 350

    await request(app)
      .patch(`/api/reservations/${reservation.body.reservation.id}/cancel`)
      .set("Authorization", `Bearer ${residentToken}`)
      .send();

    card = await request(app).get("/api/cards/me").set("Authorization", `Bearer ${residentToken}`);
    expect(card.body.card.balance_cents).toBe(1000);
  });
});

describe("administration — documents and appointments", () => {
  let residentToken, residentId;

  beforeAll(async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "Démarche Test",
      email: `demarche-${nanoid(5)}@test.fr`,
      password: "password123",
      accepted_privacy: true,
      residence_id: residenceId,
      building_id: buildingId,
    });
    residentToken = reg.body.token;
    residentId = reg.body.user.id;
    db.prepare("UPDATE users SET lease_status = 'verified' WHERE id = ?").run(residentId);
  });

  it("lets a resident request a document and notifies the manager", async () => {
    const res = await request(app)
      .post("/api/documents")
      .set("Authorization", `Bearer ${residentToken}`)
      .send({ type: "attestation_residence" });
    expect(res.status).toBe(201);
    expect(res.body.document.status).toBe("demande");

    const notifs = await request(app).get("/api/notifications").set("Authorization", `Bearer ${managerToken}`);
    expect(notifs.body.notifications.some((n) => n.title.includes("document"))).toBe(true);
  });

  it("lets a manager mark a document ready and notifies the resident", async () => {
    const list = await request(app).get("/api/documents").set("Authorization", `Bearer ${managerToken}`);
    const doc = list.body.documents.find((d) => d.user_id === residentId);

    const up = await request(app)
      .post("/api/files")
      .set("Authorization", `Bearer ${managerToken}`)
      .attach("file", Buffer.from("%PDF-1.4\n%%EOF\n"), { filename: "test.pdf", contentType: "application/pdf" });
    const res = await request(app)
      .patch(`/api/documents/${doc.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "pret", file_url: up.body.file.url });
    expect(res.status).toBe(200);
    expect(res.body.document.status).toBe("pret");

    const notifs = await request(app).get("/api/notifications").set("Authorization", `Bearer ${residentToken}`);
    expect(notifs.body.notifications.some((n) => n.title.includes("Document disponible"))).toBe(true);
  });

  it("lets a manager publish a slot and a resident book it", async () => {
    const start = new Date(Date.now() + 3 * 86400000).toISOString();
    const end = new Date(Date.now() + 3 * 86400000 + 1800000).toISOString();

    const slot = await request(app)
      .post("/api/availability-slots")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ start_at: start, end_at: end });
    expect(slot.status).toBe(201);

    const booking = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${residentToken}`)
      .send({ slot_id: slot.body.slot.id, note: "Question sur mon bail" });
    expect(booking.status).toBe(201);

    const doubleBooking = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ slot_id: slot.body.slot.id, note: "Tentative concurrente" });
    expect(doubleBooking.status).not.toBe(201);
  });

  it("frees the slot when the resident cancels their appointment", async () => {
    const mine = await request(app).get("/api/appointments").set("Authorization", `Bearer ${residentToken}`);
    const appointment = mine.body.appointments[0];

    const res = await request(app)
      .patch(`/api/appointments/${appointment.id}/cancel`)
      .set("Authorization", `Bearer ${residentToken}`);
    expect(res.status).toBe(200);

    const slot = db.prepare("SELECT * FROM availability_slots WHERE id = ?").get(appointment.slot_id);
    expect(slot.is_booked).toBe(0);
  });
});

describe("leisure activities", () => {
  let residentToken;

  beforeAll(async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "Loisirs Test",
      email: `loisirs-${nanoid(5)}@test.fr`,
      password: "password123",
      accepted_privacy: true,
      residence_id: residenceId,
      building_id: buildingId,
    });
    residentToken = reg.body.token;
  });

  it("rejects activity creation from a resident", async () => {
    const res = await request(app)
      .post("/api/activities")
      .set("Authorization", `Bearer ${residentToken}`)
      .send({ title: "Test", activity_date: "2026-10-05", start_time: "18:00" });
    expect(res.status).toBe(403);
  });

  it("lets a manager publish an activity and notifies residents", async () => {
    const res = await request(app)
      .post("/api/activities")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "Soirée jeux de société", category: "jeux", activity_date: "2026-10-05", start_time: "19:00", location: "Salle commune" });
    expect(res.status).toBe(201);

    const notifs = await request(app).get("/api/notifications").set("Authorization", `Bearer ${residentToken}`);
    expect(notifs.body.notifications.some((n) => n.message.includes("Soirée jeux de société"))).toBe(true);
  });

  it("lists activities for residents in date order", async () => {
    const res = await request(app).get("/api/activities").set("Authorization", `Bearer ${residentToken}`);
    expect(res.status).toBe(200);
    const dates = res.body.activities.map((a) => a.activity_date);
    expect(dates).toEqual([...dates].sort());
  });
});

describe("Suivi des erreurs client", () => {
  let residentToken;

  beforeAll(async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "Erreurs Test",
      email: `erreurs-${nanoid(5)}@test.fr`,
      password: "password123",
      accepted_privacy: true,
      residence_id: residenceId,
      building_id: buildingId,
    });
    residentToken = reg.body.token;
  });

  it("accepts an error report without authentication", async () => {
    const res = await request(app)
      .post("/api/client-errors")
      .send({ message: "Écran blanc au changement de page", url: "https://residence-ops.test/profil" });
    expect(res.status).toBe(201);
  });

  it("rejects a report missing the required message field", async () => {
    const res = await request(app).post("/api/client-errors").send({ url: "https://residence-ops.test/" });
    expect(res.status).toBe(400);
  });

  it("blocks a resident from reading the error log", async () => {
    const res = await request(app).get("/api/client-errors").set("Authorization", `Bearer ${residentToken}`);
    expect(res.status).toBe(403);
  });

  it("lets a manager read the recent error log, most recent first", async () => {
    const res = await request(app).get("/api/client-errors").set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.errors.some((e) => e.message.includes("Écran blanc"))).toBe(true);
  });
});

describe("Amorçage production", () => {
  it("refuse de démarrer sans les variables INITIAL_*", async () => {
    const { bootstrapProduction } = await import("../db/bootstrap.js");
    delete process.env.INITIAL_MANAGER_EMAIL;
    expect(() => bootstrapProduction()).toThrow(/INITIAL_RESIDENCE_NAME/);
  });

  it("refuse un mot de passe gestionnaire trop court", async () => {
    const { bootstrapProduction } = await import("../db/bootstrap.js");
    process.env.INITIAL_RESIDENCE_NAME = "X";
    process.env.INITIAL_MANAGER_EMAIL = "x@x.fr";
    process.env.INITIAL_MANAGER_PASSWORD = "court";
    expect(() => bootstrapProduction()).toThrow(/12 caractères/);
    delete process.env.INITIAL_RESIDENCE_NAME;
    delete process.env.INITIAL_MANAGER_EMAIL;
    delete process.env.INITIAL_MANAGER_PASSWORD;
  });
});

describe("Documents PDF privés", () => {
  let residentToken, otherToken, docId, fileUrl, replyUrl;
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

  async function makeResident(name) {
    const reg = await request(app).post("/api/auth/register").send({
      name, email: `${name.toLowerCase()}-${nanoid(5)}@test.fr`, password: "password123",
      accepted_privacy: true, residence_id: residenceId, building_id: buildingId, lease_number: "BAIL-PDF",
    });
    db.prepare("UPDATE users SET lease_status = 'verified' WHERE id = ?").run(reg.body.user.id);
    return reg.body.token;
  }

  beforeAll(async () => {
    residentToken = await makeResident("Pdfun");
    otherToken = await makeResident("Pdfdeux");
  });

  it("accepte un vrai PDF déposé par un résident", async () => {
    const res = await request(app).post("/api/files").set("Authorization", `Bearer ${residentToken}`).attach("file", pdf, { filename: "justificatif.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(201);
    expect(res.body.file.url).toMatch(/^\/api\/files\//);
    fileUrl = res.body.file.url;
  });

  it("refuse un faux PDF (contenu qui ne correspond pas au format)", async () => {
    const res = await request(app).post("/api/files").set("Authorization", `Bearer ${residentToken}`).attach("file", Buffer.from("<script>alert(1)</script>"), { filename: "faux.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(400);
  });

  it("refuse un format non autorisé", async () => {
    const res = await request(app).post("/api/files").set("Authorization", `Bearer ${residentToken}`).attach("file", Buffer.from("MZ"), { filename: "x.exe", contentType: "application/octet-stream" });
    expect(res.status).toBe(400);
  });

  it("accepte Word, Excel, texte, GIF et HEIC selon leur contenu réel", async () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    const cases = [
      ["contrat.docx", zip],
      ["budget.xlsx", zip],
      ["notes.txt", Buffer.from("Bonjour, ceci est un justificatif.")],
      ["liste.csv", Buffer.from("a;b\n1;2\n")],
      ["anim.gif", Buffer.from("GIF89a....")],
      ["photo.heic", Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(8)])],
      ["ancien.doc", Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])],
    ];
    for (const [filename, content] of cases) {
      const res = await request(app).post("/api/files").set("Authorization", `Bearer ${residentToken}`).attach("file", content, { filename, contentType: "application/octet-stream" });
      expect(res.status, filename).toBe(201);
    }
  });

  it("accepte un PDF même si le navigateur envoie un type MIME générique (cas Windows)", async () => {
    const res = await request(app).post("/api/files").set("Authorization", `Bearer ${residentToken}`).attach("file", pdf, { filename: "scan.PDF", contentType: "application/octet-stream" });
    expect(res.status).toBe(201);
  });

  it("refuse un faux Word (contenu texte renommé .docx) et les formats dangereux", async () => {
    for (const [filename, content] of [
      ["faux.docx", Buffer.from("pas un zip")],
      ["page.html", Buffer.from("<html><script>alert(1)</script></html>")],
      ["image.svg", Buffer.from("<svg onload=alert(1)/>")],
      ["script.js", Buffer.from("alert(1)")],
      ["binaire.txt", Buffer.from([0x41, 0x00, 0x42])],
    ]) {
      const res = await request(app).post("/api/files").set("Authorization", `Bearer ${residentToken}`).attach("file", content, { filename, contentType: "text/plain" });
      expect(res.status, filename).toBe(400);
    }
  });

  it("sert un PDF en affichage direct mais un Word en téléchargement", async () => {
    const pdfRes = await request(app).get(fileUrl).set("Authorization", `Bearer ${residentToken}`);
    expect(pdfRes.headers["content-disposition"]).toMatch(/^inline/);

    const up = await request(app).post("/api/files").set("Authorization", `Bearer ${residentToken}`).attach("file", Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]), { filename: "cv.docx", contentType: "application/octet-stream" });
    const docx = await request(app).get(up.body.file.url).set("Authorization", `Bearer ${residentToken}`);
    expect(docx.status).toBe(200);
    expect(docx.headers["content-disposition"]).toMatch(/^attachment/);
    expect(docx.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("refuse le dépôt sans authentification", async () => {
    const res = await request(app).post("/api/files").attach("file", pdf, { filename: "a.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(401);
  });

  it("crée une demande avec pièce jointe, et refuse la pièce d'un autre utilisateur", async () => {
    const stolen = await request(app).post("/api/documents").set("Authorization", `Bearer ${otherToken}`).send({ type: "attestation_residence", attachment_url: fileUrl });
    expect(stolen.status).toBe(400);

    const res = await request(app).post("/api/documents").set("Authorization", `Bearer ${residentToken}`).send({ type: "attestation_residence", attachment_url: fileUrl });
    expect(res.status).toBe(201);
    docId = res.body.document.id;
  });

  it("le propriétaire et le gestionnaire peuvent lire le fichier, pas un autre résident", async () => {
    const own = await request(app).get(fileUrl).set("Authorization", `Bearer ${residentToken}`);
    expect(own.status).toBe(200);
    expect(own.headers["content-type"]).toContain("application/pdf");
    const mgr = await request(app).get(fileUrl).set("Authorization", `Bearer ${managerToken}`);
    expect(mgr.status).toBe(200);
    const other = await request(app).get(fileUrl).set("Authorization", `Bearer ${otherToken}`);
    expect(other.status).toBe(404);
    const anon = await request(app).get(fileUrl);
    expect(anon.status).toBe(401);
  });

  it("le gestionnaire répond avec un PDF, lisible ensuite par le résident concerné uniquement", async () => {
    const up = await request(app).post("/api/files").set("Authorization", `Bearer ${managerToken}`).attach("file", pdf, { filename: "attestation.pdf", contentType: "application/pdf" });
    expect(up.status).toBe(201);
    replyUrl = up.body.file.url;

    const patch = await request(app).patch(`/api/documents/${docId}`).set("Authorization", `Bearer ${managerToken}`).send({ status: "pret", file_url: replyUrl });
    expect(patch.status).toBe(200);

    const own = await request(app).get(replyUrl).set("Authorization", `Bearer ${residentToken}`);
    expect(own.status).toBe(200);
    const other = await request(app).get(replyUrl).set("Authorization", `Bearer ${otherToken}`);
    expect(other.status).toBe(404);
  });

  it("refuse qu'un gestionnaire référence une URL arbitraire", async () => {
    const res = await request(app).patch(`/api/documents/${docId}`).set("Authorization", `Bearer ${managerToken}`).send({ file_url: "https://evil.example/x.pdf" });
    expect(res.status).toBe(400);
  });

  it("supprime physiquement les fichiers lors de l'effacement du compte", async () => {
    await request(app).delete("/api/privacy").set("Authorization", `Bearer ${residentToken}`);
    const mgr = await request(app).get(fileUrl).set("Authorization", `Bearer ${managerToken}`);
    expect(mgr.status).toBe(404);
  });
});

describe("Paiement en ligne — plusieurs prestataires", () => {
  let token, userId, otherToken;
  const stripeCreated = [];
  const fakeStripe = {
    checkout: {
      sessions: {
        create: async (params) => {
          const id = `cs_test_${nanoid(8)}`;
          stripeCreated.push({ id, params });
          return { id, url: `https://checkout.stripe.test/${id}` };
        },
        retrieve: async () => ({ payment_status: "unpaid", status: "open" }),
      },
    },
    balance: { retrieve: async () => ({}) },
  };

  async function resident(name) {
    const reg = await request(app).post("/api/auth/register").send({
      name, email: `${name.toLowerCase()}-${nanoid(5)}@test.fr`, password: "password123",
      accepted_privacy: true, residence_id: residenceId, building_id: buildingId, lease_number: "BAIL-PAY",
    });
    db.prepare("UPDATE users SET lease_status = 'verified' WHERE id = ?").run(reg.body.user.id);
    return { token: reg.body.token, id: reg.body.user.id };
  }

  const auth = (t) => ({ Authorization: `Bearer ${t}` });
  const balance = async (t) => (await request(app).get("/api/cards/me").set(auth(t))).body.card.balance_cents;
  const saveProvider = (id, enabled, config) =>
    request(app).put(`/api/payments/settings/${id}`).set(auth(managerToken)).send({ enabled, config });
  const checkout = (t, provider, amount_cents) =>
    request(app).post("/api/payments/checkout").set(auth(t)).send({ provider, amount_cents });

  async function stripeWebhook(event, { secret = "whsec_test_secret_for_unit_tests", sign = true } = {}) {
    const { Stripe } = await import("../lib/stripe.js");
    const payload = JSON.stringify(event);
    const r = request(app).post("/api/payments/webhook").set("Content-Type", "application/json");
    if (sign) r.set("stripe-signature", Stripe.webhooks.generateTestHeaderString({ payload, secret }));
    return r.send(payload);
  }
  const stripeDone = (sessionId, amount, extra = {}) => ({
    id: `evt_${nanoid(6)}`,
    type: "checkout.session.completed",
    data: { object: { id: sessionId, payment_status: "paid", amount_total: amount, currency: "eur", ...extra } },
  });

  // Faux serveurs Mollie / PayPal / HelloAsso : on intercepte les appels sortants du serveur.
  const remote = { mollie: {}, paypal: { status: "CREATED" }, helloasso: { order: null } };
  let fetchSpy;
  let mollieCount = 0;

  beforeAll(async () => {
    const { __setStripeForTests } = await import("../lib/stripe.js");
    __setStripeForTests(fakeStripe);
    ({ token, id: userId } = await resident("Payeur"));
    ({ token: otherToken } = await resident("Autre"));

    const realFetch = globalThis.fetch;
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init = {}) => {
      const u = String(url);
      const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
      if (u.startsWith("https://api.mollie.com/v2/payments") && init.method === "POST") {
        const body = JSON.parse(init.body);
        const id = `tr_test${++mollieCount}`;
        remote.mollie = { id, status: "open", amount: body.amount, webhookUrl: body.webhookUrl };
        return reply({ id, _links: { checkout: { href: "https://mollie.test/pay" } } }, 201);
      }
      if (u.startsWith("https://api.mollie.com/v2/payments/")) return reply(remote.mollie);
      if (u.startsWith("https://api.mollie.com/v2/methods")) return init.headers.Authorization.includes("bonne") ? reply({ count: 1 }) : reply({ detail: "Invalid API key" }, 401);
      if (u.includes("/v1/oauth2/token")) return reply({ access_token: "pp_token" });
      if (u.endsWith("/v2/checkout/orders") && init.method === "POST") {
        remote.paypal = { status: "CREATED", amount: JSON.parse(init.body).purchase_units[0].amount };
        return reply({ id: "PPORDER1", links: [{ rel: "payer-action", href: "https://paypal.test/approve" }] }, 201);
      }
      if (u.endsWith("/capture")) {
        remote.paypal.status = "COMPLETED";
        return reply({ status: "COMPLETED", purchase_units: [{ payments: { captures: [{ status: "COMPLETED", amount: { value: remote.paypal.amount.value, currency_code: "EUR" } }] } }] });
      }
      if (u.includes("/v2/checkout/orders/PPORDER1")) return reply({ status: remote.paypal.status });
      if (u.includes("/oauth2/token")) return reply({ access_token: "ha_token" });
      if (u.endsWith("/checkout-intents") && init.method === "POST") return reply({ id: 4242, redirectUrl: "https://helloasso.test/pay" }, 200);
      if (u.includes("/checkout-intents/4242")) return reply({ id: 4242, order: remote.helloasso.order });
      return realFetch(url, init);
    });

    // Stripe : configuré par variables d'environnement (rétrocompatibilité).
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests";
  });

  afterAll(async () => {
    fetchSpy.mockRestore();
    const { __setStripeForTests } = await import("../lib/stripe.js");
    __setStripeForTests(null);
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  // ---- Réglages administrateur ----
  it("réserve les réglages de paiement au gestionnaire", async () => {
    expect((await request(app).get("/api/payments/settings").set(auth(token))).status).toBe(403);
    expect((await saveProvider("mollie", false, {}).set(auth(token))).status).toBe(403);
  });

  it("ne renvoie jamais les secrets et les stocke chiffrés", async () => {
    const res = await saveProvider("mollie", true, { apiKey: "test_bonne_cle_secrete_123" });
    expect(res.status).toBe(200);
    const list = await request(app).get("/api/payments/settings").set(auth(managerToken));
    const mollie = list.body.providers.find((p) => p.id === "mollie");
    expect(mollie.enabled).toBe(true);
    expect(mollie.fields[0].isSet).toBe(true);
    expect(JSON.stringify(list.body)).not.toContain("bonne_cle_secrete");
    const row = db.prepare("SELECT config FROM payment_settings WHERE provider = 'mollie'").get();
    expect(row.config).not.toContain("bonne_cle_secrete");
  });

  it("refuse d'activer un moyen de paiement incomplet, et conserve un secret laissé vide", async () => {
    expect((await saveProvider("paypal", true, { clientId: "abc" })).status).toBe(400);
    await saveProvider("mollie", true, { apiKey: "" });
    expect(db.prepare("SELECT enabled FROM payment_settings WHERE provider = 'mollie'").get().enabled).toBe(1);
  });

  it("bloque la configuration des paiements tant que l'app est en mode démonstration hébergé", async () => {
    process.env.RENDER = "true";
    const blocked = await saveProvider("mollie", true, { apiKey: "test_x" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("DEMO_MODE");
    process.env.SEED_MODE = "production";
    expect((await saveProvider("mollie", true, { apiKey: "test_bonne_cle_secrete_123" })).status).toBe(200);
    delete process.env.SEED_MODE;
    delete process.env.RENDER;
  });

  it("teste la connexion d'un prestataire", async () => {
    const ok = await request(app).post("/api/payments/settings/mollie/test").set(auth(managerToken));
    expect(ok.status).toBe(200);
    await saveProvider("mollie", true, { apiKey: "test_mauvaise" });
    const ko = await request(app).post("/api/payments/settings/mollie/test").set(auth(managerToken));
    expect(ko.status).toBe(400);
    await saveProvider("mollie", true, { apiKey: "test_bonne_cle_secrete_123" });
  });

  it("propose aux résidents uniquement les moyens activés", async () => {
    const res = await request(app).get("/api/payments/config").set(auth(token));
    expect(res.body.providers.map((p) => p.id).sort()).toEqual(["mollie", "stripe"]);
    expect(res.body.min_cents).toBe(500);
    expect(res.body.max_cents).toBe(20000);
  });

  it("refuse un montant hors bornes, un prestataire désactivé et le paiement pour un gestionnaire", async () => {
    for (const amount of [100, 25000, 10.5, -1000]) expect((await checkout(token, "mollie", amount)).status, String(amount)).toBe(400);
    expect((await checkout(token, "paypal", 1000)).status).toBe(400);
    expect((await checkout(managerToken, "mollie", 1000)).status).toBe(403);
  });

  // ---- Stripe ----
  it("Stripe : crée la session, refuse un webhook mal signé, crédite une seule fois", async () => {
    const res = await checkout(token, "stripe", 2000);
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^https:\/\/checkout\.stripe\.test\//);
    const { id, params } = stripeCreated.at(-1);
    expect(params.line_items[0].price_data.unit_amount).toBe(2000);
    expect(await balance(token)).toBe(0);

    expect((await stripeWebhook(stripeDone(id, 2000), { sign: false })).status).toBe(400);
    expect((await stripeWebhook(stripeDone(id, 2000), { secret: "whsec_autre" })).status).toBe(400);
    expect(await balance(token)).toBe(0);

    expect((await stripeWebhook(stripeDone(id, 2000))).status).toBe(200);
    expect((await stripeWebhook(stripeDone(id, 2000))).status).toBe(200);
    expect(await balance(token)).toBe(2000);
  });

  it("Stripe : ne crédite pas si le montant encaissé diffère, ni si le paiement n'a pas abouti", async () => {
    await checkout(token, "stripe", 1000);
    const { id } = stripeCreated.at(-1);
    await stripeWebhook(stripeDone(id, 50));
    await stripeWebhook(stripeDone(id, 1000, { payment_status: "unpaid" }));
    await stripeWebhook(stripeDone("cs_test_inconnue", 1000));
    expect(await balance(token)).toBe(2000);
  });

  // ---- Mollie ----
  it("Mollie : ne crédite qu'après vérification chez Mollie, et une seule fois", async () => {
    const res = await checkout(token, "mollie", 3000);
    expect(res.status).toBe(201);
    expect(res.body.url).toBe("https://mollie.test/pay");
    expect(remote.mollie.amount).toEqual({ currency: "EUR", value: "30.00" });
    expect(remote.mollie.webhookUrl).toMatch(/\/api\/payments\/webhook\/mollie$/);

    // Webhook forgé alors que Mollie dit « open » : rien ne doit être crédité.
    await request(app).post("/api/payments/webhook/mollie").type("form").send({ id: remote.mollie.id });
    expect(await balance(token)).toBe(2000);

    remote.mollie.status = "paid";
    await request(app).post("/api/payments/webhook/mollie").type("form").send({ id: remote.mollie.id });
    await request(app).post("/api/payments/webhook/mollie").type("form").send({ id: remote.mollie.id });
    expect(await balance(token)).toBe(5000);
  });

  it("Mollie : un webhook pour un identifiant inconnu répond 200 sans rien révéler", async () => {
    const res = await request(app).post("/api/payments/webhook/mollie").type("form").send({ id: "tr_inconnu" });
    expect(res.status).toBe(200);
  });

  // ---- PayPal ----
  it("PayPal : la capture côté serveur au retour crédite une seule fois", async () => {
    await saveProvider("paypal", true, { clientId: "cid", clientSecret: "csecret", mode: "sandbox" });
    const res = await checkout(token, "paypal", 1500);
    expect(res.status).toBe(201);
    expect(res.body.url).toBe("https://paypal.test/approve");
    const payment = db.prepare("SELECT id FROM payments WHERE provider = 'paypal'").get();

    // Retour sans approbation : pas de capture, pas de crédit.
    await request(app).get(`/api/payments/return/paypal?payment_id=${payment.id}`);
    expect(await balance(token)).toBe(5000);

    remote.paypal.status = "APPROVED";
    const back = await request(app).get(`/api/payments/return/paypal?payment_id=${payment.id}&token=PPORDER1`);
    expect(back.status).toBe(302);
    expect(back.headers.location).toContain("paiement=succes");
    await request(app).get(`/api/payments/return/paypal?payment_id=${payment.id}`);
    expect(await balance(token)).toBe(6500);
  });

  it("PayPal : un retour avec un identifiant de paiement d'un autre prestataire est ignoré", async () => {
    const stripePayment = db.prepare("SELECT id FROM payments WHERE provider = 'stripe' LIMIT 1").get();
    const res = await request(app).get(`/api/payments/return/paypal?payment_id=${stripePayment.id}`);
    expect(res.headers.location).toContain("paiement=annule");
  });

  // ---- HelloAsso ----
  it("HelloAsso : réconcilie via l'API (jamais via les paramètres de l'URL de retour)", async () => {
    await saveProvider("helloasso", true, { clientId: "hid", clientSecret: "hsecret", organizationSlug: "mon-asso", mode: "sandbox" });
    const res = await checkout(token, "helloasso", 1000);
    expect(res.status).toBe(201);
    expect(res.body.url).toBe("https://helloasso.test/pay");
    const payment = db.prepare("SELECT id FROM payments WHERE provider = 'helloasso'").get();

    // Retour avec code=succeeded forgé, mais HelloAsso ne renvoie aucune commande : rien crédité.
    await request(app).get(`/api/payments/return/helloasso?payment_id=${payment.id}&checkoutIntentId=4242&code=succeeded`);
    expect(await balance(token)).toBe(6500);

    remote.helloasso.order = { payments: [{ state: "Authorized", amount: 1000 }] };
    await request(app).post("/api/payments/webhook/helloasso").send({ metadata: { payment_id: payment.id } });
    await request(app).post("/api/payments/webhook/helloasso").send({ metadata: { payment_id: payment.id } });
    expect(await balance(token)).toBe(7500);
  });

  // ---- Suivi et rapprochement ----
  it("ne montre le statut d'un paiement qu'à son propriétaire", async () => {
    const { id } = db.prepare("SELECT id FROM payments WHERE provider = 'mollie'").get();
    const own = await request(app).get(`/api/payments/status?payment_id=${id}`).set(auth(token));
    expect(own.body.status).toBe("paid");
    expect((await request(app).get(`/api/payments/status?payment_id=${id}`).set(auth(otherToken))).status).toBe(404);
  });

  it("le rapprochement manuel rattrape un webhook manqué", async () => {
    await checkout(token, "mollie", 500);
    remote.mollie.status = "paid";
    const before = await balance(token);
    const res = await request(app).post("/api/payments/reconcile").set(auth(managerToken));
    expect(res.body.credited).toBeGreaterThanOrEqual(1);
    expect(await balance(token)).toBe(before + 500);
    expect((await request(app).post("/api/payments/reconcile").set(auth(token))).status).toBe(403);
  });

  it("répond 503 avec un message clair quand plus aucun moyen n'est activé", async () => {
    for (const id of ["mollie", "paypal", "helloasso"]) await saveProvider(id, false, {});
    delete process.env.STRIPE_SECRET_KEY;
    const res = await checkout(token, "mollie", 1000);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("PAYMENTS_DISABLED");
  });
});

describe("Visibilité des pièces jointes d'un signalement", () => {
  let author, neighbour, techToken;
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(16)]);
  const auth = (t) => ({ Authorization: `Bearer ${t}` });

  async function resident(name) {
    const reg = await request(app).post("/api/auth/register").send({
      name, email: `${name.toLowerCase()}-${nanoid(5)}@test.fr`, password: "password123",
      accepted_privacy: true, residence_id: residenceId, building_id: buildingId, lease_number: "BAIL-VIS",
    });
    db.prepare("UPDATE users SET lease_status = 'verified' WHERE id = ?").run(reg.body.user.id);
    return { token: reg.body.token, id: reg.body.user.id };
  }
  const upload = (t, buf, filename, contentType) => request(app).post("/api/files").set(auth(t)).attach("file", buf, { filename, contentType });
  const report = (t, body) => request(app).post("/api/incidents").set(auth(t)).send({ type: "eau", description: "Fuite visible dans le couloir", building_id: buildingId, ...body });
  const seenBy = async (t, id) => (await request(app).get("/api/incidents").set(auth(t))).body.incidents.find((i) => i.id === id);

  beforeAll(async () => {
    author = await resident("Auteur");
    neighbour = await resident("Voisin");
    const techId = nanoid();
    const techEmail = `tech-vis-${nanoid(5)}@test.fr`;
    db.prepare("INSERT INTO users (id, role, name, email, password, residence_id, created_at) VALUES (?, 'technicien', 'Tech Vis', ?, ?, ?, ?)")
      .run(techId, techEmail, bcrypt.hashSync("password123", 10), residenceId, new Date().toISOString());
    techToken = (await request(app).post("/api/auth/login").send({ email: techEmail, password: "password123" })).body.token;
  });

  it("un signalement privé cache ses pièces jointes aux autres résidents mais pas à la gestion, au technicien ni à l'auteur", async () => {
    const pdfUp = await upload(author.token, pdf, "devis.pdf", "application/pdf");
    const imgUp = await upload(author.token, png, "photo.png", "image/png");
    const res = await report(author.token, { photos_visibility: "private", photo_urls: [pdfUp.body.file.url, imgUp.body.file.url] });
    expect(res.status).toBe(201);
    expect(res.body.incident.photos_visibility).toBe("private");
    expect(res.body.incident.attachments.map((a) => a.mime).sort()).toEqual(["application/pdf", "image/png"]);
    const id = res.body.incident.id;

    const other = await seenBy(neighbour.token, id);
    expect(other.photo_urls).toEqual([]);
    expect(other.attachments).toEqual([]);
    expect(other.photos_hidden).toBe(true);

    for (const t of [author.token, managerToken, techToken]) {
      const seen = await seenBy(t, id);
      expect(seen.attachments.length).toBe(2);
      expect((await request(app).get(pdfUp.body.file.url).set(auth(t))).status).toBe(200);
    }
    expect((await request(app).get(pdfUp.body.file.url).set(auth(neighbour.token))).status).toBe(404);
    expect((await request(app).get(pdfUp.body.file.url)).status).toBe(401);
  });

  it("un signalement public montre ses pièces jointes aux résidents de la résidence", async () => {
    const up = await upload(author.token, pdf, "plan.pdf", "application/pdf");
    const res = await report(author.token, { photos_visibility: "public", photo_urls: [up.body.file.url] });
    const seen = await seenBy(neighbour.token, res.body.incident.id);
    expect(seen.attachments[0]).toMatchObject({ name: "plan.pdf", mime: "application/pdf" });
    expect(seen.photos_hidden).toBe(false);
    expect((await request(app).get(up.body.file.url).set(auth(neighbour.token))).status).toBe(200);
  });

  it("est privé par défaut quand le résident ne choisit rien", async () => {
    const up = await upload(author.token, png, "a.png", "image/png");
    const res = await report(author.token, { photo_urls: [up.body.file.url] });
    expect(res.body.incident.photos_visibility).toBe("private");
  });

  it("refuse la pièce jointe d'un autre, une URL arbitraire, et un fichier public déclaré privé", async () => {
    const mine = await upload(author.token, png, "b.png", "image/png");
    expect((await report(neighbour.token, { photo_urls: [mine.body.file.url] })).status).toBe(400);
    expect((await report(author.token, { photo_urls: ["https://evil.example/x.png"] })).status).toBe(400);
    expect((await report(author.token, { photos_visibility: "private", photo_urls: ["/uploads/abc.png"] })).status).toBe(400);
  });

  it("garde la compatibilité avec un ancien client qui n'envoie que des fichiers publics", async () => {
    const res = await report(author.token, { photo_urls: ["/uploads/ancienne-photo.png"] });
    expect(res.status).toBe(201);
    expect(res.body.incident.photos_visibility).toBe("public");
  });

  it("la suppression du compte retire les pièces jointes privées du signalement", async () => {
    const solo = await resident("Efface");
    const up = await upload(solo.token, pdf, "perso.pdf", "application/pdf");
    const res = await report(solo.token, { photo_urls: [up.body.file.url] });
    await request(app).delete("/api/privacy").set(auth(solo.token));
    const seen = await seenBy(managerToken, res.body.incident.id);
    expect(seen.attachments).toEqual([]);
    expect((await request(app).get(up.body.file.url).set(auth(managerToken))).status).toBe(404);
  });
});

describe("Sauvegarde GitHub — robustesse de la configuration", () => {
  it("nettoie un token collé avec retour à la ligne, espaces, guillemets ou caractères invisibles", async () => {
    const { cleanToken } = await import("../lib/githubBackupStore.js");
    expect(cleanToken('  "github_pat_abc123"\n')).toBe("github_pat_abc123");
    expect(cleanToken("github_pat_abc​123\r\n")).toBe("github_pat_abc123");
    expect(cleanToken(undefined)).toBe("");
  });

  it("transforme l'erreur d'en-tête invalide en erreur de configuration SANS divulguer le token", async () => {
    const { downloadEncryptedBackup } = await import("../lib/githubBackupStore.js");
    process.env.GITHUB_BACKUP_TOKEN = "github_pat_secret";
    process.env.GITHUB_BACKUP_REPO = "compte/depot";
    const spy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError('Headers.append: "Bearer github_pat_secret" is an invalid header value.'));
    let error;
    try {
      await downloadEncryptedBackup();
    } catch (e) {
      error = e;
    }
    spy.mockRestore();
    delete process.env.GITHUB_BACKUP_TOKEN;
    delete process.env.GITHUB_BACKUP_REPO;
    expect(error.configError).toBe(true);
    expect(error.message).not.toContain("github_pat_secret");
  });
});

describe("Accompagnement psychologique", () => {
  const auth = (t) => ({ Authorization: `Bearer ${t}` });
  let res1, res2, proId, invite, proToken, feed, slotIds;
  const future = (hours) => new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const proEmail = `psy-${nanoid(5)}@test.fr`;

  async function resident(name, lease = "none") {
    const reg = await request(app).post("/api/auth/register").send({
      name, email: `${name.toLowerCase()}-${nanoid(5)}@test.fr`, password: "password123",
      accepted_privacy: true, residence_id: residenceId, building_id: buildingId, room: "12",
    });
    return { token: reg.body.token, id: reg.body.user.id };
  }

  beforeAll(async () => {
    res1 = await resident("Aidee"); // volontairement SANS bail vérifié
    res2 = await resident("Curieux");
  });

  it("l'annuaire est public (sans connexion) et réservé aux professionnels actifs", async () => {
    const created = await request(app).post("/api/care/manage/professionals").set(auth(managerToken)).send({
      name: "Dr Test Psy", title: "Psychologue clinicien", specialties: ["Anxiété", "Stress des études"], languages: ["Français"],
      email: proEmail, phone: "0600000000", mode: "les_deux", free: true,
    });
    expect(created.status).toBe(201);
    proId = created.body.professional.id;
    invite = created.body.invite_code;
    expect(created.body.professional.claimed).toBe(false);

    const list = await request(app).get("/api/care/professionals");
    expect(list.status).toBe(200);
    const pro = list.body.professionals.find((p) => p.id === proId);
    expect(pro.specialties).toContain("Anxiété");
    expect(pro.invite_hash).toBeUndefined();
    expect(JSON.stringify(list.body)).not.toContain("access_hash");
  });

  it("réserve la gestion de l'annuaire au gestionnaire", async () => {
    expect((await request(app).get("/api/care/manage/professionals").set(auth(res1.token))).status).toBe(403);
    expect((await request(app).post("/api/care/manage/professionals").send({})).status).toBe(401);
  });

  it("le professionnel active son invitation (usage unique) et choisit son mot de passe", async () => {
    const weak = await request(app).post("/api/care/pro/claim").send({ invite_code: invite, password: "court" });
    expect(weak.status).toBe(400);
    const bad = await request(app).post("/api/care/pro/claim").send({ invite_code: "code-inexistant-123", password: "un-mot-de-passe-solide" });
    expect(bad.status).toBe(400);

    const ok = await request(app).post("/api/care/pro/claim").send({ invite_code: invite, password: "un-mot-de-passe-solide" });
    expect(ok.status).toBe(201);
    proToken = ok.body.token;
    feed = ok.body.feed_token;
    expect((await request(app).post("/api/care/pro/claim").send({ invite_code: invite, password: "autre-mot-de-passe-solide" })).status).toBe(400);
  });

  it("la gestion ne peut PAS réinviter (donc s'approprier) un compte déjà activé", async () => {
    const res = await request(app).post(`/api/care/manage/professionals/${proId}/invite`).set(auth(managerToken));
    expect(res.status).toBe(409);
  });

  it("un jeton de professionnel n'ouvre aucune route utilisateur, et inversement", async () => {
    expect((await request(app).get("/api/notifications").set(auth(proToken))).status).toBe(401);
    expect((await request(app).get("/api/care/pro/appointments").set(auth(res1.token))).status).toBe(403);
    expect((await request(app).get("/api/care/pro/appointments").set(auth(managerToken))).status).toBe(403);
  });

  it("connexion du professionnel : refuse un mauvais mot de passe", async () => {
    expect((await request(app).post("/api/care/pro/login").send({ email: proEmail, password: "faux-mot-de-passe" })).status).toBe(401);
    expect((await request(app).post("/api/care/pro/login").send({ email: proEmail, password: "un-mot-de-passe-solide" })).status).toBe(200);
  });

  it("le professionnel publie ses créneaux (les chevauchements et le passé sont ignorés)", async () => {
    const slots = [
      { start_at: future(48), end_at: future(49) },
      { start_at: future(50), end_at: future(51) },
      { start_at: future(48.5), end_at: future(49.5) }, // chevauche le premier
      { start_at: future(-5), end_at: future(-4) }, // passé
    ];
    const res = await request(app).post("/api/care/pro/slots").set(auth(proToken)).send({ slots });
    expect(res.body.created).toBe(2);
    slotIds = (await request(app).get(`/api/care/professionals/${proId}/slots`).set(auth(res1.token))).body.slots.map((s) => s.id);
    expect(slotIds.length).toBe(2);
  });

  it("un résident SANS bail vérifié peut réserver (l'aide n'est jamais conditionnée)", async () => {
    const res = await request(app).post("/api/care/appointments").set(auth(res1.token)).send({ slot_id: slotIds[0], note: "Je me sens dépassé(e)", share_contact: false });
    expect(res.status).toBe(201);
    expect(res.body.appointment.professional_name).toBe("Dr Test Psy");
  });

  it("un créneau ne peut être réservé qu'une fois", async () => {
    const res = await request(app).post("/api/care/appointments").set(auth(res2.token)).send({ slot_id: slotIds[0] });
    expect(res.status).toBe(409);
  });

  it("le professionnel voit le rendez-vous ; le contact n'apparaît que si le résident l'a partagé", async () => {
    const list = await request(app).get("/api/care/pro/appointments").set(auth(proToken));
    expect(list.body.appointments.length).toBe(1);
    expect(list.body.appointments[0].resident.name).toBe("Aidee");
    expect(list.body.appointments[0].resident.email).toBeUndefined();
    expect(list.body.appointments[0].note).toContain("dépassé");
  });

  it("la gestion ne voit que des compteurs : aucun rendez-vous, aucune identité", async () => {
    const list = await request(app).get("/api/care/manage/professionals").set(auth(managerToken));
    const pro = list.body.professionals.find((p) => p.id === proId);
    expect(pro.appointments_total).toBe(1);
    expect(pro.claimed).toBe(true);
    expect(JSON.stringify(list.body)).not.toContain("Aidee");
    expect(JSON.stringify(list.body)).not.toContain("dépassé");
    expect((await request(app).get("/api/care/appointments/mine").set(auth(managerToken))).status).toBe(403);
  });

  it("fichier d'agenda (.ics) : titre neutre, réservé au propriétaire", async () => {
    const mine = await request(app).get("/api/care/appointments/mine").set(auth(res1.token));
    const id = mine.body.appointments[0].id;
    const ics = await request(app).get(`/api/care/appointments/${id}/ics`).set(auth(res1.token));
    expect(ics.status).toBe(200);
    expect(ics.headers["content-type"]).toContain("text/calendar");
    expect(ics.text).toContain("BEGIN:VEVENT");
    expect(ics.text).toContain("SUMMARY:Rendez-vous — Dr Test Psy");
    expect(ics.text).not.toContain("dépassé");
    expect((await request(app).get(`/api/care/appointments/${id}/ics`).set(auth(res2.token))).status).toBe(404);
  });

  it("agenda partagé (abonnement) : lisible avec le jeton secret uniquement", async () => {
    const ok = await request(app).get(`/api/care/feed/${feed}.ics`);
    expect(ok.status).toBe(200);
    expect(ok.text).toContain("SUMMARY:Consultation — Aidee");
    expect((await request(app).get("/api/care/feed/mauvais-jeton.ics")).status).toBe(404);
  });

  it("annulation : le créneau est libéré ; le résident ne peut pas annuler le rendez-vous d'un autre", async () => {
    const mine = (await request(app).get("/api/care/appointments/mine").set(auth(res1.token))).body.appointments[0];
    expect((await request(app).patch(`/api/care/appointments/${mine.id}/cancel`).set(auth(res2.token))).status).toBe(404);
    expect((await request(app).patch(`/api/care/appointments/${mine.id}/cancel`).set(auth(res1.token))).status).toBe(200);
    const free = (await request(app).get(`/api/care/professionals/${proId}/slots`).set(auth(res2.token))).body.slots;
    expect(free.length).toBe(2);
  });

  it("limite à 3 rendez-vous à venir par résident", async () => {
    await request(app).post("/api/care/pro/slots").set(auth(proToken)).send({
      slots: [3, 4, 5, 6].map((d) => ({ start_at: future(24 * d), end_at: future(24 * d + 1) })),
    });
    const slots = (await request(app).get(`/api/care/professionals/${proId}/slots`).set(auth(res2.token))).body.slots;
    const results = [];
    for (const s of slots.slice(0, 4)) results.push((await request(app).post("/api/care/appointments").set(auth(res2.token)).send({ slot_id: s.id })).status);
    expect(results).toEqual([201, 201, 201, 409]);
  });

  it("l'effacement du compte supprime les rendez-vous et libère les créneaux", async () => {
    await request(app).delete("/api/privacy").set(auth(res2.token));
    const free = (await request(app).get(`/api/care/professionals/${proId}/slots`).set(auth(res1.token))).body.slots;
    expect(free.length).toBe(6);
  });

  it("supprimer un professionnel annule ses rendez-vous", async () => {
    const slot = (await request(app).get(`/api/care/professionals/${proId}/slots`).set(auth(res1.token))).body.slots[0];
    await request(app).post("/api/care/appointments").set(auth(res1.token)).send({ slot_id: slot.id });
    expect((await request(app).delete(`/api/care/manage/professionals/${proId}`).set(auth(managerToken))).status).toBe(204);
    expect((await request(app).get("/api/care/appointments/mine").set(auth(res1.token))).body.appointments).toEqual([]);
    expect((await request(app).get("/api/care/professionals")).body.professionals.find((p) => p.id === proId)).toBeUndefined();
  });
});

describe("Plages de disponibilité (rendez-vous administratifs)", () => {
  const auth = (t) => ({ Authorization: `Bearer ${t}` });
  const future = (h) => new Date(Date.now() + h * 3600000).toISOString();

  it("crée plusieurs créneaux d'un coup et ignore passé et chevauchements", async () => {
    const slots = [
      { start_at: future(100), end_at: future(100.5) },
      { start_at: future(100.5), end_at: future(101) },
      { start_at: future(100.25), end_at: future(100.75) }, // chevauche les deux premiers
      { start_at: future(-3), end_at: future(-2) }, // passé
    ];
    const res = await request(app).post("/api/availability-slots/bulk").set(auth(managerToken)).send({ slots });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ created: 2, skipped: 2 });
  });

  it("réserve la création de plages au gestionnaire et refuse un lot invalide", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "SansDroit", email: `sd-${nanoid(5)}@test.fr`, password: "password123", accepted_privacy: true, residence_id: residenceId,
    });
    const body = { slots: [{ start_at: future(200), end_at: future(201) }] };
    expect((await request(app).post("/api/availability-slots/bulk").set(auth(reg.body.token)).send(body)).status).toBe(403);
    expect((await request(app).post("/api/availability-slots/bulk").set(auth(managerToken)).send({ slots: [] })).status).toBe(400);
    expect((await request(app).post("/api/availability-slots/bulk").set(auth(managerToken)).send({ slots: [{ start_at: "demain", end_at: "après" }] })).status).toBe(400);
  });
});
