// End-to-end data-layer test. Creates real records, checks the derived views
// against hand-computed values, exercises the app's query shapes, then cleans up.
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

let failures = 0;
function check(label, actual, expected) {
  const pass = Math.abs(Number(actual) - Number(expected)) < 0.005;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${actual}, expected ${expected}`);
}
function ok(label, cond, detail = "") {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

const cleanup = { entities: [], jobs: [], partnerships: [] };

try {
  const { data: cats } = await db.from("list_items").select("id, name").eq("kind", "service_category");
  const { data: zones } = await db.from("list_items").select("id, name").eq("kind", "zone");
  const { data: sources } = await db.from("list_items").select("id, name").eq("kind", "lead_source");
  const moving = cats.find((c) => c.name === "Moving");
  const chicago = zones[0];
  const referral = sources.find((s) => s.name === "Partnership Referral");

  // ---------- entity with rates + standing fees ----------
  const { data: entity, error: eErr } = await db
    .from("entities")
    .insert({
      entity_name: "ZZ Smoke Test Crew",
      roster_size: 3,
      worker_names: ["Alpha", "Bravo", "Charlie"],
      poc_name: "Test POC",
      poc_phone: "3125551234",
      zone_id: chicago.id,
      status: "Active",
    })
    .select("id, availability_updated_at")
    .single();
  if (eErr) throw eErr;
  cleanup.entities.push(entity.id);
  ok("entity insert", !!entity.id);
  ok("availability_updated_at starts null", entity.availability_updated_at === null);

  await db.from("entity_rates").insert({
    entity_id: entity.id, service_category_id: moving.id,
    regular_rate: 45, travel_rate: 25, other_rate: 60,
  });
  await db.from("entity_fees").insert({
    entity_id: entity.id, fee_name: "Truck fee", amount: 75, sort_order: 0,
  });

  // availability trigger should stamp the parent
  await db.from("entity_availability").insert({
    entity_id: entity.id, date: "2026-08-10", start_time: "08:00", end_time: "17:00",
  });
  const { data: stamped } = await db
    .from("entities").select("availability_updated_at").eq("id", entity.id).single();
  ok("availability trigger stamps parent", stamped.availability_updated_at !== null);

  // ---------- partnership ----------
  const { data: partnership } = await db
    .from("partnerships")
    .insert({ business_name: "ZZ Smoke Test Partner", total_cards_dropped: 40 })
    .select("id").single();
  cleanup.partnerships.push(partnership.id);

  // ---------- job ----------
  const { data: job, error: jErr } = await db
    .from("jobs")
    .insert({
      customer_name: "ZZ Smoke Customer",
      customer_phone: "(312) 555-9999",
      customer_type: "Residential",
      service_category_id: moving.id,
      lead_source_id: referral.id,
      partnership_id: partnership.id,
      zone_id: chicago.id,
      status: "Completed",
      date_of_invoice: "2026-08-05",
      arrival_date: "2026-08-10",
      arrival_time: "09:00",
      estimated_duration_minutes: 150,
      addresses: ["100 N State St", "200 W Madison St", "300 S Halsted St"],
      total_invoice_paid: 1000,
      pos_fee_percent: 5.0,
      other_job_costs: 50,
    })
    .select("id, job_id").single();
  if (jErr) throw jErr;
  cleanup.jobs.push(job.id);

  ok("job_id sequence starts at 12", job.job_id === "JOB-0012", `got ${job.job_id}`);
  ok("addresses accepts 3+ stops", true);

  const { data: worker } = await db
    .from("job_workers")
    .insert({
      job_id: job.id, entity_id: entity.id,
      regular_hours: 4, regular_rate: 45,
      travel_hours: 1, travel_rate: 25,
      other_hours: 0, other_rate: 60,
      sort_order: 0,
    })
    .select("id").single();

  await db.from("job_worker_fees").insert({
    job_worker_id: worker.id, description: "Truck fee", amount: 75, sort_order: 0,
  });

  // worker pay = 4*45 + 1*25 + 0 + 75 = 280
  const { data: pay } = await db
    .from("job_worker_pay").select("*").eq("job_worker_id", worker.id).single();
  check("worker calculated_pay", pay.calculated_pay, 280);
  check("worker effective_pay (no override)", pay.effective_pay, 280);

  // job: payout 280, pos fee 1000*5% = 50, costs 280+50+50 = 380, profit 620
  const { data: fin1 } = await db
    .from("job_financials").select("*").eq("job_id", job.id).single();
  check("pos_fee_amount", fin1.pos_fee_amount, 50);
  check("total_worker_payout", fin1.total_worker_payout, 280);
  check("total_job_costs", fin1.total_job_costs, 380);
  check("profit", fin1.profit, 620);
  ok("week_of is the Monday", fin1.week_of === "2026-08-03", `got ${fin1.week_of}`);
  ok("month", fin1.month === "2026-08", `got ${fin1.month}`);
  ok("repeat_customer false on first job", fin1.repeat_customer === false);

  // ---------- worker-level override ----------
  await db.from("job_workers").update({ total_pay_override: 300 }).eq("id", worker.id);
  const { data: fin2 } = await db
    .from("job_financials").select("*").eq("job_id", job.id).single();
  check("payout uses worker override", fin2.total_worker_payout, 300);
  check("profit follows worker override", fin2.profit, 600);

  // ---------- job-level override wins over worker sum ----------
  await db.from("jobs").update({ total_worker_payout_override: 500 }).eq("id", job.id);
  const { data: fin3 } = await db
    .from("job_financials").select("*").eq("job_id", job.id).single();
  check("job override wins", fin3.total_worker_payout, 500);
  check("calculated payout still exposed", fin3.calculated_worker_payout, 300);
  check("profit follows job override", fin3.profit, 400);

  // ---------- clearing the override returns to auto ----------
  await db.from("jobs").update({ total_worker_payout_override: null }).eq("id", job.id);
  await db.from("job_workers").update({ total_pay_override: null }).eq("id", worker.id);
  const { data: fin4 } = await db
    .from("job_financials").select("*").eq("job_id", job.id).single();
  check("reset to auto", fin4.total_worker_payout, 280);

  // ---------- repeat customer detection ----------
  const { data: job2 } = await db
    .from("jobs").insert({
      customer_name: "ZZ Smoke Customer",
      customer_phone: "312-555-9999",   // different formatting, same digits
      status: "Completed",
      date_of_invoice: "2026-09-01",
      total_invoice_paid: 500,
    }).select("id, job_id").single();
  cleanup.jobs.push(job2.id);
  ok("job_id increments", job2.job_id === "JOB-0013", `got ${job2.job_id}`);

  const { data: fin5 } = await db
    .from("job_financials").select("repeat_customer").eq("job_id", job2.id).single();
  ok("repeat_customer true on later job, ignoring phone formatting", fin5.repeat_customer === true);

  // ---------- the app's actual query shapes ----------
  const { error: nestErr } = await db
    .from("entities")
    .select("*, entity_references(*), entity_rates(*), entity_fees(*), entity_equipment(*), entity_availability(*)")
    .eq("id", entity.id).single();
  ok("nested entity select", !nestErr, nestErr?.message);

  const { error: jobNestErr } = await db
    .from("jobs").select("*, job_workers(*, job_worker_fees(*))").eq("id", job.id).single();
  ok("nested job select", !jobNestErr, jobNestErr?.message);

  const { error: embedErr } = await db
    .from("job_workers").select("job_id, entities(entity_name)").eq("job_id", job.id);
  ok("job_workers -> entities embed", !embedErr, embedErr?.message);

  const { error: orErr, data: orData } = await db
    .from("jobs")
    .select("id")
    .or("and(date_of_invoice.gte.2026-08-01,date_of_invoice.lte.2026-08-31),and(arrival_date.gte.2026-08-01,arrival_date.lte.2026-08-31),and(created_at.gte.2026-08-01,created_at.lt.2026-09-01)");
  ok("dashboard or-clause parses", !orErr, orErr?.message);
  ok("dashboard or-clause finds the job", (orData ?? []).some((r) => r.id === job.id));

  const { error: searchErr } = await db
    .from("jobs").select("id").or("customer_name.ilike.%Smoke%,customer_phone.ilike.%555%,job_id.ilike.%JOB%");
  ok("job list text search", !searchErr, searchErr?.message);

  const { error: arrErr } = await db
    .from("entities").select("id").contains("vehicle_type_ids", []);
  ok("vehicle_type_ids array filter", !arrErr, arrErr?.message);

  // ---------- anon key must be blocked by RLS ----------
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: anonJobs } = await anon.from("jobs").select("id");
  ok("RLS blocks anonymous reads of jobs", (anonJobs ?? []).length === 0);
  const { data: anonCreds } = await anon.from("google_credentials").select("id");
  ok("RLS blocks anonymous reads of google_credentials", (anonCreds ?? []).length === 0);
} catch (err) {
  failures++;
  console.error("ERROR", err.message ?? err);
} finally {
  for (const id of cleanup.jobs) await db.from("jobs").delete().eq("id", id);
  for (const id of cleanup.entities) await db.from("entities").delete().eq("id", id);
  for (const id of cleanup.partnerships) await db.from("partnerships").delete().eq("id", id);
  console.log("\ncleaned up test records");
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
