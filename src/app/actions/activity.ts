"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, orNull, toNullableNum, type ActionResult } from "@/lib/persist";
import { chicagoDateOf } from "@/lib/dates";
import type { ActivityKind } from "@/lib/types";

/**
 * Kinds the database trigger counts as contact; mirrored here for the
 * recompute. `restock` was one of these until 029 folded it into `visit`.
 */
const CONTACT_KINDS = ["call", "text", "email", "visit"] as const;

export type LogContactPayload = {
  /** Exactly one of these. Enforced by a check constraint on the table too. */
  partnership_id?: string | null;
  job_id?: string | null;
  kind: ActivityKind;
  outcome: string | null;
  note: string | null;
  /** Visits only. Cards left at the business, and cards still there on arrival. */
  cards_dropped?: number | string | null;
  cards_found?: number | string | null;
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
    cards_dropped: toNullableNum(payload.cards_dropped),
    cards_found: toNullableNum(payload.cards_found),
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

/**
 * Corrects an entry that was already logged.
 *
 * Logging happens mid-call, so the wrong time and a half-finished note are
 * normal; without this the only repair was delete and re-log, which loses
 * the entry's place in the history.
 */
export type ActivityEdit = {
  /** UTC ISO instant. Omit to leave the time alone. */
  occurred_at?: string;
  outcome?: string | null;
  note?: string | null;
  cards_dropped?: number | string | null;
  cards_found?: number | string | null;
};

export async function updateActivity(id: string, patch: ActivityEdit): Promise<ActionResult> {
  const supabase = await createClient();

  const row: Record<string, unknown> = {};
  if (patch.occurred_at) row.occurred_at = patch.occurred_at;
  if (patch.outcome !== undefined) row.outcome = orNull(patch.outcome);
  if (patch.note !== undefined) row.note = orNull(patch.note);
  if (patch.cards_dropped !== undefined) row.cards_dropped = toNullableNum(patch.cards_dropped);
  if (patch.cards_found !== undefined) row.cards_found = toNullableNum(patch.cards_found);
  if (Object.keys(row).length === 0) return ok(id);

  const { data, error } = await supabase
    .from("activity")
    .update(row)
    .eq("id", id)
    .select("partnership_id")
    .maybeSingle();
  if (error) return fail(error.message);

  await recomputeLastContact(supabase, (data as { partnership_id: string | null } | null)?.partnership_id ?? null);

  revalidatePath("/", "layout");
  return ok(id);
}

export async function deleteActivity(id: string): Promise<ActionResult> {
  const supabase = await createClient();

  // Read the parent first: after the delete there is nothing left to ask.
  const { data: before } = await supabase
    .from("activity")
    .select("partnership_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("activity").delete().eq("id", id);
  if (error) return fail(error.message);

  await recomputeLastContact(supabase, (before as { partnership_id: string | null } | null)?.partnership_id ?? null);

  revalidatePath("/", "layout");
  return ok();
}

/**
 * Re-derives last_contact from the trail.
 *
 * The database trigger only fires on insert and only ever moves the date
 * forward, which is right for logging and wrong for correcting: backdating
 * an entry would otherwise leave last_contact claiming a contact that no
 * longer exists. Recomputing covers both directions.
 *
 * Nothing left to derive from leaves the existing date alone rather than
 * clearing it — the pre-log history was seeded as `note` entries, which do
 * not count as contact, so a blanket overwrite would erase real dates.
 */
async function recomputeLastContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  partnershipId: string | null,
): Promise<void> {
  if (!partnershipId) return;

  const { data, error } = await supabase
    .from("activity")
    .select("occurred_at")
    .eq("partnership_id", partnershipId)
    .in("kind", [...CONTACT_KINDS])
    .order("occurred_at", { ascending: false })
    .limit(1);
  if (error) return;

  const latest = (data ?? [])[0] as { occurred_at: string } | undefined;
  if (!latest) return;

  await supabase
    .from("partnerships")
    .update({ last_contact: chicagoDateOf(latest.occurred_at) })
    .eq("id", partnershipId);
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
