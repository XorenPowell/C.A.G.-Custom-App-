"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, orNull, toInt, toNullableNum, type ActionResult } from "@/lib/persist";
import { sanitizeThemeOverrides } from "@/lib/theme";
import type { Audience, ListKind } from "@/lib/types";

export type ListItemDraft = {
  id: string | null;
  name: string;
  description: string | null;
  /** conversation_outcome only. Blank stays blank — a missing default is not 0. */
  default_intent_level: number | string | null;
  /** service_category only. */
  details_template: string | null;
  sort_order: number;
  archived: boolean;
};

/** Saves a whole list at once: inserts new rows, updates existing ones. */
export async function saveList(
  kind: ListKind,
  items: ListItemDraft[],
): Promise<ActionResult> {
  const supabase = await createClient();

  const named = items.filter((i) => i.name.trim() !== "");
  if (named.length !== items.length) return fail("Every entry needs a name.");

  const seen = new Set<string>();
  for (const i of named) {
    const key = i.name.trim().toLowerCase();
    if (seen.has(key)) return fail(`Duplicate name: "${i.name.trim()}"`);
    seen.add(key);
  }

  for (const [index, item] of named.entries()) {
    const intentLevel = toNullableNum(item.default_intent_level);
    const row = {
      kind,
      name: item.name.trim(),
      description: orNull(item.description),
      default_intent_level:
        intentLevel === null ? null : Math.min(10, Math.max(0, intentLevel)),
      details_template: orNull(item.details_template),
      sort_order: (index + 1) * 10,
      archived: item.archived,
    };

    const res = item.id
      ? await supabase.from("list_items").update(row).eq("id", item.id)
      : await supabase.from("list_items").insert(row);

    if (res.error) return fail(res.error.message);
  }

  revalidatePath("/", "layout");
  return ok();
}

/**
 * Hard delete. Jobs, entities and partnerships pointing at this value fall back
 * to null, except entity rate rows, which are removed with it — a rate row is
 * meaningless without its service category.
 */
export async function deleteListItem(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("list_items").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return ok();
}

/** How many records would be affected by deleting a list value. */
export async function listItemUsage(
  id: string,
  kind: ListKind,
): Promise<{ label: string; count: number }[]> {
  const supabase = await createClient();
  const checks: { label: string; table: string; column: string }[] = [];

  if (kind === "service_category") {
    checks.push(
      { label: "jobs", table: "jobs", column: "service_category_id" },
      { label: "entity rate rows", table: "entity_rates", column: "service_category_id" },
      { label: "references", table: "entity_references", column: "service_category_id" },
    );
  } else if (kind === "inquiry_source") {
    checks.push({ label: "jobs", table: "jobs", column: "inquiry_source_id" });
  } else if (kind === "zone") {
    checks.push(
      { label: "jobs", table: "jobs", column: "zone_id" },
      { label: "entities", table: "entities", column: "zone_id" },
      { label: "partnerships", table: "partnerships", column: "zone_id" },
    );
  } else if (kind === "partnership_status") {
    checks.push({ label: "partnerships", table: "partnerships", column: "status_id" });
  } else if (kind === "partnership_tier") {
    checks.push({ label: "partnerships", table: "partnerships", column: "tier_id" });
  } else if (kind === "conversation_outcome") {
    checks.push({
      label: "conversations",
      table: "face_to_face_conversations",
      column: "outcome_id",
    });
  }

  const out: { label: string; count: number }[] = [];
  for (const c of checks) {
    const { count } = await supabase
      .from(c.table)
      .select("id", { count: "exact", head: true })
      .eq(c.column, id);
    if (count) out.push({ label: c.label, count });
  }

  if (kind === "vehicle_type") {
    const { count } = await supabase
      .from("entities")
      .select("id", { count: "exact", head: true })
      .contains("vehicle_type_ids", [id]);
    if (count) out.push({ label: "entities", count });
  }

  return out;
}

export type SettingsValues = {
  default_pos_fee_percent: number;
  default_commission_percent: number;
  transfer_fee_percent: number;
  deposit_fee_percent: number;
  monthly_jobs_goal: number;
  daily_inquiries_goal: number;
  daily_partnerships_goal: number;
  pay_period_start_day: number;
};

export async function saveSettingsValues(values: SettingsValues): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      default_pos_fee_percent: Number(values.default_pos_fee_percent) || 0,
      default_commission_percent: Number(values.default_commission_percent) || 0,
      transfer_fee_percent: Number(values.transfer_fee_percent) || 0,
      deposit_fee_percent: Number(values.deposit_fee_percent) || 0,
      monthly_jobs_goal: toInt(values.monthly_jobs_goal),
      daily_inquiries_goal: toInt(values.daily_inquiries_goal),
      daily_partnerships_goal: toInt(values.daily_partnerships_goal),
      pay_period_start_day: toInt(values.pay_period_start_day, 5),
    })
    .eq("id", true);

  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return ok();
}

export type TemplateDraft = {
  id: string | null;
  template_name: string;
  audience: Audience;
  body: string;
};

export async function saveTemplates(drafts: TemplateDraft[]): Promise<ActionResult> {
  const supabase = await createClient();

  for (const [index, t] of drafts.entries()) {
    if (!t.template_name.trim()) return fail("Every template needs a name.");
    const row = {
      template_name: t.template_name.trim(),
      audience: t.audience,
      body: t.body ?? "",
      sort_order: (index + 1) * 10,
    };
    const res = t.id
      ? await supabase.from("message_templates").update(row).eq("id", t.id)
      : await supabase.from("message_templates").insert(row);
    if (res.error) return fail(res.error.message);
  }

  revalidatePath("/", "layout");
  return ok();
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return ok();
}

/**
 * Only known tokens with valid hex values are written — anything else is
 * silently dropped rather than failing the save, since the color inputs on
 * the Appearance screen can't produce anything invalid anyway.
 */
export async function saveThemeOverrides(
  overrides: Record<string, string>,
): Promise<ActionResult> {
  const supabase = await createClient();
  const clean = sanitizeThemeOverrides(overrides);
  const { error } = await supabase
    .from("settings")
    .update({ theme_overrides: clean })
    .eq("id", true);
  if (error) return fail(error.message);
  // The root layout reads theme_overrides on every request, so invalidating
  // it here is what makes a saved color apply live, everywhere, immediately.
  revalidatePath("/", "layout");
  return ok();
}

export async function resetThemeOverrides(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ theme_overrides: {} })
    .eq("id", true);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return ok();
}

export async function saveFaceToFaceGoal(dailyGoal: number | string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ face_to_face_daily_goal: Math.max(1, toInt(dailyGoal, 10)) })
    .eq("id", true);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return ok();
}
