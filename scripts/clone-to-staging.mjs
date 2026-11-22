/**
 * Copies live data into the staging project so the redesign can be clicked
 * through with real records.
 *
 * Reads from live, writes to staging. There is no code path in this script
 * that writes to live — the live client is only ever used with .select().
 *
 *   node scripts/clone-to-staging.mjs
 *
 * Expects .env.live-readonly (live, read-only) and .env.staging (staging) beside each other.
 * Run AFTER schema.sql has been applied to staging, and BEFORE 022.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function env(file) {
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

const live = env(".env.live-readonly");
const stage = env(".env.staging");

if (!stage.NEXT_PUBLIC_SUPABASE_URL || !stage.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("FAIL  .env.staging is missing a URL or service key.");
  process.exit(1);
}
if (stage.NEXT_PUBLIC_SUPABASE_URL === live.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("FAIL  staging and live point at the same project. Refusing to run.");
  process.exit(1);
}

const from = createClient(live.NEXT_PUBLIC_SUPABASE_URL, live.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const to = createClient(stage.NEXT_PUBLIC_SUPABASE_URL, stage.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Parents before children. Ids are carried across unchanged so every foreign
// key still resolves on the other side.
const TABLES = [
  "settings",
  "list_items",
  "message_templates",
  "equipment_presets",
  "entities",
  "entity_references",
  "entity_rates",
  "entity_fees",
  "entity_equipment",
  "entity_availability",
  "partnerships",
  "jobs",
  "job_workers",
  "job_worker_fees",
  "job_costs",
  "job_arrival_windows",
  "face_to_face_sessions",
  "face_to_face_conversations",
  "time_entries",
];
// google_credentials is deliberately absent: the Google refresh token stays
// in live only. Staging connects to its own calendar or none at all.

async function readAll(table) {
  const out = [];
  for (let page = 0; ; page++) {
    const { data, error } = await from
      .from(table)
      .select("*")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(`${table} read: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

let copied = 0;
let failed = 0;

for (const table of TABLES) {
  let rows;
  try {
    rows = await readAll(table);
  } catch (e) {
    console.log(`SKIP  ${table.padEnd(28)} ${e.message}`);
    continue;
  }

  if (rows.length === 0) {
    console.log(`----  ${table.padEnd(28)} empty`);
    continue;
  }

  // settings is a single fixed-id row that schema.sql may already have made.
  const mode = table === "settings" ? "upsert" : "insert";
  let wrote = 0;

  for (let i = 0; i < rows.length; i += 250) {
    const chunk = rows.slice(i, i + 250);
    const q =
      mode === "upsert"
        ? to.from(table).upsert(chunk, { onConflict: "id" })
        : to.from(table).upsert(chunk, { onConflict: "id", ignoreDuplicates: true });
    const { error } = await q;
    if (error) {
      console.log(`FAIL  ${table.padEnd(28)} ${error.message}`);
      failed++;
      break;
    }
    wrote += chunk.length;
  }

  if (wrote) {
    console.log(`ok    ${table.padEnd(28)} ${wrote}`);
    copied += wrote;
  }
}

console.log(`\n${copied} rows copied into staging${failed ? `, ${failed} table(s) failed` : ""}.`);
console.log("Live was read-only throughout.");
process.exit(failed ? 1 : 0);
