import { createClient } from "@/lib/supabase/server";
import { chicagoDateOf, todayISO } from "@/lib/dates";
import type { FaceToFaceConversation, FaceToFaceSession } from "@/lib/types";

export async function getConversations(): Promise<FaceToFaceConversation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("face_to_face_conversations")
    .select("*")
    .order("occurred_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FaceToFaceConversation[];
}

export async function getConversation(id: string): Promise<FaceToFaceConversation | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("face_to_face_conversations")
    .select("*")
    .eq("id", id)
    .single();
  return (data as FaceToFaceConversation) ?? null;
}

/**
 * Every conversation logged today (Chicago calendar day), across all
 * sessions. Fetches a safe superset by UTC clock (occurred_at is a
 * timestamptz — comparing it to a bare "YYYY-MM-DDT00:00:00" string would
 * have Postgres interpret that as UTC, reintroducing the exact server-clock
 * bug already fixed on the Home screen) and filters precisely in JS using
 * the same Chicago-anchored date extraction used everywhere else.
 */
export async function getTodayConversationCount(): Promise<number> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("face_to_face_conversations")
    .select("occurred_at")
    .gte("occurred_at", since);
  if (error) throw new Error(error.message);

  const today = todayISO();
  return (data ?? []).filter(
    (r) => chicagoDateOf((r as { occurred_at: string }).occurred_at) === today,
  ).length;
}

export async function getSessions(): Promise<FaceToFaceSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("face_to_face_sessions")
    .select("*")
    .order("started_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FaceToFaceSession[];
}

export async function getSession(id: string): Promise<FaceToFaceSession | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("face_to_face_sessions")
    .select("*")
    .eq("id", id)
    .single();
  return (data as FaceToFaceSession) ?? null;
}

/** There is only ever one active (unended) session at a time. */
export async function getActiveSession(): Promise<FaceToFaceSession | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("face_to_face_sessions")
    .select("*")
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as FaceToFaceSession) ?? null;
}

export async function getSessionConversations(
  sessionId: string,
): Promise<FaceToFaceConversation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("face_to_face_conversations")
    .select("*")
    .eq("session_id", sessionId)
    .order("occurred_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FaceToFaceConversation[];
}
