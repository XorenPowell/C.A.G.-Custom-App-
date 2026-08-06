import type { SupabaseClient } from "@supabase/supabase-js";

export type ActionResult = { ok: boolean; error?: string; id?: string };

export const ok = (id?: string): ActionResult => ({ ok: true, id });
export const fail = (error: string): ActionResult => ({ ok: false, error });

/**
 * Replaces every child row of a parent in one shot.
 *
 * Child rows here are never referenced from outside their parent, so a
 * delete-and-reinsert keeps the save logic simple and always consistent with
 * what the form shows. Do NOT use this for `entity_availability` — that table
 * has a trigger stamping `availability_updated_at`, and rewriting it on an
 * unrelated profile edit would reset the staleness clock.
 */
export async function replaceChildren(
  supabase: SupabaseClient,
  table: string,
  fkColumn: string,
  parentId: string,
  rows: Record<string, unknown>[],
): Promise<string | null> {
  const del = await supabase.from(table).delete().eq(fkColumn, parentId);
  if (del.error) return `${table}: ${del.error.message}`;

  if (rows.length === 0) return null;

  const ins = await supabase
    .from(table)
    .insert(rows.map((r, i) => ({ ...r, [fkColumn]: parentId, sort_order: i })));
  if (ins.error) return `${table}: ${ins.error.message}`;

  return null;
}

/** Trims a string field to null when empty, so blank inputs don't store "". */
export function orNull(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v);
  return s === "" ? null : s;
}

/** Numeric coercion for money/hours columns: blanks become 0. */
export function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Numeric coercion that preserves "blank" — used by the override columns. */
export function toNullableNum(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toInt(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}
