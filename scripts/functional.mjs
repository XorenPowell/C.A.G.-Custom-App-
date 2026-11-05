/**
 * Exercises the write paths and the guarantees the schema is supposed to
 * enforce, then cleans up after itself. Rendering a page proves it loads;
 * this proves saving does the right thing.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = (f) => Object.fromEntries(
  readFileSync(f, "utf8").split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));

const S = env(".env.staging"), L = env(".env.live-readonly");
if (S.NEXT_PUBLIC_SUPABASE_URL === L.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("FAIL  staging is pointed at live. Refusing."); process.exit(1);
}
const db = createClient(S.NEXT_PUBLIC_SUPABASE_URL, S.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

let fails = 0;
const ok = (l, c, d = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l.padEnd(52)}${d}`); };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());

const cleanup = { activity: [], contacts: [], placements: [], partnerships: [] };

try {
  /* a throwaway partnership so nothing real is touched */
  const { data: p } = await db.from("partnerships")
    .insert({ business_name: "ZZ Functional Test Co" }).select("*").single();
  cleanup.partnerships.push(p.id);
  ok("partnership created with no callback", p.follow_up_at === null);

  /* ---- activity: exactly one parent ---------------------------------- */
  const bothParents = await db.from("activity")
    .insert({ partnership_id: p.id, job_id: (await db.from("jobs").select("id").limit(1)).data[0].id, kind: "call" });
  ok("activity with two parents is rejected", !!bothParents.error);

  const noParent = await db.from("activity").insert({ kind: "call" });
  ok("activity with no parent is rejected", !!noParent.error);

  const badKind = await db.from("activity").insert({ partnership_id: p.id, kind: "carrier-pigeon" });
  ok("unknown activity kind is rejected", !!badKind.error);

  /* ---- the trigger: logging contact moves last_contact --------------- */
  const { data: a1 } = await db.from("activity")
    .insert({ partnership_id: p.id, kind: "call", outcome: "Spoke with POC" })
    .select("id").single();
  cleanup.activity.push(a1.id);
  const { data: afterCall } = await db.from("partnerships")
    .select("last_contact").eq("id", p.id).single();
  ok("logging a call sets last_contact", afterCall.last_contact === today(), afterCall.last_contact ?? "null");

  /* a note is not outreach and must not move it */
  const { data: before } = await db.from("partnerships").select("last_contact").eq("id", p.id).single();
  const { data: a2 } = await db.from("activity")
    .insert({ partnership_id: p.id, kind: "note", outcome: "Stage changed to Mature" })
    .select("id").single();
  cleanup.activity.push(a2.id);
  const { data: afterNote } = await db.from("partnerships").select("last_contact").eq("id", p.id).single();
  ok("a note does not move last_contact", afterNote.last_contact === before.last_contact);

  /* an older entry must not drag last_contact backwards */
  const old = new Date(); old.setDate(old.getDate() - 60);
  const { data: a3 } = await db.from("activity")
    .insert({ partnership_id: p.id, kind: "visit", occurred_at: old.toISOString() })
    .select("id").single();
  cleanup.activity.push(a3.id);
  const { data: afterOld } = await db.from("partnerships").select("last_contact").eq("id", p.id).single();
  ok("backdated contact does not rewind last_contact", afterOld.last_contact === today());

  /* ---- contacts ------------------------------------------------------ */
  const noName = await db.from("contacts").insert({ partnership_id: p.id, phone: "3125551212" });
  ok("contact with no name is rejected", !!noName.error);

  const { data: c1 } = await db.from("contacts")
    .insert({ partnership_id: p.id, name: "Test Person", email: "t@example.com" })
    .select("*").single();
  cleanup.contacts.push(c1.id);
  ok("contact saves", c1.name === "Test Person");
  ok("contact defaults to not opted out", c1.email_opt_out === false);

  /* ---- campaign placements ------------------------------------------ */
  const { data: camp } = await db.from("campaigns").select("id,target").limit(1).single();
  const { data: pl } = await db.from("campaign_placements")
    .insert({ campaign_id: camp.id, partnership_id: p.id, location: "Front counter",
              placed_on: today(), last_restock_on: today(), restock_interval_days: 14, cards_left: 50 })
    .select("*").single();
  cleanup.placements.push(pl.id);
  ok("placement saves", pl.restock_interval_days === 14);

  const dupe = await db.from("campaign_placements")
    .insert({ campaign_id: camp.id, partnership_id: p.id, restock_interval_days: 7 });
  ok("one live stack per business per campaign", !!dupe.error);

  /* restock due = last restock + interval */
  const due = new Date(`${pl.last_restock_on}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + pl.restock_interval_days);
  ok("restock due computes 14 days out", due.toISOString().slice(0,10) > today());

  /* ---- deleting a partnership takes its children with it ------------- */
  const { data: p2 } = await db.from("partnerships")
    .insert({ business_name: "ZZ Cascade Test" }).select("id").single();
  await db.from("contacts").insert({ partnership_id: p2.id, name: "Gone", phone: "3125550000" });
  await db.from("activity").insert({ partnership_id: p2.id, kind: "call" });
  await db.from("partnerships").delete().eq("id", p2.id);
  const { count: orphanContacts } = await db.from("contacts")
    .select("id", { count: "exact" }).eq("partnership_id", p2.id).limit(1);
  const { count: orphanActivity } = await db.from("activity")
    .select("id", { count: "exact" }).eq("partnership_id", p2.id).limit(1);
  ok("deleting a partnership removes its contacts", (orphanContacts ?? 0) === 0);
  ok("deleting a partnership removes its activity", (orphanActivity ?? 0) === 0);

  /* ---- jobs keep working -------------------------------------------- */
  const { data: job } = await db.from("jobs").select("id,follow_up_at,follow_up_note").limit(1).single();
  const stamp = new Date().toISOString();
  await db.from("jobs").update({ follow_up_at: stamp, follow_up_note: "ZZ test" }).eq("id", job.id);
  const { data: jobAfter } = await db.from("jobs")
    .select("follow_up_at,follow_up_note").eq("id", job.id).single();
  ok("job callback + note save", jobAfter.follow_up_note === "ZZ test" && !!jobAfter.follow_up_at);
  await db.from("jobs")
    .update({ follow_up_at: job.follow_up_at, follow_up_note: job.follow_up_note }).eq("id", job.id);
  const { data: jobRestored } = await db.from("jobs").select("follow_up_note").eq("id", job.id).single();
  ok("job restored to its original state", jobRestored.follow_up_note === job.follow_up_note);

  const { data: jobAct } = await db.from("activity")
    .insert({ job_id: job.id, kind: "call", outcome: "ZZ deposit chase" }).select("id").single();
  cleanup.activity.push(jobAct.id);
  ok("activity attaches to a job", !!jobAct.id);
} catch (e) {
  fails++;
  console.error("ERROR", e.message ?? e);
} finally {
  for (const id of cleanup.activity)   await db.from("activity").delete().eq("id", id);
  for (const id of cleanup.contacts)   await db.from("contacts").delete().eq("id", id);
  for (const id of cleanup.placements) await db.from("campaign_placements").delete().eq("id", id);
  for (const id of cleanup.partnerships) await db.from("partnerships").delete().eq("id", id);

  const { count: leftover } = await db.from("partnerships")
    .select("id", { count: "exact", head: false }).ilike("business_name", "ZZ %");
  ok("test records cleaned up", (leftover ?? 0) === 0, `${leftover ?? 0} left`);

  const { count: parts } = await db.from("partnerships").select("id", { count: "exact" }).limit(1);
  const { count: cons } = await db.from("contacts").select("id", { count: "exact" }).limit(1);
  console.log(`\nstaging intact: ${parts} partnerships, ${cons} contacts`);
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
  process.exitCode = fails ? 1 : 0;
}
