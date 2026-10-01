import { db } from "../db/db.js";

// Un plat stocké est soit une chaîne (format historique, capacité illimitée), soit un objet
// {name, max_portions}. Cette normalisation centralisée évite à menus.js/reservations.js/
// wasteLogs.js de dupliquer la logique de parsing des deux formats.
export function normalizeMenuItem(item) {
  if (typeof item === "string") return { name: item, max_portions: null };
  return { name: item.name, max_portions: item.max_portions ?? null };
}

export function parseMenuItems(itemsJson) {
  return JSON.parse(itemsJson).map(normalizeMenuItem);
}

export function findMenuItem(itemsJson, dishName) {
  return parseMenuItems(itemsJson).find((it) => it.name === dishName) || null;
}

// Une seule requête groupée pour tous les menus demandés, plutôt qu'une requête par menu (N+1).
export function reservedCountsForMenus(menuIds) {
  if (menuIds.length === 0) return new Map();
  const rows = db
    .prepare(
      `SELECT menu_id, dish, COUNT(*) as reserved FROM meal_reservations
       WHERE status = 'reservee' AND menu_id IN (${menuIds.map(() => "?").join(",")})
       GROUP BY menu_id, dish`
    )
    .all(...menuIds);
  return new Map(rows.map((r) => [`${r.menu_id}::${r.dish}`, r.reserved]));
}

// Ajoute à chaque plat son nombre de réservations actives et le nombre de portions restantes
// (null si le plat n'a pas de quota défini = illimité). `remaining` est toujours borné à 0 pour
// qu'un quota réduit après coup sous le nombre déjà réservé ne produise jamais un nombre négatif.
export function enrichMenu(menu, reservedMap) {
  const items = parseMenuItems(menu.items).map((item) => {
    const reserved = reservedMap.get(`${menu.id}::${item.name}`) || 0;
    const remaining = item.max_portions == null ? null : Math.max(0, item.max_portions - reserved);
    return { ...item, reserved, remaining };
  });
  return { ...menu, items };
}
