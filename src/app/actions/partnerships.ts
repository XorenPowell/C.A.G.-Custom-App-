"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, orNull, toInt, type ActionResult } from "@/lib/persist";

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
  date_added: string | null;
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
    date_added: payload.date_added || new Date().toISOString().slice(0, 10),
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
