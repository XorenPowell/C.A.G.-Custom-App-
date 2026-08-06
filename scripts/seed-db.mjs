// One-off seeder. Mirrors supabase/seed.sql via the service-role client.
// Safe to re-run: existing rows are left alone.
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

async function step(label, fn) {
  const { error } = await fn();
  console.log(`${error ? "FAIL" : "ok  "}  ${label}${error ? ` — ${error.message}` : ""}`);
  if (error) process.exitCode = 1;
}

await step("settings", () => db.from("settings").upsert({ id: true }, { onConflict: "id" }));
await step("google_credentials", () =>
  db.from("google_credentials").upsert({ id: true }, { onConflict: "id" }),
);

const lists = [
  ["service_category", ["Moving", "Cleaning", "Junk Removal", "Handyman", "Yard Work", "Tech Consultation", "Need-A-Guy"]],
  ["lead_source", ["Craigslist", "Facebook", "Google Business Profile", "Yelp", "F2F", "Partnership Referral", "Repeat Customer"]],
  ["vehicle_type", ["Cargo Van", "Box Truck", "Pickup Truck", "SUV", "Sedan", "Trailer", "No Vehicle"]],
  ["partnership_status", ["Prospect", "Contacted", "Signed", "Inactive"]],
  ["partnership_tier", [
    "Tier 1 – Passive Placement",
    "Tier 2 – Active Referral",
    "Tier 3 – Co-Marketing",
    "Tier 4 – Embedded/System",
    "Tier 5 – Reciprocal/Cross-Promo",
    "Tier 6 – Digital/Online",
  ]],
];

const rows = [];
for (const [kind, names] of lists) {
  names.forEach((name, i) => rows.push({ kind, name, sort_order: (i + 1) * 10 }));
}
rows.push({
  kind: "zone",
  name: "Chicago",
  description: "All ZIP codes within a 10-mile radius of the Loop.",
  sort_order: 10,
});

const { data: existing } = await db.from("list_items").select("kind, name");
const have = new Set((existing ?? []).map((r) => `${r.kind}|${r.name.toLowerCase()}`));
const toInsert = rows.filter((r) => !have.has(`${r.kind}|${r.name.toLowerCase()}`));

if (toInsert.length) {
  await step(`list_items (${toInsert.length})`, () => db.from("list_items").insert(toInsert));
} else {
  console.log("ok    list_items — already seeded");
}

const templateNames = ["Deposit Paid", "Morning Of", "2 Hours Prior", "15 Minutes Prior", "Arrival"];
const { data: haveTpl } = await db.from("message_templates").select("template_name, audience");
const tplSet = new Set((haveTpl ?? []).map((t) => `${t.template_name}|${t.audience}`));

const tplRows = [];
for (const audience of ["Customer", "Worker"]) {
  templateNames.forEach((template_name, i) => {
    if (!tplSet.has(`${template_name}|${audience}`)) {
      tplRows.push({ template_name, audience, body: "", sort_order: (i + 1) * 10 });
    }
  });
}

if (tplRows.length) {
  await step(`message_templates (${tplRows.length})`, () =>
    db.from("message_templates").insert(tplRows),
  );
} else {
  console.log("ok    message_templates — already seeded");
}
