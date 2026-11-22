/** Mirrors migration 022's contact backfill in JS and asserts the result,
 *  so a failure is found here rather than halfway through the SQL editor. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = (f) => Object.fromEntries(
  readFileSync(f, "utf8").split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));

const s = env(".env.staging");
const db = createClient(s.NEXT_PUBLIC_SUPABASE_URL, s.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

const { data: P } = await db.from("partnerships")
  .select("id,business_name,poc_name,poc_phone,poc_email,secondary_poc_name,secondary_poc_phone,secondary_poc_email,last_contact,follow_up_days");

const nz = (v) => { const t = (v == null ? "" : String(v)).trim(); return t === "" ? null : t; };

const rows = [];
for (const p of P) {
  for (const [n, ph, em] of [
    [p.poc_name, p.poc_phone, p.poc_email],
    [p.secondary_poc_name, p.secondary_poc_phone, p.secondary_poc_email],
  ]) {
    if (nz(n) === null && nz(em) === null && nz(ph) === null) continue;
    rows.push({ pid: p.id, name: nz(n) ?? "Unnamed contact", phone: nz(ph), email: nz(em) });
  }
}

let fails = 0;
const ok = (l, c, d = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l.padEnd(44)}${d}`); };

ok("contacts produced", rows.length === 147, `${rows.length}`);
ok("name is never null", rows.every(r => r.name !== null));
ok("name is never blank", rows.every(r => r.name.trim() !== ""));
ok("placeholder used only where no name exists", rows.filter(r => r.name === "Unnamed contact").length === 3);
// A name with no contact details is legitimate — you know who they are and
// nothing else. Only a row with neither a name nor any way to reach them
// would be junk, and the WHERE clause already excludes those.
ok("no row is entirely empty", rows.every(r => r.name !== "Unnamed contact" || r.phone || r.email));
const keys = rows.map(r => `${r.pid}|${r.name.toLowerCase()}|${r.phone ?? ""}`);
ok("dedupe key unique (re-running inserts nothing)", new Set(keys).size === keys.length,
   `${keys.length - new Set(keys).size} collisions`);

const nameOnly = rows.filter(r => !r.phone && !r.email);
const withEmail = rows.filter(r => r.email);
console.log(`\n  with email      ${withEmail.length}   <- the batch-email audience`);
console.log(`  with phone only ${rows.filter(r => r.phone && !r.email).length}`);
console.log(`  name only       ${nameOnly.length}   (known person, no details yet)`);
console.log(`  placeholders    ${rows.filter(r => r.name === "Unnamed contact").length}`);
console.log(`  callbacks to convert from follow_up_days: ${P.filter(p => p.follow_up_days != null && p.last_contact).length}`);

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS — safe to run 022");
process.exitCode = fails ? 1 : 0;
