// Verifies the lead/partnership split against the live database, then cleans up.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(process.argv[2] ?? ".env.local", "utf8")
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

let fails = 0;
const ok = (label, cond, detail = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const today = new Date();
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayISO = iso(today);
const addDays = (s, n) => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

const created = [];

try {
  const { data: tiers } = await db
    .from("list_items").select("id, name").eq("kind", "partnership_tier").limit(1);
  const { data: statuses } = await db
    .from("list_items").select("id, name").eq("kind", "partnership_status");

  const pending = statuses.find((s) => s.name === "Pending Contact");
  const signed = statuses.find((s) => s.name === "Signed");
  ok("pipeline statuses seeded", !!pending && !!signed);

  // ---- a lead: no signed date ----
  const { data: lead, error: leadErr } = await db
    .from("partnerships")
    .insert({
      business_name: "ZZ Test Lead",
      status_id: pending?.id ?? null,
      tier_id: tiers?.[0]?.id ?? null,
      last_contact: addDays(todayISO, -20),
      follow_up_days: 7,
    })
    .select("id, date_signed, last_contact, follow_up_days, created_at")
    .single();
  if (leadErr) throw leadErr;
  created.push(lead.id);

  ok("lead saves with null date_signed", lead.date_signed === null);
  ok("created_at still records when it was added", !!lead.created_at);

  // follow-up due = last_contact + 7 = 13 days ago -> overdue
  const due = addDays(lead.last_contact, lead.follow_up_days);
  ok("follow-up due computes from last contact", due === addDays(todayISO, -13), `due ${due}`);
  ok("that reads as overdue", due < todayISO);

  // ---- a signed partnership ----
  const { data: partner } = await db
    .from("partnerships")
    .insert({
      business_name: "ZZ Test Partner",
      status_id: signed?.id ?? null,
      tier_id: tiers?.[0]?.id ?? null,
      date_signed: todayISO,
      last_contact: todayISO,
      follow_up_days: 30,
    })
    .select("id, date_signed")
    .single();
  created.push(partner.id);
  ok("partnership saves with a signed date", partner.date_signed === todayISO);

  // ---- the dashboard's actual filters ----
  const { data: all } = await db
    .from("partnerships").select("id, date_signed, last_contact, tier_id");

  const leads = all.filter((p) => !p.date_signed);
  const signedOnes = all.filter((p) => !!p.date_signed);
  ok("lead excluded from signed set", !signedOnes.some((p) => p.id === lead.id));
  ok("partner included in signed set", signedOnes.some((p) => p.id === partner.id));
  ok("lead still visible in the full list", leads.some((p) => p.id === lead.id));

  const newInRange = signedOnes.filter((p) => p.date_signed === todayISO);
  ok("New Partnerships counts only the signed one", newInRange.length === 1);

  const tierCounts = signedOnes.filter((p) => p.tier_id).length;
  ok("tier chart excludes the lead", tierCounts === 1, `${tierCounts} tiered`);

  const contactedToday = all.filter((p) => p.last_contact === todayISO).length;
  ok("daily goal counts businesses contacted today", contactedToday === 1);

  // ---- promoting a lead ----
  await db.from("partnerships")
    .update({ date_signed: todayISO, status_id: signed?.id ?? null }).eq("id", lead.id);
  const { data: promoted } = await db
    .from("partnerships").select("date_signed").eq("id", lead.id).single();
  ok("promoting a lead makes it count", promoted.date_signed === todayISO);
} catch (e) {
  fails++;
  console.error("ERROR", e.message ?? e);
} finally {
  for (const id of created) await db.from("partnerships").delete().eq("id", id);
  const { count } = await db.from("partnerships").select("id", { count: "exact", head: true });
  console.log(`\ncleaned up; ${count ?? 0} partnership rows remain`);
  console.log(fails === 0 ? "\nALL CHECKS PASSED" : `\n${fails} CHECK(S) FAILED`);
  process.exit(fails === 0 ? 0 : 1);
}
