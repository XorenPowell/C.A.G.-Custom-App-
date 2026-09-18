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

export type OutcomeBreakdown = { label: string; count: number; percent: number };

/**
 * Outcome mix as percentages, computed on read from whatever conversations
 * are handed in — a session's, a date range's, the whole book. Never
 * stored: recomputing is cheap and storing a percentage would go stale the
 * moment another conversation is logged.
 */
export function outcomeBreakdown(
  conversations: Pick<FaceToFaceConversation, "outcome_id">[],
  names: Map<string, string>,
): OutcomeBreakdown[] {
  const total = conversations.length;
  const counts = new Map<string, number>();
  for (const c of conversations) {
    const label = c.outcome_id ? (names.get(c.outcome_id) ?? "Unknown") : "No outcome";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, percent: total ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);
}

/** Same on-read approach as outcomeBreakdown — average over whatever's handed in. */
export function averageIntentLevel(
  conversations: Pick<FaceToFaceConversation, "intent_level">[],
): number {
  if (conversations.length === 0) return 0;
  const total = conversations.reduce((s, c) => s + c.intent_level, 0);
  return total / conversations.length;
}
