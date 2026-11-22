/**
 * Pulls the role out of contact names like "Conrad - Property Manager".
 *
 * The role was typed into the name field because there was nowhere else to
 * put it. Now there is, so it moves to role_id and the name becomes the
 * person. Roles not already in the list are created rather than forced into
 * an approximate match, so the dispatcher's own words survive.
 *
 *   node scripts/extract-contact-roles.mjs          dry run
 *   node scripts/extract-contact-roles.mjs --apply  write it
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const env = (f) => Object.fromEntries(
  readFileSync(f, "utf8").split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));

const S = env(".env.staging"), L = env(".env.live-readonly");
if (S.NEXT_PUBLIC_SUPABASE_URL === L.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("FAIL  that is live. Refusing."); process.exit(1);
}
const db = createClient(S.NEXT_PUBLIC_SUPABASE_URL, S.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

/** Abbreviations and casing the dispatcher actually used. */
const ALIASES = new Map(Object.entries({
  "pm": "Property Manager",
  "prop manager": "Property Manager",
  "prop mgr": "Property Manager",
  "property mgr": "Property Manager",
  "asst prop manager": "Assistant Property Manager",
  "assistant prop manager": "Assistant Property Manager",
  "gm": "General Manager",
  "poc": null,     // not a role, just "the contact"
  "owner": "Owner",
  "manager": "Manager",
}));

const titleCase = (s) =>
  s.replace(/\s+/g, " ").trim()
   .split(" ")
   .map((w) => (w.length <= 2 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
   .join(" ");

function parse(name) {
  const m = name.match(/^(.*?)\s+[-–]\s+(.+)$/);
  if (!m) return null;
  const person = m[1].trim();
  const raw = m[2].trim();
  if (!person || !raw) return null;

  const key = raw.toLowerCase().replace(/\./g, "").trim();
  if (ALIASES.has(key)) {
    const mapped = ALIASES.get(key);
    return mapped ? { person, role: mapped } : { person, role: null };
  }
  return { person, role: titleCase(raw) };
}

const { data: contacts } = await db.from("contacts").select("id,name,role_id");
const { data: existingRoles } = await db.from("list_items").select("id,name").eq("kind", "contact_role");

const roleByName = new Map(existingRoles.map((r) => [r.name.toLowerCase(), r.id]));
const planned = [];
const newRoles = new Set();

for (const c of contacts) {
  if (c.role_id) continue;
  const parsed = parse(c.name);
  if (!parsed) continue;
  planned.push({ id: c.id, from: c.name, person: parsed.person, role: parsed.role });
  if (parsed.role && !roleByName.has(parsed.role.toLowerCase())) newRoles.add(parsed.role);
}

console.log(`${planned.length} of ${contacts.length} contacts have a role in their name.`);
if (newRoles.size) console.log(`\nroles to create: ${[...newRoles].join(", ")}`);
console.log("\nplanned changes:");
for (const p of planned) {
  console.log(`  "${p.from}"`.padEnd(46) + `-> ${p.person.padEnd(22)} [${p.role ?? "no role"}]`);
}

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to write.");
  process.exit(0);
}

for (const name of newRoles) {
  const { data, error } = await db.from("list_items")
    .insert({ kind: "contact_role", name, sort_order: 500 })
    .select("id").single();
  if (error) { console.error("FAIL role " + name + ": " + error.message); process.exit(1); }
  roleByName.set(name.toLowerCase(), data.id);
}

let updated = 0;
for (const p of planned) {
  const { error } = await db.from("contacts")
    .update({ name: p.person, role_id: p.role ? roleByName.get(p.role.toLowerCase()) : null })
    .eq("id", p.id);
  if (error) { console.error("FAIL " + p.person + ": " + error.message); process.exit(1); }
  updated++;
}

const { data: after } = await db.from("contacts").select("role_id");
console.log(`\nupdated ${updated} contacts; ${after.filter((c) => c.role_id).length} of ${after.length} now carry a role.`);
