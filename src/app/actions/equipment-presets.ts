"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, orNull, type ActionResult } from "@/lib/persist";

export type PresetDraft = {
  id: string | null;
  item_name: string;
  default_note: string | null;
  category: string;
  archived: boolean;
};

/**
 * Saves only the rows the editor actually touched. The library runs to a few
 * hundred entries, so rewriting all of them on every save would be wasteful
 * and would clobber concurrent edits.
 */
export async function savePresets(drafts: PresetDraft[]): Promise<ActionResult> {
  const supabase = await createClient();

  const named = drafts.filter((d) => d.item_name.trim() !== "");
  if (named.length !== drafts.length) return fail("Every preset needs an item name.");

  const seen = new Set<string>();
  for (const d of named) {
    const key = d.item_name.trim().toLowerCase();
    if (seen.has(key)) return fail(`Duplicate item name: "${d.item_name.trim()}"`);
    seen.add(key);
  }

  for (const draft of named) {
    const row = {
      item_name: draft.item_name.trim(),
      default_note: orNull(draft.default_note),
      category: draft.category.trim() || "Other",
      archived: draft.archived,
    };

    const res = draft.id
      ? await supabase.from("equipment_presets").update(row).eq("id", draft.id)
      : await supabase.from("equipment_presets").insert(row);

    if (res.error) {
      return fail(
        res.error.code === "23505"
          ? `"${row.item_name}" already exists in the library.`
          : res.error.message,
      );
    }
  }

  revalidatePath("/settings/equipment");
  revalidatePath("/roster", "layout");
  return ok();
}

export async function deletePreset(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // Presets are a lookup, not a foreign key — equipment rows copy the text,
  // so removing a preset never touches an entity's saved equipment.
  const { error } = await supabase.from("equipment_presets").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/settings/equipment");
  revalidatePath("/roster", "layout");
  return ok();
}
