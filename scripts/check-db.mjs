import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(process.argv[2], "utf8")
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

const tables = [
  "settings", "list_items", "message_templates", "entities", "entity_references",
  "entity_rates", "entity_fees", "entity_equipment", "entity_availability",
  "partnerships", "jobs", "job_workers", "job_worker_fees", "google_credentials",
  "job_financials", "job_worker_pay",
];

for (const t of tables) {
  const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
  console.log(`${error ? "FAIL" : "ok  "}  ${t.padEnd(22)} ${error ? error.message : `${count} rows`}`);
}

const { data: lists } = await db.from("list_items").select("kind, name").order("kind");
const byKind = {};
for (const r of lists ?? []) (byKind[r.kind] ??= []).push(r.name);
console.log("\nSeeded lists:");
for (const [k, v] of Object.entries(byKind)) console.log(`  ${k}: ${v.join(", ")}`);

const { data: tpl } = await db.from("message_templates").select("template_name, audience");
console.log(`\nTemplates: ${(tpl ?? []).length}`);

const { data: users } = await db.auth.admin.listUsers();
console.log(`Auth users: ${users?.users?.length ?? 0}`);
for (const u of users?.users ?? []) console.log(`  ${u.email} confirmed=${!!u.email_confirmed_at}`);
