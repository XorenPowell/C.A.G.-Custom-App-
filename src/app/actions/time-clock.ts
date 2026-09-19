"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { chicagoLocalToUTCISO } from "@/lib/dates";
import { fail, ok, orNull, type ActionResult } from "@/lib/persist";

export async function clockIn(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").insert({});
  if (error) return fail(error.message);
  revalidatePath("/time-clock", "layout");
  return ok();
}

/**
 * Ends the active entry and records what got done during it. Scoped to
 * `clocked_out_at is null` so a stale client can't double-close an entry.
 */
export async function clockOut(id: string, notes: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("time_entries")
    .update({ clocked_out_at: new Date().toISOString(), notes: orNull(notes) })
    .eq("id", id)
    .is("clocked_out_at", null);
  if (error) return fail(error.message);
  revalidatePath("/time-clock", "layout");
  return ok(id);
}

/**
 * Corrects a past entry's timestamps — e.g. left clocked in overnight by
 * mistake. `clockedInLocal`/`clockedOutLocal` are "YYYY-MM-DDTHH:mm" in
 * Chicago wall time (a <input type="datetime-local"> value); a blank
 * clock-out reopens the entry as active.
 */
export async function updateTimeEntry(
  id: string,
  clockedInLocal: string,
  clockedOutLocal: string | null,
  notes: string,
): Promise<ActionResult> {
  const clockedInAt = chicagoLocalToUTCISO(clockedInLocal);
  const clockedOutAt = clockedOutLocal ? chicagoLocalToUTCISO(clockedOutLocal) : null;
  if (clockedOutAt && clockedOutAt < clockedInAt) {
    return fail("Clock out can't be before clock in.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("time_entries")
    .update({ clocked_in_at: clockedInAt, clocked_out_at: clockedOutAt, notes: orNull(notes) })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/time-clock", "layout");
  return ok(id);
}
