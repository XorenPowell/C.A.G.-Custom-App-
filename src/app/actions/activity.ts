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
  // step — including deciding there isn't one.
  if (payload.next_follow_up_at !== undefined) {
    const table = partnershipId ? "partnerships" : "jobs";
    const id = partnershipId ?? jobId!;
    const patch: Record<string, string | null> = {
      follow_up_at: payload.next_follow_up_at || null,
    };
    // Only touch the note when the caller actually decided about it, so
    // "leave the current callback alone" leaves its reason alone too.
    if (payload.next_follow_up_note !== undefined) {
      patch.follow_up_note = orNull(payload.next_follow_up_note);
    }

    const { error } = await supabase.from(table).update(patch).eq("id", id);
    if (error) return fail(error.message);
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

/** Saves just the booked callback, without round-tripping the whole form. */
export async function setNextAction(
  target: { partnership_id?: string; job_id?: string },
  followUpAt: string | null,
  note: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const table = target.partnership_id ? "partnerships" : "jobs";
  const id = target.partnership_id ?? target.job_id;
  if (!id) return fail("Nothing to update.");

  const { error } = await supabase
    .from(table)
    .update({ follow_up_at: followUpAt, follow_up_note: orNull(note) })
    .eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/", "layout");
  return ok();
}
