import { createClient } from "@/lib/supabase/server";
import type { JobFinancials, Partnership } from "@/lib/types";

export async function getPartnerships(): Promise<Partnership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partnerships")
    .select("*")
    .order("business_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Partnership[];
}

export async function getPartnership(id: string): Promise<Partnership | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("partnerships").select("*").eq("id", id).single();
  return (data as Partnership) ?? null;
}

export type PartnershipFilters = {
  q?: string;
  status?: string;
  tier?: string;
  zone?: string;
};

export function filterPartnerships(
  rows: Partnership[],
  f: PartnershipFilters,
): Partnership[] {
  const needle = (f.q ?? "").trim().toLowerCase();
  return rows.filter((p) => {
    if (f.status && p.status_id !== f.status) return false;
    if (f.tier && p.tier_id !== f.tier) return false;
    if (f.zone && p.zone_id !== f.zone) return false;
    if (needle) {
      const hay = [p.business_name, p.poc_name, p.address, p.secondary_poc_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export type PartnershipReferral = {
  id: string;
  job_id: string;
  customer_name: string | null;
  status: string;
  date: string | null;
  total_invoice_paid: number;
};

/**
 * Jobs referred by a partnership, plus the revenue they produced.
 * Derived at query time — nothing is stored on the partnership row.
 */
export async function getPartnershipReferrals(
  partnershipId: string,
): Promise<PartnershipReferral[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("id, job_id, customer_name, status, date_of_invoice, arrival_date, created_at, total_invoice_paid")
    .eq("partnership_id", partnershipId);

  return ((data ?? []) as {
    id: string;
    job_id: string;
    customer_name: string | null;
    status: string;
    date_of_invoice: string | null;
    arrival_date: string | null;
    created_at: string;
    total_invoice_paid: number;
  }[])
    .map((j) => ({
      id: j.id,
      job_id: j.job_id,
      customer_name: j.customer_name,
      status: j.status,
      date: j.date_of_invoice ?? j.arrival_date ?? j.created_at.slice(0, 10),
      total_invoice_paid: Number(j.total_invoice_paid ?? 0),
    }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** Referral counts for every partnership at once, for the list screen. */
export async function getReferralCounts(): Promise<
  Map<string, { jobs: number; revenue: number }>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("partnership_id, total_invoice_paid")
    .not("partnership_id", "is", null);

  const map = new Map<string, { jobs: number; revenue: number }>();
  for (const row of (data ?? []) as {
    partnership_id: string;
    total_invoice_paid: number;
  }[]) {
    const cur = map.get(row.partnership_id) ?? { jobs: 0, revenue: 0 };
    cur.jobs += 1;
    cur.revenue += Number(row.total_invoice_paid ?? 0);
    map.set(row.partnership_id, cur);
  }
  return map;
}

export type { JobFinancials };
