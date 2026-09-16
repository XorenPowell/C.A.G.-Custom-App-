import { createClient } from "@/lib/supabase/server";
import type { FaceToFaceConversation } from "@/lib/types";

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
