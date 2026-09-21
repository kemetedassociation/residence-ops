import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
