"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/persist";
import { geocodeAddress, routeOrder } from "@/lib/geocode";

export type SortOutcome = ActionResult & {
  /** Businesses with no coordinates, which keep their place at the end. */
  unplaced?: string[];
};

/**
 * Puts a day's stops in the order the street is in.
 *
 * Order is written rather than inferred, because a run is booked by
 * dropping fourteen visits on a date and they all land at 9:00 — there
 * is no time to sort by. The times are left exactly as they are; only
 * the order changes.
 */
export async function sortVisitDayByRoute(
  scheduledIds: string[],
  startAddress: string,
): Promise<SortOutcome> {
  if (scheduledIds.length === 0) return ok();
  if (!startAddress.trim()) return fail("Type the address you are starting from.");

  const start = await geocodeAddress(startAddress);
  if (!start) {
    return fail(`Could not place "${startAddress.trim()}". Check the street number and spelling.`);
  }

  const supabase = await createClient();

  const { data: actions, error: actionError } = await supabase
    .from("scheduled_actions")
    .select("id, partnership_id")
    .in("id", scheduledIds);
  if (actionError) return fail(actionError.message);

  const rows = (actions ?? []) as { id: string; partnership_id: string | null }[];
  const partnershipIds = [...new Set(rows.map((r) => r.partnership_id).filter((v): v is string => !!v))];

  const { data: places, error: placeError } = await supabase
    .from("partnerships")
    .select("id, business_name, latitude, longitude")
    .in("id", partnershipIds);
  if (placeError) return fail(placeError.message);

  const placed = new Map(
    ((places ?? []) as {
      id: string; business_name: string; latitude: number | null; longitude: number | null;
    }[]).map((p) => [p.id, p]),
  );

  const withCoords: { id: string; latitude: number; longitude: number }[] = [];
  const unplaced: string[] = [];
  for (const r of rows) {
    const p = r.partnership_id ? placed.get(r.partnership_id) : undefined;
    if (p && p.latitude != null && p.longitude != null) {
      withCoords.push({ id: r.id, latitude: p.latitude, longitude: p.longitude });
    } else {
      unplaced.push(p?.business_name ?? "Unknown");
    }
  }

  if (withCoords.length === 0) {
    return fail(
      "No stop on this day has coordinates yet. Run scripts/geocode.mjs --write to place them.",
    );
  }

  const ordered = routeOrder(start, withCoords);

  // A business with no coordinates is still somewhere you have to go, so
  // it keeps its place at the end rather than dropping off the run.
  const sequence = [
    ...ordered.map((o) => o.id),
    ...rows.filter((r) => !withCoords.some((w) => w.id === r.id)).map((r) => r.id),
  ];

  for (const [index, id] of sequence.entries()) {
    const { error } = await supabase
      .from("scheduled_actions")
      .update({ sort_order: index })
      .eq("id", id);
    if (error) return fail(error.message);
  }

  revalidatePath("/", "layout");
  return { ...ok(), unplaced };
}

/** Clears a day's order, so it falls back to the order the stops were booked in. */
export async function clearVisitDayOrder(scheduledIds: string[]): Promise<ActionResult> {
  if (scheduledIds.length === 0) return ok();
  const supabase = await createClient();
  const { error } = await supabase
    .from("scheduled_actions")
    .update({ sort_order: null })
    .in("id", scheduledIds);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return ok();
}
