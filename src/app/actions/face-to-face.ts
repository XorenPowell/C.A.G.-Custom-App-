"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, orNull, toInt, type ActionResult } from "@/lib/persist";
import type { InquiryFor } from "@/lib/types";

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
 * Inserts a bare conversation row tied to this session, stamped with the
 * current time, then routes to it to fill in details — the timestamp needs
 * to be the moment of the tap, not whenever the form eventually saves.
 */
export async function startConversationInSession(
  sessionId: string,
  zoneId: string | null,
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("face_to_face_conversations")
    .insert({ session_id: sessionId, zone_id: zoneId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/face-to-face", "layout");
  redirect(`/face-to-face/${data.id}`);
}

export type ConversationPayload = {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  inquiry_for: InquiryFor | null;
  service_category_id: string | null;
  zone_id: string | null;
  cards_given: number | string;
  intent_level: number | string;
  notes: string | null;
};

export async function saveConversation(payload: ConversationPayload): Promise<ActionResult> {
  const supabase = await createClient();

  const row = {
    contact_name: orNull(payload.contact_name),
    contact_phone: orNull(payload.contact_phone),
    contact_email: orNull(payload.contact_email),
    inquiry_for: payload.inquiry_for || null,
    service_category_id: payload.service_category_id || null,
    zone_id: payload.zone_id || null,
    cards_given: toInt(payload.cards_given),
    intent_level: Math.min(10, Math.max(1, toInt(payload.intent_level, 5))),
    notes: orNull(payload.notes),
  };

  const { error } = await supabase
    .from("face_to_face_conversations")
    .update(row)
    .eq("id", payload.id);
  if (error) return fail(error.message);

  revalidatePath("/face-to-face", "layout");
  return ok(payload.id);
}

export async function deleteConversation(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("face_to_face_conversations").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/face-to-face", "layout");
  return ok();
}
