import { createClient } from "@/lib/supabase/server";
import type { TimeEntry } from "@/lib/types";

export async function getActiveEntry(): Promise<TimeEntry | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("time_entries")
    .select("*")
    .is("clocked_out_at", null)
    .order("clocked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as TimeEntry) ?? null;
}

export async function getEntries(): Promise<TimeEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .order("clocked_in_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TimeEntry[];
}

/** Minutes worked so far on this entry — clocked_out_at if ended, else now. */
export function entryMinutes(entry: TimeEntry): number {
  const start = new Date(entry.clocked_in_at).getTime();
  const end = entry.clocked_out_at ? new Date(entry.clocked_out_at).getTime() : Date.now();
  return Math.max(0, Math.round((end - start) / 60000));
}
