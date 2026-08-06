"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, orNull, toInt, type ActionResult } from "@/lib/persist";

/** Whichever YYYY-MM-DD date is later; null when both are blank. */
function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b || null;
  if (!b) return a;
  return a >= b ? a : b;
}

/** Blank stays blank — a missing follow-up interval is not "0 days". */
function toNullableInt(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

export type PartnershipPayload = {
  id: string | null;
  business_name: string;
  address: string | null;
  zone_id: string | null;
  status_id: string | null;
  tier_id: string | null;
  poc_name: string | null;
  poc_phone: string | null;
  poc_email: string | null;
  secondary_poc_name: string | null;
  secondary_poc_phone: string | null;
  secondary_poc_email: string | null;
  last_visit: string | null;
  cards_dropped_last_visit: number | string;
  total_cards_dropped: number | string;
  fliers_dropped_last_visit: number | string;
  total_fliers_dropped: number | string;
  date_signed: string | null;
  last_contact: string | null;
  follow_up_days: number | string | null;
  notes: string | null;
};

export async function savePartnership(
  payload: PartnershipPayload,
): Promise<ActionResult> {
  const supabase = await createClient();

  if (!payload.business_name.trim()) return fail("Business name is required.");

  const row = {
    business_name: payload.business_name.trim(),
    address: orNull(payload.address),
    zone_id: payload.zone_id || null,
    status_id: payload.status_id || null,
    tier_id: payload.tier_id || null,
    poc_name: orNull(payload.poc_name),
    poc_phone: orNull(payload.poc_phone),
    poc_email: orNull(payload.poc_email),
    secondary_poc_name: orNull(payload.secondary_poc_name),
    secondary_poc_phone: orNull(payload.secondary_poc_phone),
    secondary_poc_email: orNull(payload.secondary_poc_email),
    last_visit: payload.last_visit || null,
    cards_dropped_last_visit: toInt(payload.cards_dropped_last_visit),
    total_cards_dropped: toInt(payload.total_cards_dropped),
    fliers_dropped_last_visit: toInt(payload.fliers_dropped_last_visit),
    total_fliers_dropped: toInt(payload.total_fliers_dropped),
    // Null keeps this a lead; a date promotes it to a real partnership.
    date_signed: payload.date_signed || null,
    // Visiting someone is contacting them, so a later visit date carries.
    last_contact: laterOf(payload.last_contact, payload.last_visit),
    follow_up_days: toNullableInt(payload.follow_up_days),
    notes: orNull(payload.notes),
  };

  let id = payload.id;

  if (id) {
    const { error } = await supabase.from("partnerships").update(row).eq("id", id);
    if (error) return fail(error.message);
  } else {
    const { data, error } = await supabase
      .from("partnerships")
      .insert(row)
      .select("id")
      .single();
    if (error) return fail(error.message);
    id = data.id as string;
  }

  revalidatePath("/partnerships", "layout");
  revalidatePath("/dashboard");
  return ok(id);
}

export async function deletePartnership(id: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("partnership_id", id);

  if (count) {
    return fail(
      `This partnership is credited on ${count} job${count === 1 ? "" : "s"}. Set its status to Inactive instead — deleting would break that referral history.`,
    );
  }

  const { error } = await supabase.from("partnerships").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/partnerships", "layout");
  return ok();
}
