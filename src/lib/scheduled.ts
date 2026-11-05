import { createClient } from "@/lib/supabase/server";
import type { FollowUpKind } from "@/lib/types";

/** A planned future action. `follow_up_at` on the parent mirrors the earliest. */
export type ScheduledAction = {
  id: string;
  partnership_id: string | null;
  job_id: string | null;
  kind: FollowUpKind;
  due_at: string;
  note: string | null;
  created_at: string;
};

async function read(column: "partnership_id" | "job_id", id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scheduled_actions")
    .select("*")
    .eq(column, id)
    .order("due_at");

  // 024 may not be applied yet. An empty plan is a legitimate state, so this
  // degrades rather than taking the record page down with it.
  if (error) return [];
  return (data ?? []) as ScheduledAction[];
}

export function getScheduledForPartnership(partnershipId: string) {
  return read("partnership_id", partnershipId);
}

export function getScheduledForJob(jobId: string) {
  return read("job_id", jobId);
}
