import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("c:/Users/owner/Desktop/CAG Application/.env.local", "utf8")
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

let ready = true;

for (const col of ["date_signed", "last_contact", "follow_up_days"]) {
  const { error } = await db.from("partnerships").select(col).limit(1);
  const ok = !error;
  if (!ok) ready = false;
  console.log(`${ok ? "PASS" : "FAIL"}  column partnerships.${col}${error ? " — " + error.message : ""}`);
}

const { error: oldErr } = await db.from("partnerships").select("date_added").limit(1);
console.log(`${oldErr ? "PASS" : "WARN"}  old column date_added is gone${oldErr ? "" : " — still present"}`);

const { data: statuses } = await db
  .from("list_items")
  .select("name, sort_order")
  .eq("kind", "partnership_status")
  .order("sort_order");
console.log(`\npartnership statuses: ${(statuses ?? []).map((s) => s.name).join(", ") || "(none)"}`);

const { count } = await db.from("partnerships").select("id", { count: "exact", head: true });
console.log(`partnership rows: ${count ?? 0}`);

console.log(ready ? "\nMIGRATION APPLIED — safe to push" : "\nMIGRATION NOT APPLIED — pushing now would break the live app");
process.exit(ready ? 0 : 1);
