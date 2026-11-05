"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, orNull, toInt, type ActionResult } from "@/lib/persist";

export type PlacementPayload = {
  id: string | null;
  campaign_id: string;
  partnership_id: string;
  location: string | null;
  placed_on: string;
  last_restock_on: string | null;
  restock_interval_days: number | string;
  cards_left: number | string | null;
  notes: string | null;
};

export async function savePlacement(payload: PlacementPayload): Promise<ActionResult> {
  const supabase = await createClient();

  const interval = toInt(payload.restock_interval_days, 14);
  if (interval < 1) return fail("The restock interval must be at least one day.");

  const row = {
    campaign_id: payload.campaign_id,
    partnership_id: payload.partnership_id,
    location: orNull(payload.location),
    placed_on: payload.placed_on || new Date().toISOString().slice(0, 10),
    last_restock_on: payload.last_restock_on || null,
    restock_interval_days: interval,
    cards_left:
      payload.cards_left === "" || payload.cards_left == null
        ? null
        : toInt(payload.cards_left),
    notes: orNull(payload.notes),
    removed_on: null,
  };

  // A business can only hold one live stack per campaign, so re-adding one
  // that was removed revives the original row instead of colliding with it.
  const res = payload.id
    ? await supabase.from("campaign_placements").update(row).eq("id", payload.id)
    : await supabase
        .from("campaign_placements")
        .upsert(row, { onConflict: "campaign_id,partnership_id" });

  if (res.error) return fail(res.error.message);

  revalidatePath("/campaigns");
  revalidatePath("/partnerships", "layout");
  revalidatePath("/");
  return ok();
}

/**
 * Records a restock and pushes the clock forward in one step, and logs it on
 * the partnership's trail so a visit shows up in its history.
 */
export async function markRestocked(
  placementId: string,
  cardsLeft: number | null,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: placement, error: readError } = await supabase
    .from("campaign_placements")
    .select("partnership_id")
    .eq("id", placementId)
    .single();
  if (readError) return fail(readError.message);

  const { error } = await supabase
    .from("campaign_placements")
    .update({
      last_restock_on: new Date().toISOString().slice(0, 10),
      cards_left: cardsLeft,
    })
    .eq("id", placementId);
  if (error) return fail(error.message);

  await supabase.from("activity").insert({
    partnership_id: (placement as { partnership_id: string }).partnership_id,
    kind: "restock",
    outcome: cardsLeft == null ? "Restocked" : `Restocked — ${cardsLeft} left before top-up`,
  });

  revalidatePath("/campaigns");
  revalidatePath("/partnerships", "layout");
  revalidatePath("/");
  return ok();
}

/** Ends a placement without deleting it, so the campaign keeps its history. */
export async function removePlacement(placementId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaign_placements")
    .update({ removed_on: new Date().toISOString().slice(0, 10) })
    .eq("id", placementId);
  if (error) return fail(error.message);

  revalidatePath("/campaigns");
  revalidatePath("/partnerships", "layout");
  return ok();
}

export async function saveCampaignTarget(
  campaignId: string,
  target: number | string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({ target: toInt(target) })
    .eq("id", campaignId);
  if (error) return fail(error.message);
  revalidatePath("/campaigns");
  return ok();
}
