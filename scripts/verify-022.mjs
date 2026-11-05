/** Confirms 022 did what it claimed on staging, and that live is untouched. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = (f) => Object.fromEntries(
  readFileSync(f, "utf8").split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));

const S = env(".env.staging"), L = env(".env.live-readonly");
const stage = createClient(S.NEXT_PUBLIC_SUPABASE_URL, S.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const live  = createClient(L.NEXT_PUBLIC_SUPABASE_URL, L.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

let fails = 0;
const ok = (l, c, d="") => { if(!c) fails++; console.log(`${c?"PASS":"FAIL"}  ${l.padEnd(46)}${d}`); };
const all = async (db,t,cols="*") => (await db.from(t).select(cols)).data ?? [];

console.log("STAGING — migration result");
const contacts = await all(stage,"contacts");
// 53, not 147: a contact with neither phone nor email cannot be acted on,
// so those are not created. The names still live on partnerships.poc_name.
ok("53 reachable contacts", contacts.length===53, `${contacts.length}`);
ok("every contact is reachable", contacts.every(c=>c.email||c.phone));
ok("every contact has a name", contacts.every(c=>c.name && c.name.trim()));
ok("3 placeholders", contacts.filter(c=>c.name==="Unnamed contact").length===3);
ok("33 have an email", contacts.filter(c=>c.email).length===33, `${contacts.filter(c=>c.email).length}`);
ok("all linked to a partnership", contacts.every(c=>c.partnership_id));
ok("none opted out yet", contacts.every(c=>c.email_opt_out===false));

const camps = await all(stage,"campaigns");
ok("SAFC campaign exists", camps.length===1 && camps[0].short_name==="SAFC");
ok("target is 100", camps[0]?.target===100, `${camps[0]?.target}`);

const roles = await all(stage,"list_items","id,name,kind");
const cr = roles.filter(r=>r.kind==="contact_role");
ok("8 contact roles seeded", cr.length===8, `${cr.length}`);

const act = await all(stage,"activity");
ok("activity seeded", act.length===110, `${act.length}`);
ok("every activity has exactly one parent",
   act.every(a=>(a.partnership_id?1:0)+(a.job_id?1:0)===1));

const parts = await all(stage,"partnerships","id,business_name,last_contact,follow_up_days,follow_up_at");
const converted = parts.filter(p=>p.follow_up_at);
ok("93 callbacks converted", converted.length===93, `${converted.length}`);
ok("old follow_up_days still present (reversible)",
   parts.some(p=>p.follow_up_days!=null));

/* the trigger: logging contact must move last_contact */
const victim = parts.find(p=>p.last_contact);
const before = victim.last_contact;
const when = new Date(); when.setDate(when.getDate()+1);           // future date, so greatest() must move it
const { data: ins, error: insErr } = await stage.from("activity")
  .insert({ partnership_id:victim.id, kind:"call", outcome:"__verify__", occurred_at:when.toISOString() })
  .select("id").single();
if (insErr) { ok("trigger test insert", false, insErr.message); }
else {
  const { data: after } = await stage.from("partnerships").select("last_contact").eq("id",victim.id).single();
  ok("logging a call moves last_contact", after.last_contact > before, `${before} -> ${after.last_contact}`);
  await stage.from("activity").delete().eq("id", ins.id);
  await stage.from("partnerships").update({ last_contact: before }).eq("id", victim.id);
  const { data: restored } = await stage.from("partnerships").select("last_contact").eq("id",victim.id).single();
  ok("test data cleaned up", restored.last_contact===before);
}

console.log("\nLIVE — must be untouched");
for (const t of ["contacts","campaigns","campaign_placements","activity"]) {
  const { error } = await live.from(t).select("id").limit(1);
  ok(`live has no ${t} table`, !!error, error ? "" : "TABLE EXISTS — 022 hit live");
}
const liveParts = await all(live,"partnerships","id,follow_up_days");
ok("live partnerships still intact", liveParts.length===117, `${liveParts.length}`);
const liveJobs = await all(live,"jobs","id");
ok("live jobs still intact", liveJobs.length===102, `${liveJobs.length}`);

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exitCode = fails ? 1 : 0;
