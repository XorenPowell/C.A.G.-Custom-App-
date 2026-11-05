/** Reports what exists in the staging project, so we know which step is next. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = (f) => Object.fromEntries(
  readFileSync(f, "utf8").split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));

const s = env(".env.staging");
const db = createClient(s.NEXT_PUBLIC_SUPABASE_URL, s.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });


/**
 * A real GET, never a HEAD. supabase-js does not surface a 404 as an error on
 * HEAD requests, so a missing table counts as "ok, 0 rows" and the probe lies
 * about what has been applied.
 */
async function tableCount(t) {
  const { data, count, error } = await db.from(t).select("id", { count: "exact" }).limit(1);
  if (error) return { count: 0, error };
  return { count: count ?? (data?.length ?? 0), error: null };
}

const BASE = ["settings","list_items","message_templates","equipment_presets","entities",
  "entity_rates","entity_equipment","partnerships","jobs","job_workers","job_costs",
  "job_arrival_windows","face_to_face_sessions","time_entries"];
const NEW  = ["contacts","campaigns","campaign_placements","activity"];

let baseOk = 0, newOk = 0, rows = 0;
console.log("BASE SCHEMA (schema.sql)");
for (const t of BASE) {
  const { count, error } = await tableCount(t);
  if (error) { console.log(`  MISSING  ${t}`); }
  else { baseOk++; rows += count; console.log(`  ok       ${t.padEnd(26)} ${count} rows`); }
}
console.log("\nREDESIGN TABLES (022)");
for (const t of NEW) {
  const { count, error } = await tableCount(t);
  if (error) console.log(`  MISSING  ${t}`);
  else { newOk++; console.log(`  ok       ${t.padEnd(26)} ${count} rows`); }
}

console.log("\n--------------------------------------------");
if (baseOk === 0)            console.log("NEXT: run supabase/schema.sql on staging.");
else if (baseOk < BASE.length) console.log(`NEXT: schema.sql looks partial (${baseOk}/${BASE.length}). Re-run it.`);
else if (rows === 0)         console.log("NEXT: schema is in place and empty. Ready for the data copy.");
else if (newOk < NEW.length) console.log(`NEXT: ${rows} rows present. Run 022_smt_redesign.sql.`);
else                         console.log(`READY: schema + ${rows} rows + redesign tables all present.`);
