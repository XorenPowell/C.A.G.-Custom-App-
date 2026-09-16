import { createClient } from "@/lib/supabase/server";
import { getJobEntityNames } from "@/lib/jobs";
import { todayISO } from "@/lib/dates";

/**
 * Home screen data (spec: new home screen + theme system).
 *
 * Booked Today is deliberately independent of the range selector — it always
 * shows today's booked jobs, the same way the Dashboard's Goals panel used to
 * always read "today" regardless of the range. Everything here is computed on
 * read, nothing is stored.
 */

export type BookedTodayTicket = {
  id: string;
  job_id: string;
  arrival_time: string | null;
  service_category_id: string | null;
  address: string | null;
  entityNames: string[];
};

export async function getBookedToday(): Promise<BookedTodayTicket[]> {
  const supabase = await createClient();
  const today = todayISO();

  const { data, error } = await supabase
    .from("jobs")
    .select("id, job_id, arrival_time, service_category_id, addresses")
    .eq("status", "Booked")
    .eq("arrival_date", today)
    .order("arrival_time", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    id: string;
    job_id: string;
    arrival_time: string | null;
    service_category_id: string | null;
    addresses: string[];
  }[];
  if (rows.length === 0) return [];

  const entityNames = await getJobEntityNames(rows.map((r) => r.id));

  return rows.map((r) => ({
    id: r.id,
    job_id: r.job_id,
    arrival_time: r.arrival_time,
    service_category_id: r.service_category_id,
    address: r.addresses?.[0] ?? null,
    entityNames: entityNames.get(r.id) ?? [],
  }));
}
