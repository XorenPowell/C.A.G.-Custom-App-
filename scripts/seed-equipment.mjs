// Loads the equipment preset library. Idempotent — existing rows are left
// alone, including any edits made in Settings.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { buildRows } from "./equipment-presets.data.mjs";

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

const rows = buildRows();
console.log(`preset library: ${rows.length} rows`);

const { data: existing, error: readErr } = await db
  .from("equipment_presets")
  .select("item_name");

if (readErr) {
  console.error("FAIL — is the 002 migration applied? " + readErr.message);
  process.exit(1);
}

const have = new Set((existing ?? []).map((r) => r.item_name.toLowerCase()));
const toInsert = rows.filter((r) => !have.has(r.item_name.toLowerCase()));

if (toInsert.length === 0) {
  console.log("already seeded — nothing to insert");
} else {
  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { error } = await db.from("equipment_presets").insert(chunk);
    if (error) {
      console.error("FAIL " + error.message);
      process.exit(1);
    }
    console.log(`  inserted ${Math.min(i + 200, toInsert.length)}/${toInsert.length}`);
  }
}

const { count } = await db
  .from("equipment_presets")
  .select("id", { count: "exact", head: true });
console.log(`\ntotal presets in database: ${count}`);

const { data: cats } = await db.from("equipment_presets").select("category");
const byCat = {};
for (const c of cats ?? []) byCat[c.category] = (byCat[c.category] ?? 0) + 1;
for (const [k, v] of Object.entries(byCat).sort()) console.log(`  ${k.padEnd(26)} ${v}`);
