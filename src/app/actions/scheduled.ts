"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, orNull, type ActionResult } from "@/lib/persist";
import type { FollowUpKind } from "@/lib/types";

export type ScheduledPayload = {
  partnership_id?: string | null;
  job_id?: string | null;
  kind: FollowUpKind;
  /** UTC instant. */
  due_at: string;
  note: string | null;
};

export async function addScheduledAction(payload: ScheduledPayload): Promise<ActionResult> {
  const supabase = await createClient();

  const partnershipId = payload.partnership_id || null;
  const jobId = payload.job_id || null;
  if (!!partnershipId === !!jobId) {
    return fail("A planned action belongs to exactly one partnership or job.");
  }
  if (!payload.due_at) return fail("A planned action needs a date.");

  const { error } = await supabase.from("scheduled_actions").insert({
    partnership_id: partnershipId,
    job_id: jobId,
    kind: payload.kind,
    due_at: payload.due_at,
    note: orNull(payload.note),
  });

  // The parent's follow_up_at is maintained by a trigger, so nothing else
  // needs updating here.
  if (error) return fail(error.message);

  revalidatePath("/", "layout");
  return ok();
}

export async function updateScheduledAction(
  id: string,
  patch: { kind?: FollowUpKind; due_at?: string; note?: string | null },
): Promise<ActionResult> {
  const supabase = await createClient();

  const row: Record<string, string | null> = {};
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.due_at !== undefined) row.due_at = patch.due_at;
  if (patch.note !== undefined) row.note = orNull(patch.note);
  if (Object.keys(row).length === 0) return ok();

  const { error } = await supabase.from("scheduled_actions").update(row).eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/", "layout");
  return ok();
}

export async function deleteScheduledAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("scheduled_actions").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/", "layout");
  return ok();
}

/**
 * Marks a plan as carried out: writes it to the activity trail and removes it
 * from the plan, in that order, so a failure leaves the plan standing rather
 * than losing it silently.
 */
export async function completeScheduledAction(
  id: string,
  outcome: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error: readError } = await supabase
    .from("scheduled_actions")
    .select("*")
    .eq("id", id)
    .single();
  if (readError) return fail(readError.message);

  const action = data as {
    partnership_id: string | null;
    job_id: string | null;
    kind: string;
    note: string | null;
  };

  const { error: logError } = await supabase.from("activity").insert({
    partnership_id: action.partnership_id,
    job_id: action.job_id,
    kind: action.kind,
    outcome: orNull(outcome) ?? `${action.kind} completed`,
    note: action.note,
  });
  if (logError) return fail(logError.message);

  const { error: delError } = await supabase.from("scheduled_actions").delete().eq("id", id);
  if (delError) return fail(delError.message);

  revalidatePath("/", "layout");
  return ok();
}

/**
 * Records an action whenever it happened.
 *
 * One control, and the date decides where it lands: in the past or now it is
 * history and goes to the activity trail; in the future it is a plan. Asking
 * the dispatcher to classify it themselves would be asking them to know an
 * implementation detail.
 */
export async function addAction(payload: {
  partnership_id?: string | null;
  job_id?: string | null;
  kind: FollowUpKind;
  /** UTC instant. */
  at: string;
  note: string | null;
  outcome: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();

  const partnershipId = payload.partnership_id || null;
  const jobId = payload.job_id || null;
  if (!!partnershipId === !!jobId) {
    return fail("An action belongs to exactly one partnership or job.");
  }
  if (!payload.at) return fail("An action needs a date.");

  const isFuture = new Date(payload.at).getTime() > Date.now();

  if (isFuture) {
    return addScheduledAction({
      partnership_id: partnershipId,
      job_id: jobId,
      kind: payload.kind,
      due_at: payload.at,
      note: payload.note,
    });
  }

  const { error } = await supabase.from("activity").insert({
    partnership_id: partnershipId,
    job_id: jobId,
    kind: payload.kind,
    outcome: orNull(payload.outcome),
    note: orNull(payload.note),
    occurred_at: payload.at,
  });
  if (error) return fail(error.message);

  revalidatePath("/", "layout");
  return ok();
}
