// Verifies the preset library and the roster search rule that depends on it.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(process.argv[2] ?? ".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let fails = 0;
const ok = (label, cond, detail = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

/** Mirrors matchesText() in src/lib/entity-filters.ts. */
const equipmentMatches = (equipment, q) => {
  const n = q.toLowerCase();
  return equipment.some(
    (e) =>
      (e.item_name ?? "").toLowerCase().includes(n) ||
      (e.notes ?? "").toLowerCase().includes(n),
  );
};

const cleanup = [];

try {
  const { data: presets, error: presetErr } = await db
    .from("equipment_presets")
    .select("*")
    .limit(1000);
  if (presetErr) throw new Error(`preset read failed: ${presetErr.message}`);
  ok("library seeded", (presets ?? []).length > 200, `${presets?.length} presets`);

  const bundles = presets.filter((p) => p.category === "Bundles");
  ok("19 bundles present", bundles.length === 19, `${bundles.length}`);
  ok("every bundle has a default note", bundles.every((b) => b.default_note?.length > 20));

  const movingKit = presets.find((p) => p.item_name === "General Moving Kit");
  ok("General Moving Kit exists", !!movingKit);
  ok("its note lists the dolly", /2-wheel dolly/i.test(movingKit?.default_note ?? ""));

  const plainItems = presets.filter((p) => p.category !== "Bundles");
  ok("plain items carry no default note", plainItems.every((p) => !p.default_note));

  // Names are unique, so the autocomplete never shows the same item twice.
  const names = presets.map((p) => p.item_name.toLowerCase());
  ok("no duplicate item names", new Set(names).size === names.length);

  // Items that appeared in several sections survived exactly once.
  for (const dupe of ["work gloves", "shop vacuum", "tarp", "contractor bags"]) {
    ok(`"${dupe}" deduped to one row`, names.filter((n) => n === dupe).length === 1);
  }

  // ---- the search requirement ----
  const { data: entity } = await db
    .from("entities")
    .insert({ entity_name: "ZZ Equip Test Crew", roster_size: 3 })
    .select("id")
    .single();
  cleanup.push(entity.id);

  // One bundle row, exactly as the autocomplete would save it.
  await db.from("entity_equipment").insert({
    entity_id: entity.id,
    item_name: movingKit.item_name,
    notes: movingKit.default_note,
    quantity: 1,
    sort_order: 0,
  });

  const { data: saved } = await db
    .from("entity_equipment")
    .select("item_name, notes")
    .eq("entity_id", entity.id);

  ok("only one equipment row logged", saved.length === 1);
  ok('searching "dolly" finds it via the note', equipmentMatches(saved, "dolly"));
  ok('searching "stretch wrap" finds it', equipmentMatches(saved, "stretch wrap"));
  ok('searching "ratchet straps" finds it', equipmentMatches(saved, "ratchet straps"));
  ok('searching "moving" finds it by name', equipmentMatches(saved, "moving"));
  ok('searching "chainsaw" correctly misses', !equipmentMatches(saved, "chainsaw"));

  // Free text with no preset still saves and is still searchable.
  await db.from("entity_equipment").insert({
    entity_id: entity.id,
    item_name: "Custom welded ramp",
    notes: null,
    quantity: 1,
    sort_order: 1,
  });
  const { data: saved2 } = await db
    .from("entity_equipment")
    .select("item_name, notes")
    .eq("entity_id", entity.id);
  ok("free-text item saves with a blank note", saved2.some((r) => r.item_name === "Custom welded ramp" && !r.notes));
  ok("free-text item is searchable", equipmentMatches(saved2, "welded"));

  // Deleting a preset must not disturb equipment already recorded.
  const { data: temp } = await db
    .from("equipment_presets")
    .insert({ item_name: "ZZ Temp Preset", category: "Other" })
    .select("id")
    .single();
  await db.from("equipment_presets").delete().eq("id", temp.id);
  const { data: stillThere } = await db
    .from("entity_equipment")
    .select("id")
    .eq("entity_id", entity.id);
  ok("preset delete leaves entity equipment intact", stillThere.length === 2);
} catch (e) {
  fails++;
  console.error("ERROR", e.message ?? e);
} finally {
  for (const id of cleanup) await db.from("entities").delete().eq("id", id);
  console.log("\ncleaned up test records");
  console.log(fails === 0 ? "\nALL CHECKS PASSED" : `\n${fails} CHECK(S) FAILED`);
  process.exit(fails === 0 ? 0 : 1);
}
