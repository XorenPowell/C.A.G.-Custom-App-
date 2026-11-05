import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayLocal } from "@/lib/follow-up";
import type { Campaign, CampaignPlacement, Partnership } from "@/lib/types";

export type PlacementWithPartnership = CampaignPlacement & {
  partnership: Pick<Partnership, "id" | "business_name" | "zone_id" | "status_id"> | null;
};

export async function getCampaigns(): Promise<Campaign[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  return (data ?? []) as Campaign[];
}

/** Live placements only — a removed one is history, not a current stack. */
export async function getPlacements(campaignId: string): Promise<PlacementWithPartnership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_placements")
    .select("*, partnerships(id, business_name, zone_id, status_id)")
    .eq("campaign_id", campaignId)
    .is("removed_on", null);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const { partnerships, ...rest } = row as CampaignPlacement & {
      partnerships: PlacementWithPartnership["partnership"];
    };
    return { ...rest, partnership: partnerships };
  });
}

/** When the next restock is due: last restock (or placement) plus the interval. */
export function restockDue(p: CampaignPlacement): string {
  return addDaysISO(p.last_restock_on ?? p.placed_on, p.restock_interval_days);
}

export type RestockState = "overdue" | "today" | "upcoming";

export function restockState(p: CampaignPlacement, today = todayLocal()): RestockState {
  const due = restockDue(p);
  if (due < today) return "overdue";
  if (due === today) return "today";
  return "upcoming";
}

export function restockLabel(p: CampaignPlacement, today = todayLocal()): string {
  const due = restockDue(p);
  const ms = new Date(`${due}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime();
  const days = Math.round(ms / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `in ${days}d`;
}

/** Restocks needing attention, most overdue first — the day's route. */
export function restockQueue(
  placements: PlacementWithPartnership[],
  today = todayLocal(),
): PlacementWithPartnership[] {
  return placements
    .filter((p) => restockState(p, today) !== "upcoming")
    .sort((a, b) => restockDue(a).localeCompare(restockDue(b)));
}
