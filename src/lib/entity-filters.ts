import type { EntityFull } from "@/lib/types";

/**
 * Pure entity predicates. Kept free of server imports so the dispatch picker
 * and the roster list can share exactly the same rules.
 */

export type EntityFilters = {
  q?: string;
  status?: string;
  zone?: string;
  category?: string;
  vehicle?: string;
  avail?: string; // YYYY-MM-DD
};

/** True when the entity has an availability block covering the given date. */
export function coversDate(entity: EntityFull, date: string): boolean {
  return (entity.entity_availability ?? []).some((b) => b.date?.slice(0, 10) === date);
}

/** True when the entity has a rate row for the category, i.e. can do the work. */
export function canPerform(entity: EntityFull, categoryId: string): boolean {
  return (entity.entity_rates ?? []).some((r) => r.service_category_id === categoryId);
}

/** The rate row used for autofill when this entity is added to a job. */
export function rateFor(entity: EntityFull, categoryId: string | null) {
  if (!categoryId) return null;
  return (entity.entity_rates ?? []).find((r) => r.service_category_id === categoryId) ?? null;
}

/**
 * Free-text search spans entity name, worker names, POC, and equipment.
 *
 * Equipment matches on the notes as well as the item name, so a crew logged as
 * carrying a "General Moving Kit" is found by searching "dolly" even though no
 * separate dolly row exists — the contents live in that preset's note.
 */
export function matchesText(entity: EntityFull, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;

  if (entity.entity_name?.toLowerCase().includes(needle)) return true;
  if ((entity.worker_names ?? []).some((w) => w.toLowerCase().includes(needle))) return true;
  if ((entity.poc_name ?? "").toLowerCase().includes(needle)) return true;

  if (
    (entity.entity_equipment ?? []).some(
      (e) =>
        (e.item_name ?? "").toLowerCase().includes(needle) ||
        (e.notes ?? "").toLowerCase().includes(needle),
    )
  )
    return true;

  return false;
}

export function filterEntities(rows: EntityFull[], f: EntityFilters): EntityFull[] {
  return rows.filter((e) => {
    if (f.status && e.status !== f.status) return false;
    if (f.zone && e.zone_id !== f.zone) return false;
    if (f.category && !canPerform(e, f.category)) return false;
    if (f.vehicle && !(e.vehicle_type_ids ?? []).includes(f.vehicle)) return false;
    if (f.avail && !coversDate(e, f.avail)) return false;
    if (f.q && !matchesText(e, f.q)) return false;
    return true;
  });
}
