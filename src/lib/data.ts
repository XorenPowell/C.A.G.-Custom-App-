import "server-only";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_LISTS, type Lists } from "@/lib/lists";
import type { EquipmentPreset, ListItem, MessageTemplate, Settings } from "@/lib/types";

// Pure helpers live in lists.ts so client components can use them too.
export {
  active,
  lookup,
  nameMap,
  optionsFor,
  partnershipReferralId,
  PARTNERSHIP_REFERRAL,
  type Lists,
} from "@/lib/lists";

/**
 * Every dropdown in the app is fed from here. Nothing is hardcoded in a
 * component (standing rule 1), so a value added in Settings appears everywhere
 * immediately.
 */
export async function getLists(): Promise<Lists> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("list_items")
    .select("*")
    .order("sort_order")
    .order("name");

  const lists: Lists = structuredClone(EMPTY_LISTS);
  for (const item of (data ?? []) as ListItem[]) {
    if (lists[item.kind]) lists[item.kind].push(item);
  }
  return lists;
}

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*").eq("id", true).single();
  return (
    (data as Settings | null) ?? {
      id: true,
      default_pos_fee_percent: 5,
      monthly_jobs_goal: 300,
      daily_leads_goal: 5,
      daily_partnerships_goal: 10,
    }
  );
}

/** The equipment preset library, ordered bundles-first then by category. */
export async function getEquipmentPresets(): Promise<EquipmentPreset[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipment_presets")
    .select("*")
    .order("sort_order")
    .order("item_name");

  // The table arrives in migration 002; an un-migrated database should still
  // render the roster rather than blowing up on a missing relation.
  if (error) return [];
  return (data ?? []) as EquipmentPreset[];
}

export async function getTemplates(): Promise<MessageTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_templates")
    .select("*")
    .order("audience")
    .order("sort_order")
    .order("template_name");
  return (data ?? []) as MessageTemplate[];
}
