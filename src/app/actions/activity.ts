"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, orNull, type ActionResult } from "@/lib/persist";
import type { ActivityKind } from "@/lib/types";

export type LogContactPayload = {
  /** Exactly one of these. Enforced by a check constraint on the table too. */
  partnership_id?: string | null;
  job_id?: string | null;
  kind: ActivityKind;
  outcome: string | null;
  note: string | null;
  /** Chicago-local datetime string; defaults to now when blank. */
  occurred_local?: string | null;
  /**
   * Books the next callback in the same step. Null clears whatever was
   * scheduled; undefined leaves it alone.
   */
  next_follow_up_at?: string | null;
  next_follow_up_note?: string | null;
  next_follow_up_kind?: string;
};

/**
 * Logs what happened and books what happens next, in one write.
 *
 * These are one action on purpose: a contact logged without a next step is
 * how a record goes quiet, and asking for them separately guarantees the
 * second half gets skipped.
 */
export async function logContact(payload: LogContactPayload): Promise<ActionResult> {
  const supabase = await createClient();

  const partnershipId = payload.partnership_id || null;
  const jobId = payload.job_id || null;
  if (!!partnershipId === !!jobId) {
    return fail("A log entry belongs to exactly one partnership or job.");
  }

  const occurredAt = payload.occurred_local
    ? new Date(payload.occurred_local).toISOString()
    : new Date().toISOString();

  const { error: logError } = await supabase.from("activity").insert({
    partnership_id: partnershipId,
    job_id: jobId,
    kind: payload.kind,
    outcome: orNull(payload.outcome),
    note: orNull(payload.note),
    occurred_at: occurredAt,
  });
  if (logError) return fail(logError.message);

  // `next_follow_up_at` present at all means the caller is deciding the next
  // step — including deciding there isn't one. Routed through setNextAction
  // so it edits the plan rather than the trigger-maintained mirror column.
  if (payload.next_follow_up_at !== undefined) {
    const res = await setNextAction(
      partnershipId ? { partnership_id: partnershipId } : { job_id: jobId! },
      payload.next_follow_up_at,
      payload.next_follow_up_note ?? null,
      payload.next_follow_up_kind ?? "call",
    );
    if (!res.ok) return res;
  }

  revalidatePath("/", "layout");
  return ok();
}

export async function deleteActivity(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("activity").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return ok();
}

/**
 * Moves a partnership to a new stage and records the move on its trail, so
 * the history explains itself without the dispatcher writing a note.
 */
export async function setPartnershipStage(
  partnershipId: string,
  statusId: string,
  stageName: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("partnerships")
    .update({ status_id: statusId })
    .eq("id", partnershipId);
  if (error) return fail(error.message);

  // kind 'note' rather than 'call': a stage change is not outreach, and
  // logging it as outreach would wrongly move last_contact.
  await supabase.from("activity").insert({
    partnership_id: partnershipId,
    kind: "note",
    outcome: `Stage changed to ${stageName}`,
  });

  revalidatePath("/", "layout");
  return ok();
}

/**
 * Saves the next action by editing the plan, not the mirror column.
 *
 * follow_up_at is maintained by a trigger on scheduled_actions, so writing
 * it directly produced a callback the queue honoured but the Planned list
 * knew nothing about. The card now edits the earliest planned action, which
 * keeps both in step by construction.
 */
export async function setNextAction(
  target: { partnership_id?: string; job_id?: string },
  followUpAt: string | null,
  note: string | null,
  kind: string = "call",
): Promise<ActionResult> {
  const supabase = await createClient();

  const partnershipId = target.partnership_id ?? null;
  const jobId = target.job_id ?? null;
  if (!partnershipId && !jobId) return fail("Nothing to update.");

  const column = partnershipId ? "partnership_id" : "job_id";
  const parentId = partnershipId ?? jobId!;

  const { data: existing, error: readError } = await supabase
    .from("scheduled_actions")
    .select("id")
    .eq(column, parentId)
    .order("due_at")
    .limit(1);
  if (readError) return fail(readError.message);

  const earliest = (existing ?? [])[0] as { id: string } | undefined;

  // Clearing the date means removing that plan entirely; the trigger then
  // promotes whatever is next, or empties follow_up_at if nothing is left.
  if (!followUpAt) {
    if (!earliest) return ok();
    const { error } = await supabase.from("scheduled_actions").delete().eq("id", earliest.id);
    if (error) return fail(error.message);
    revalidatePath("/", "layout");
    return ok();
  }

  const row = { kind, due_at: followUpAt, note: orNull(note) };
  const res = earliest
    ? await supabase.from("scheduled_actions").update(row).eq("id", earliest.id)
    : await supabase.from("scheduled_actions").insert({ ...row, [column]: parentId });

  if (res.error) return fail(res.error.message);

  revalidatePath("/", "layout");
  return ok();
}
