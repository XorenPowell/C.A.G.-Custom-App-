import { createClient } from "@/lib/supabase/server";
import type { EntityFull } from "@/lib/types";

const FULL_SELECT = `
  *,
  entity_references(*),
  entity_rates(*),
  entity_fees(*),
  entity_equipment(*),
  entity_availability(*)
`;

/**
 * The roster is small enough (tens to low hundreds) that pulling it whole and
 * filtering in memory is both simpler and faster than pushing cross-table text
 * search into SQL.
 */
export async function getEntitiesFull(): Promise<EntityFull[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entities")
    .select(FULL_SELECT)
    .order("entity_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EntityFull[];
}

export async function getEntity(id: string): Promise<EntityFull | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("entities").select(FULL_SELECT).eq("id", id).single();
  return (data as unknown as EntityFull) ?? null;
}

// Predicates live in entity-filters.ts so client components can share them.
export {
  canPerform,
  coversDate,
  filterEntities,
  rateFor,
  type EntityFilters,
} from "@/lib/entity-filters";

/** Derived entity totals — computed from jobs, never stored (spec 3.1). */
export type EntityStats = {
  jobsWorked: number;
  totalEarned: number;
  earnedThisMonth: number;
  lastJobDate: string | null;
};

export type EntityJobHistoryRow = {
  id: string;
  job_id: string;
  customer_name: string | null;
  status: string;
  service_category_id: string | null;
  date: string | null;
  pay: number;
};

export async function getEntityJobHistory(
  entityId: string,
): Promise<EntityJobHistoryRow[]> {
  const supabase = await createClient();

  const { data: workerRows } = await supabase
    .from("job_workers")
    .select("id, job_id, jobs(id, job_id, customer_name, status, service_category_id, date_of_invoice, arrival_date, created_at)")
    .eq("entity_id", entityId);

  const rows = (workerRows ?? []) as unknown as {
    id: string;
    job_id: string;
    jobs: {
      id: string;
      job_id: string;
      customer_name: string | null;
      status: string;
      service_category_id: string | null;
      date_of_invoice: string | null;
      arrival_date: string | null;
      created_at: string;
    } | null;
  }[];

  if (rows.length === 0) return [];

  const { data: payRows } = await supabase
    .from("job_worker_pay")
    .select("job_worker_id, effective_pay")
    .in("job_worker_id", rows.map((r) => r.id));

  const payById = new Map<string, number>(
    (payRows ?? []).map((p: { job_worker_id: string; effective_pay: number }) => [
      p.job_worker_id,
      Number(p.effective_pay ?? 0),
    ]),
  );

  return rows
    .filter((r) => r.jobs)
    .map((r) => ({
      id: r.jobs!.id,
      job_id: r.jobs!.job_id,
      customer_name: r.jobs!.customer_name,
      status: r.jobs!.status,
      service_category_id: r.jobs!.service_category_id,
      date:
        r.jobs!.date_of_invoice ??
        r.jobs!.arrival_date ??
        r.jobs!.created_at.slice(0, 10),
      pay: payById.get(r.id) ?? 0,
    }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export function entityStats(history: EntityJobHistoryRow[]): EntityStats {
  const completed = history.filter((h) => h.status === "Completed");
  const thisMonth = new Date().toISOString().slice(0, 7);

  return {
    jobsWorked: completed.length,
    totalEarned: completed.reduce((s, h) => s + h.pay, 0),
    earnedThisMonth: completed
      .filter((h) => (h.date ?? "").slice(0, 7) === thisMonth)
      .reduce((s, h) => s + h.pay, 0),
    lastJobDate: completed[0]?.date ?? null,
  };
}
