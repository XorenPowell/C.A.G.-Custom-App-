import { createClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/dates";
import { monthStartISO, monthEndISO, todayISO } from "@/lib/dates";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Dashboard aggregation.
 *
 * The date range is applied in SQL, then the (already small) result set is
 * aggregated in memory. Two different date fields are in play and the screen
 * labels which is which:
 *   - business activity  -> date_of_invoice, falling back to arrival_date then
 *     created_at, matching how the job_financials view derives week/month
 *   - demand generation  -> created_at, because a lead is generated when it
 *     arrives, not when it is invoiced
 *   - new partnerships   -> date_added
 */

type JobRow = {
  id: string;
  status: string;
  service_category_id: string | null;
  lead_source_id: string | null;
  partnership_id: string | null;
  date_of_invoice: string | null;
  arrival_date: string | null;
  created_at: string;
  total_invoice_paid: number;
};

const JOB_COLUMNS =
  "id, status, service_category_id, lead_source_id, partnership_id, date_of_invoice, arrival_date, created_at, total_invoice_paid";

/** Reads every matching row, in pages, so nothing is silently truncated. */
async function pageAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await build(page * size, page * size + size - 1);
    if (error) throw new Error(String((error as { message?: string }).message ?? error));
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

/** The date a job counts on for business activity. */
function activityDate(j: JobRow): string {
  return (j.date_of_invoice ?? j.arrival_date ?? j.created_at).slice(0, 10);
}

function within(date: string | null, r: DateRange): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  if (r.start && d < r.start) return false;
  if (r.end && d > r.end) return false;
  return true;
}

function tally(
  rows: { key: string | null; value: number }[],
  names: Map<string, string>,
): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const label = r.key ? (names.get(r.key) ?? "Unknown") : "Unassigned";
    map.set(label, (map.get(label) ?? 0) + r.value);
  }
  return [...map.entries()].map(([label, value]) => ({ label, value }));
}

export type DashboardData = {
  jobsCompleted: number;
  jobsBooked: number;
  jobsCancelled: number;
  completedByCategory: { label: string; value: number }[];

  totalRevenue: number;
  totalProfit: number;
  avgProfitPerJob: number;
  revenueByCategory: { label: string; value: number }[];

  leadsGenerated: number;
  conversionRate: number;
  leadsBySource: { label: string; value: number }[];

  newPartnerships: number;
  referralsProduced: number;
  cardsDropped: number;
  fliersDropped: number;
  partnershipsByTier: { label: string; value: number }[];

  repeatCustomerRate: number;

  leadsToday: number;
  partnershipsToday: number;
  jobsThisMonth: number;
};

export async function getDashboard(
  range: DateRange,
  names: Map<string, string>,
): Promise<DashboardData> {
  const supabase = await createClient();

  const jobs = await fetchJobsInRange(supabase, range);
  const jobIds = jobs.map((j) => j.id);

  const financials = await fetchFinancials(supabase, jobIds);

  const partnerships = await pageAll<{
    id: string;
    date_added: string;
    tier_id: string | null;
    total_cards_dropped: number;
    total_fliers_dropped: number;
  }>((from, to) =>
    supabase
      .from("partnerships")
      .select("id, date_added, tier_id, total_cards_dropped, total_fliers_dropped")
      .range(from, to),
  );

  // ---- volume, revenue, profit: scoped by activity date -------------------
  const activity = jobs.filter((j) => within(activityDate(j), range));
  const completed = activity.filter((j) => j.status === "Completed");

  const totalRevenue = completed.reduce((s, j) => s + Number(j.total_invoice_paid ?? 0), 0);
  const totalProfit = completed.reduce(
    (s, j) => s + Number(financials.get(j.id)?.profit ?? 0),
    0,
  );

  // ---- demand generation: scoped by created_at ----------------------------
  const created = jobs.filter((j) => within(j.created_at.slice(0, 10), range));
  const leadsGenerated = created.length;

  const repeatCount = completed.filter(
    (j) => financials.get(j.id)?.repeat_customer,
  ).length;

  const inRangePartnerships = partnerships.filter((p) => within(p.date_added, range));

  const [leadsToday, partnershipsToday, jobsThisMonth] = await Promise.all([
    countJobsCreatedOn(supabase, todayISO()),
    countPartnershipsAddedOn(supabase, todayISO()),
    countJobsThisMonth(supabase),
  ]);

  return {
    jobsCompleted: completed.length,
    jobsBooked: activity.filter((j) => j.status === "Booked").length,
    jobsCancelled: activity.filter((j) => j.status === "Cancelled").length,
    completedByCategory: tally(
      completed.map((j) => ({ key: j.service_category_id, value: 1 })),
      names,
    ),

    totalRevenue,
    totalProfit,
    avgProfitPerJob: completed.length ? totalProfit / completed.length : 0,
    revenueByCategory: tally(
      completed.map((j) => ({
        key: j.service_category_id,
        value: Number(j.total_invoice_paid ?? 0),
      })),
      names,
    ),

    leadsGenerated,
    conversionRate: leadsGenerated ? (completed.length / leadsGenerated) * 100 : 0,
    leadsBySource: tally(
      created.map((j) => ({ key: j.lead_source_id, value: 1 })),
      names,
    ),

    newPartnerships: inRangePartnerships.length,
    referralsProduced: created.filter((j) => j.partnership_id).length,
    // Running totals across the whole roster of partnerships, per spec.
    cardsDropped: partnerships.reduce((s, p) => s + (p.total_cards_dropped ?? 0), 0),
    fliersDropped: partnerships.reduce((s, p) => s + (p.total_fliers_dropped ?? 0), 0),
    partnershipsByTier: tally(
      partnerships.map((p) => ({ key: p.tier_id, value: 1 })),
      names,
    ),

    repeatCustomerRate: completed.length ? (repeatCount / completed.length) * 100 : 0,

    leadsToday,
    partnershipsToday,
    jobsThisMonth,
  };
}

async function fetchJobsInRange(
  supabase: SupabaseClient,
  range: DateRange,
): Promise<JobRow[]> {
  if (!range.start && !range.end) {
    return pageAll<JobRow>((from, to) =>
      supabase.from("jobs").select(JOB_COLUMNS).range(from, to),
    );
  }

  // A job is relevant if any of its three candidate dates lands in the range.
  const clauses: string[] = [];
  const bound = (col: string) =>
    [range.start ? `${col}.gte.${range.start}` : null, range.end ? `${col}.lte.${range.end}` : null]
      .filter(Boolean)
      .join(",");

  for (const col of ["date_of_invoice", "arrival_date"]) {
    clauses.push(`and(${bound(col)})`);
  }
  // created_at is a timestamp; widen the upper bound to cover the whole end day.
  const createdBound = [
    range.start ? `created_at.gte.${range.start}` : null,
    range.end ? `created_at.lt.${nextDay(range.end)}` : null,
  ]
    .filter(Boolean)
    .join(",");
  clauses.push(`and(${createdBound})`);

  return pageAll<JobRow>((from, to) =>
    supabase.from("jobs").select(JOB_COLUMNS).or(clauses.join(",")).range(from, to),
  );
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function fetchFinancials(
  supabase: SupabaseClient,
  jobIds: string[],
): Promise<Map<string, { profit: number; repeat_customer: boolean }>> {
  const map = new Map<string, { profit: number; repeat_customer: boolean }>();
  if (jobIds.length === 0) return map;

  for (let i = 0; i < jobIds.length; i += 500) {
    const chunk = jobIds.slice(i, i + 500);
    const { data } = await supabase
      .from("job_financials")
      .select("job_id, profit, repeat_customer")
      .in("job_id", chunk);
    for (const row of (data ?? []) as {
      job_id: string;
      profit: number;
      repeat_customer: boolean;
    }[]) {
      map.set(row.job_id, {
        profit: Number(row.profit ?? 0),
        repeat_customer: !!row.repeat_customer,
      });
    }
  }
  return map;
}

async function countJobsCreatedOn(supabase: SupabaseClient, day: string): Promise<number> {
  const { count } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", day)
    .lt("created_at", nextDay(day));
  return count ?? 0;
}

async function countPartnershipsAddedOn(
  supabase: SupabaseClient,
  day: string,
): Promise<number> {
  const { count } = await supabase
    .from("partnerships")
    .select("id", { count: "exact", head: true })
    .eq("date_added", day);
  return count ?? 0;
}

async function countJobsThisMonth(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", monthStartISO())
    .lt("created_at", nextDay(monthEndISO()));
  return count ?? 0;
}
