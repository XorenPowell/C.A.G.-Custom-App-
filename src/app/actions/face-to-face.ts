"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, toInt, type ActionResult } from "@/lib/persist";

export type StartSessionPayload = {
  conversation_goal: number | string;
  committed_hours: number | string;
  zone_id: string | null;
};

/** Creates the session and routes straight to its (now active) page. */
export async function startSession(payload: StartSessionPayload): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("face_to_face_sessions")
    .insert({
      conversation_goal: Math.max(1, toInt(payload.conversation_goal, 5)),
      committed_hours: Number(payload.committed_hours) || 0,
      zone_id: payload.zone_id || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/face-to-face", "layout");
  redirect(`/face-to-face/sessions/${data.id}`);
}

/**
 * Ends a session — used both by the explicit "End Session" button and by
 * "End & start new" when a different session is already active.
 */
export async function endSession(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("face_to_face_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", id)
    .is("ended_at", null);
  if (error) return fail(error.message);
  revalidatePath("/face-to-face", "layout");
  return ok(id);
}

/**
 * Deletes a session outright. Its conversations go with it (the DB foreign
 * key is `on delete cascade`) — the confirm dialog on the button warns about
 * this before calling in.
 */
export async function deleteSession(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("face_to_face_sessions").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/face-to-face", "layout");
  return ok();
}

/** Logs a conversation with its outcome, tied to the active session. */
export async function logConversation(
  sessionId: string,
  outcomeId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("face_to_face_conversations")
    .insert({ session_id: sessionId, outcome_id: outcomeId });
  if (error) return fail(error.message);

  revalidatePath("/face-to-face", "layout");
  return ok();
}

export async function updateConversationOutcome(
  id: string,
  outcomeId: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("face_to_face_conversations")
    .update({ outcome_id: outcomeId })
    .eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/face-to-face", "layout");
  return ok(id);
}

export async function deleteConversation(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("face_to_face_conversations").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/face-to-face", "layout");
  return ok();
}
