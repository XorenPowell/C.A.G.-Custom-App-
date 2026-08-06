import { createClient } from "@/lib/supabase/server";
import { followUpDue, followUpState, isLead, todayLocal } from "@/lib/follow-up";
import type { JobFinancials, Partnership } from "@/lib/types";

export {
  daysUntilFollowUp,
  followUpDue,
  followUpLabel,
  followUpState,
  isLead,
  isSigned,
  type FollowUpState,
} from "@/lib/follow-up";

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
  /** "lead" = not yet signed, "signed" = a real partnership, "" = both. */
  pipeline?: string;
  /** "due" = overdue or due today, "overdue" = overdue only. */
  due?: string;
  sort?: string;
};

export const PARTNERSHIP_SORTS = [
  { value: "follow_up", label: "Follow-up due" },
  { value: "business_name", label: "Business name" },
  { value: "last_contact", label: "Last contact" },
  { value: "date_signed", label: "Date signed" },
  { value: "created_at", label: "Recently added" },
] as const;

export function filterPartnerships(
  rows: Partnership[],
  f: PartnershipFilters,
): Partnership[] {
  const needle = (f.q ?? "").trim().toLowerCase();
  const today = todayLocal();

  const filtered = rows.filter((p) => {
    if (f.pipeline === "lead" && !isLead(p)) return false;
    if (f.pipeline === "signed" && isLead(p)) return false;
    if (f.status && p.status_id !== f.status) return false;
    if (f.tier && p.tier_id !== f.tier) return false;
    if (f.zone && p.zone_id !== f.zone) return false;

    if (f.due) {
      const state = followUpState(p, today);
      if (f.due === "overdue" && state !== "overdue") return false;
      if (f.due === "due" && state !== "overdue" && state !== "today") return false;
    }

    if (needle) {
      const hay = [p.business_name, p.poc_name, p.address, p.secondary_poc_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  return sortPartnerships(filtered, f.sort);
}

function sortPartnerships(rows: Partnership[], sort?: string): Partnership[] {
  const out = [...rows];
  const byName = (a: Partnership, b: Partnership) =>
    a.business_name.localeCompare(b.business_name);

  switch (sort) {
    case "business_name":
      return out.sort(byName);
    case "last_contact":
      // Never contacted sorts last, not first.
      return out.sort(
        (a, b) => (b.last_contact ?? "").localeCompare(a.last_contact ?? "") || byName(a, b),
      );
    case "date_signed":
      return out.sort(
        (a, b) => (b.date_signed ?? "").localeCompare(a.date_signed ?? "") || byName(a, b),
      );
    case "created_at":
      return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "follow_up":
    default:
      // Most overdue first; rows with no follow-up set fall to the bottom.
      return out.sort((a, b) => {
        const da = followUpDue(a);
        const db = followUpDue(b);
        if (da && db) return da.localeCompare(db) || byName(a, b);
        if (da) return -1;
        if (db) return 1;
        return byName(a, b);
      });
  }
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
