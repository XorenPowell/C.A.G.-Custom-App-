/**
 * Runs the data-dependent parts of migration 022 against staging.
 *
 * 022 was applied to an empty database, so its backfills had nothing to work
 * on. These are the same operations expressed through the API, and all of
 * them are idempotent — running this twice changes nothing the second time.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = (f) => Object.fromEntries(
  readFileSync(f, "utf8").split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));

const s = env(".env.staging");
const live = env(".env.live-readonly");
if (s.NEXT_PUBLIC_SUPABASE_URL === live.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("FAIL  that is the live project. Refusing.");
  process.exit(1);
}
const db = createClient(s.NEXT_PUBLIC_SUPABASE_URL, s.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

const step = (m) => console.log(m);

/* 1 — the SAFC campaign ------------------------------------------------ */
let { data: camps } = await db.from("campaigns").select("id,name,target");
if (!camps?.length) {
  const { data, error } = await db.from("campaigns").insert({
    name: "Stack At Front Campaign", short_name: "SAFC",
    description: "Business cards placed at the front counter of a partner business, kept stocked.",
    target: 100, sort_order: 10,
  }).select("id,name,target").single();
  if (error) { console.error("FAIL campaigns:", error.message); process.exit(1); }
  camps = [data];
  step(`campaigns            created "${data.name}" target ${data.target}`);
} else {
  step(`campaigns            already present (${camps.length})`);
}

/* 2 — contact roles ---------------------------------------------------- */
const ROLES = ["Property Manager","Realtor","Storage Facility Manager","Leasing Agent",
  "Office Manager","Front Desk","Owner","Maintenance / Super"];
const { data: haveRoles } = await db.from("list_items").select("id,name").eq("kind","contact_role");
const haveNames = new Set((haveRoles ?? []).map(r => r.name.toLowerCase()));
const missing = ROLES.filter(r => !haveNames.has(r.toLowerCase()));
if (missing.length) {
  const { error } = await db.from("list_items").insert(
    missing.map((name,i) => ({ kind:"contact_role", name, sort_order:(haveNames.size+i+1)*10 })));
  if (error) { console.error("FAIL roles:", error.message); process.exit(1); }
}
step(`contact_role         ${(haveRoles?.length ?? 0) + missing.length} roles (${missing.length} added)`);

const { data: roleRows } = await db.from("list_items").select("id,name").eq("kind","contact_role");
const roleId = (n) => roleRows.find(r => r.name === n)?.id ?? null;

/* 3 — contacts from the old primary/secondary POC columns -------------- */
const { data: parts } = await db.from("partnerships")
  .select("id,business_name,poc_name,poc_phone,poc_email,secondary_poc_name,secondary_poc_phone,secondary_poc_email,created_at");
const { data: existing } = await db.from("contacts").select("partnership_id,name,phone,email");
const seen = new Set((existing ?? []).map(c => `${c.partnership_id}|${(c.name||"").toLowerCase()}`));

const newContacts = [];
for (const p of parts ?? []) {
  for (const [n, ph, em] of [
    [p.poc_name, p.poc_phone, p.poc_email],
    [p.secondary_poc_name, p.secondary_poc_phone, p.secondary_poc_email],
  ]) {
    if (!n && !ph && !em) continue;
    const name = (n && n.trim()) || "Unnamed contact";
    const key = `${p.id}|${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    newContacts.push({ partnership_id:p.id, name, phone:ph||null, email:em||null,
      source:"Migrated from partnership", created_at:p.created_at });
  }
}
for (let i=0;i<newContacts.length;i+=250) {
  const { error } = await db.from("contacts").insert(newContacts.slice(i,i+250));
  if (error) { console.error("FAIL contacts:", error.message); process.exit(1); }
}
step(`contacts             ${newContacts.length} lifted from POC columns`);

/* 4 — seed the activity log from last_contact -------------------------- */
const { data: withContact } = await db.from("partnerships")
  .select("id,last_contact").not("last_contact","is",null);
const { data: haveAct } = await db.from("activity").select("partnership_id").not("partnership_id","is",null);
const actSeen = new Set((haveAct ?? []).map(a => a.partnership_id));
const seedAct = (withContact ?? []).filter(p => !actSeen.has(p.id)).map(p => ({
  partnership_id: p.id, kind: "note",
  outcome: "Last contact recorded before the activity log existed",
  occurred_at: new Date(`${p.last_contact}T12:00:00-06:00`).toISOString(),
}));
for (let i=0;i<seedAct.length;i+=250) {
  const { error } = await db.from("activity").insert(seedAct.slice(i,i+250));
  if (error) { console.error("FAIL activity:", error.message); process.exit(1); }
}
step(`activity             ${seedAct.length} history entries seeded`);

/* 5 — partnership callbacks from the old relative offset --------------- */
const { data: offsets } = await db.from("partnerships")
  .select("id,last_contact,follow_up_days,follow_up_at")
  .not("follow_up_days","is",null).is("follow_up_at",null).not("last_contact","is",null);
let moved = 0;
for (const p of offsets ?? []) {
  const base = new Date(`${p.last_contact}T09:00:00-06:00`);
  base.setDate(base.getDate() + p.follow_up_days);
  const { error } = await db.from("partnerships")
    .update({ follow_up_at: base.toISOString() }).eq("id", p.id);
  if (!error) moved++;
}
step(`follow_up_at         ${moved} callbacks converted from the old offset`);

/* ---------------------------------------------------------------------- */
const counts = {};
for (const t of ["partnerships","contacts","activity","campaigns","campaign_placements","jobs"]) {
  const { count } = await db.from(t).select("id",{count:"exact",head:true});
  counts[t] = count ?? 0;
}
console.log("\nstaging now holds:");
for (const [k,v] of Object.entries(counts)) console.log(`  ${k.padEnd(22)} ${v}`);

const { data: maxJob } = await db.from("jobs").select("job_id").order("job_id",{ascending:false}).limit(1);
const next = maxJob?.length ? parseInt(maxJob[0].job_id.replace(/\D/g,""),10)+1 : 12;
console.log(`\nOne SQL left, so new jobs on staging do not collide with copied ones:`);
console.log(`  select setval('job_number_seq', ${next}, false);`);
