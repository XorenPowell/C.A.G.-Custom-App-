import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityKind } from "@/lib/types";

export { ACTIVITY_KINDS } from "@/lib/types";
export { ACTIVITY_META, OUTCOME_SUGGESTIONS } from "@/lib/activity-meta";
export type { Activity, ActivityKind } from "@/lib/types";

export async function getPartnershipActivity(partnershipId: string): Promise<Activity[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity")
    .select("*")
    .eq("partnership_id", partnershipId)
    .order("occurred_at", { ascending: false });
  return (data ?? []) as Activity[];
}

export async function getJobActivity(jobId: string): Promise<Activity[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity")
    .select("*")
    .eq("job_id", jobId)
    .order("occurred_at", { ascending: false });
  return (data ?? []) as Activity[];
}

/** Most recent entry per partnership, for list screens. */
export async function getLatestActivityByPartnership(): Promise<Map<string, Activity>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity")
    .select("*")
    .not("partnership_id", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(2000);

  const out = new Map<string, Activity>();
  for (const a of (data ?? []) as Activity[]) {
    if (a.partnership_id && !out.has(a.partnership_id)) out.set(a.partnership_id, a);
  }
  return out;
}
