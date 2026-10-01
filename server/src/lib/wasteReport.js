import ExcelJS from "exceljs";
import { db } from "../db/db.js";
import { sendMail } from "./mailer.js";
import { parsePermissions, hasPermission } from "../middleware/auth.js";

async function buildWasteReportWorkbook(residenceId, sinceIso) {
  const rows = db
    .prepare(
      `SELECT menu_date, meal, dish, prepared, reserved, saved, lost FROM waste_logs
       WHERE residence_id = ? AND created_at >= ? ORDER BY menu_date ASC, meal ASC, dish ASC`
    )
    .all(residenceId, sinceIso);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Anti-gaspillage");
  sheet.columns = [
    { header: "Date", key: "menu_date", width: 14 },
    { header: "Repas", key: "meal", width: 10 },
    { header: "Plat", key: "dish", width: 30 },
    { header: "Préparé", key: "prepared", width: 10 },
    { header: "Réservé", key: "reserved", width: 10 },
    { header: "Sauvé", key: "saved", width: 10 },
    { header: "Perdu", key: "lost", width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };
  rows.forEach((r) => sheet.addRow(r));

  const totalSaved = rows.reduce((s, r) => s + r.saved, 0);
  const totalLost = rows.reduce((s, r) => s + r.lost, 0);
  sheet.addRow({});
  const totalRow = sheet.addRow({ dish: "Total", saved: totalSaved, lost: totalLost });
  totalRow.font = { bold: true };

  return workbook;
}

function recipientsForResidence(residenceId) {
  const residence = db.prepare("SELECT manager_email FROM residences WHERE id = ?").get(residenceId);
  const staff = db
    .prepare("SELECT email, permissions FROM users WHERE residence_id = ? AND role IN ('manager','technicien') AND is_suspended = 0")
    .all(residenceId);
  const emails = new Set();
  if (residence?.manager_email) emails.add(residence.manager_email);
  staff.forEach((u) => {
    if (hasPermission(parsePermissions(u.permissions), "restaurant")) emails.add(u.email);
  });
  return [...emails];
}

export async function sendWasteReportEmail(residenceId) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recipients = recipientsForResidence(residenceId);
  if (recipients.length === 0) return;

  const workbook = await buildWasteReportWorkbook(residenceId, since);
  const buffer = await workbook.xlsx.writeBuffer();

  await sendMail({
    to: recipients.join(","),
    subject: "Rapport hebdomadaire anti-gaspillage — Résidence Ops",
    html: "<p>Bonjour,</p><p>Veuillez trouver ci-joint le rapport anti-gaspillage de la semaine écoulée (quantités préparées, réservées, sauvées et perdues par plat).</p>",
    text: "Rapport anti-gaspillage de la semaine écoulée en pièce jointe.",
    attachments: [
      { filename: `anti-gaspillage-${new Date().toISOString().slice(0, 10)}.xlsx`, content: Buffer.from(buffer) },
    ],
  });
}

export async function sendWasteReportEmailsForAllResidences() {
  const residences = db.prepare("SELECT id FROM residences").all();
  for (const r of residences) {
    try {
      await sendWasteReportEmail(r.id);
    } catch (err) {
      console.error(`Échec de l'envoi du rapport anti-gaspillage pour la résidence ${r.id} :`, err);
    }
  }
}
