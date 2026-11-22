/**
 * Finds data that still exists but is no longer reachable through the UI.
 *
 * Reads one row from every table to discover its real columns, then greps the
 * source for each column name. A column with data and no reference anywhere
 * is a column you can no longer see.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const env = (f) => Object.fromEntries(
  readFileSync(f, "utf8").split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));
const S = env(".env.staging");
const db = createClient(S.NEXT_PUBLIC_SUPABASE_URL, S.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

/* every .ts/.tsx under src, as one blob */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const SRC = walk("src").map((f) => readFileSync(f, "utf8")).join("\n");

const TABLES = [
  "settings", "list_items", "message_templates", "equipment_presets",
  "entities", "entity_references", "entity_rates", "entity_fees",
  "entity_equipment", "entity_availability",
  "partnerships", "contacts", "activity", "campaigns", "campaign_placements",
  "jobs", "job_workers", "job_worker_fees", "job_costs", "job_arrival_windows",
  "face_to_face_sessions", "face_to_face_conversations", "time_entries",
];

// Columns nothing should need to render.
const PLUMBING = new Set(["id", "created_at", "updated_at", "sort_order"]);

// Deliberately retired: kept so migration 022 stays reversible.
const RETIRED = new Set(["follow_up_days", "mature_partnership_goal_per_zone"]);

let hidden = 0, retired = 0;
for (const table of TABLES) {
  const { data, error } = await db.from(table).select("*").limit(1);
  if (error) { console.log(`SKIP  ${table}: ${error.message}`); continue; }
  if (!data?.length) { console.log(`----  ${table.padEnd(26)} empty`); continue; }

  const cols = Object.keys(data[0]);
  const unref = cols.filter((c) => !PLUMBING.has(c) && !SRC.includes(c));

  if (unref.length === 0) {
    console.log(`ok    ${table.padEnd(26)} all ${cols.length} columns referenced`);
  } else {
    for (const c of unref) {
      // Does this column actually hold anything?
      const { count } = await db.from(table)
        .select("id", { count: "exact", head: false }).not(c, "is", null).limit(1);
      const populated = (count ?? 0) > 0;
      if (RETIRED.has(c)) {
        retired++;
        console.log(`note  ${table}.${c} — retired on purpose${populated ? ` (${count} rows still hold a value)` : ""}`);
      } else if (populated) {
        hidden++;
        console.log(`HIDDEN ${table}.${c} — ${count} rows have data, nothing in src/ reads it`);
      } else {
        console.log(`----  ${table}.${c} — unreferenced but empty`);
      }
    }
  }
}

console.log("\n--------------------------------------------");
console.log(hidden
  ? `${hidden} column(s) hold data the app can no longer show.`
  : "No populated column is unreachable from the UI.");
if (retired) console.log(`${retired} deliberately retired column(s), kept for reversibility.`);
process.exitCode = hidden ? 1 : 0;
