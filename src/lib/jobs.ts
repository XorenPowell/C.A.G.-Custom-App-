import { createClient } from "@/lib/supabase/server";
import type { JobFinancials, JobFull } from "@/lib/types";

const FULL_SELECT = `*, job_workers(*, job_worker_fees(*))`;

export async function getJob(id: string): Promise<JobFull | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select(FULL_SELECT).eq("id", id).single();
  if (!data) return null;

  const job = data as unknown as JobFull;
  job.job_workers = (job.job_workers ?? []).sort((a, b) => a.sort_order - b.sort_order);
  for (const w of job.job_workers) {
    w.job_worker_fees = (w.job_worker_fees ?? []).sort((a, b) => a.sort_order - b.sort_order);
  }
  return job;
}

export async function getJobFinancials(jobIds: string[]): Promise<Map<string, JobFinancials>> {
  if (jobIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("job_financials").select("*").in("job_id", jobIds);
  return new Map((data ?? []).map((r) => [(r as JobFinancials).job_id, r as JobFinancials]));
}

export const SORT_FIELDS = [
  { value: "date_of_invoice", label: "Invoice date" },
  { value: "arrival_date", label: "Arrival date" },
  { value: "created_at", label: "Created" },
  { value: "job_id", label: "Job ID" },
  { value: "customer_name", label: "Customer" },
  { value: "status", label: "Status" },
  { value: "total_invoice_paid", label: "Invoice amount" },
] as const;

export type SortField = (typeof SORT_FIELDS)[number]["value"];

export type JobFilters = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  category?: string;
  source?: string;
  zone?: string;
  entity?: string;
  partnership?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

export const PAGE_SIZE = 100;

export type JobListRow = {
  id: string;
  job_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  service_category_id: string | null;
  lead_source_id: string | null;
  zone_id: string | null;
  partnership_id: string | null;
  date_of_invoice: string | null;
  arrival_date: string | null;
  arrival_time: string | null;
  total_invoice_paid: number;
  created_at: string;
};

export type JobListResult = {
  rows: JobListRow[];
  financials: Map<string, JobFinancials>;
  entityNames: Map<string, string[]>;
  total: number;
  page: number;
  pageCount: number;
};

/**
 * Filtering, sorting and paging all happen in SQL. Sort fields are limited to
 * real job columns so the ordering is correct across the whole result set, not
 * just the current page.
 */
export async function getJobList(f: JobFilters): Promise<JobListResult> {
  const supabase = await createClient();

  const sort: SortField = (SORT_FIELDS.find((s) => s.value === f.sort)?.value ??
    "date_of_invoice") as SortField;
  const ascending = f.dir === "asc";
  const page = Math.max(1, parseInt(f.page ?? "1", 10) || 1);

  let jobIdsForEntity: string[] | null = null;
  if (f.entity) {
    const { data } = await supabase
      .from("job_workers")
      .select("job_id")
      .eq("entity_id", f.entity);
    jobIdsForEntity = [...new Set((data ?? []).map((r) => r.job_id as string))];
    if (jobIdsForEntity.length === 0) {
      return {
        rows: [],
        financials: new Map(),
        entityNames: new Map(),
        total: 0,
        page: 1,
        pageCount: 1,
      };
    }
  }

  let query = supabase
    .from("jobs")
    .select(
      "id, job_id, customer_name, customer_phone, status, service_category_id, lead_source_id, zone_id, partnership_id, date_of_invoice, arrival_date, arrival_time, total_invoice_paid, created_at",
      { count: "exact" },
    );

  if (f.status) query = query.eq("status", f.status);
  if (f.category) query = query.eq("service_category_id", f.category);
  if (f.source) query = query.eq("lead_source_id", f.source);
  if (f.zone) query = query.eq("zone_id", f.zone);
  if (f.partnership) query = query.eq("partnership_id", f.partnership);
  if (f.from) query = query.gte("date_of_invoice", f.from);
  if (f.to) query = query.lte("date_of_invoice", f.to);
  if (jobIdsForEntity) query = query.in("id", jobIdsForEntity);

  if (f.q?.trim()) {
    const needle = f.q.trim().replace(/[%,()]/g, "");
    query = query.or(
      `customer_name.ilike.%${needle}%,customer_phone.ilike.%${needle}%,job_id.ilike.%${needle}%`,
    );
  }

  const start = (page - 1) * PAGE_SIZE;
  query = query
    .order(sort, { ascending, nullsFirst: false })
    .order("job_id", { ascending: false })
    .range(start, start + PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as JobListRow[];
  const ids = rows.map((r) => r.id);

  const [financials, entityNames] = await Promise.all([
    getJobFinancials(ids),
    getJobEntityNames(ids),
  ]);

  const total = count ?? rows.length;
  return {
    rows,
    financials,
    entityNames,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Assigned entity names per job, for the list view. */
export async function getJobEntityNames(jobIds: string[]): Promise<Map<string, string[]>> {
  if (jobIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_workers")
    .select("job_id, entities(entity_name)")
    .in("job_id", jobIds)
    .order("sort_order");

  const map = new Map<string, string[]>();
  for (const row of (data ?? []) as unknown as {
    job_id: string;
    entities: { entity_name: string } | null;
  }[]) {
    if (!row.entities) continue;
    const list = map.get(row.job_id) ?? [];
    list.push(row.entities.entity_name);
    map.set(row.job_id, list);
  }
  return map;
}

/** Repeat customer, resolved from the view for a single job. */
export async function getJobFinancialsOne(id: string): Promise<JobFinancials | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_financials")
    .select("*")
    .eq("job_id", id)
    .single();
  return (data as JobFinancials) ?? null;
}
