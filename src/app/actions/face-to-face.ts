"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, orNull, toInt, type ActionResult } from "@/lib/persist";
import type { InquiryFor } from "@/lib/types";

/**
 * Inserts a bare row stamped with the current time, then routes straight to
 * its detail page. The point is capturing when the conversation actually
 * started — not whenever the dispatcher finishes filling in the form.
 */
export async function startConversation(): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("face_to_face_conversations")
    .insert({})
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
