import { db } from "../db/db.js";

export function residenceIdForBuilding(buildingId) {
  if (!buildingId) return null;
  return db.prepare("SELECT residence_id FROM buildings WHERE id = ?").get(buildingId)?.residence_id || null;
}

export function residenceIdForUser(userId) {
  if (!userId) return null;
  return db.prepare("SELECT residence_id FROM users WHERE id = ?").get(userId)?.residence_id || null;
}
