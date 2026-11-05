import { createClient } from "@/lib/supabase/server";
import { getJobEntityNames } from "@/lib/jobs";
import { chicagoDateOf, todayISO } from "@/lib/dates";
import { isJobOpen } from "@/lib/types";

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

/* =====================================================================
 * Work queue
 *
 * Home used to know only about jobs, so partnership callbacks had nowhere to
 * surface and a 117-row partnership book had no "what do I do today" at all.
 * This merges both sides, plus the campaign restock run, into one queue.
 * ===================================================================== */

export type QueueItem = {
  id: string;
  href: string;
  kind: "partnership" | "job" | "restock";
  title: string;
  subtitle: string;
  /** Chicago calendar date the item is due. */
  dueOn: string;
  dueLabel: string;
  state: "overdue" | "today";
  phone: string | null;
  /** call | visit | text | email — only set on queued contacts. */
  followKind?: string;
};

function relLabel(due: string, today: string): string {
  const ms = new Date(`${due}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime();
  const days = Math.round(ms / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  return "today";
}

export type WorkQueue = {
  calls: QueueItem[];
  restocks: QueueItem[];
  noAction: QueueItem[];
};

/**
 * Every job is fetched, not just the open ones.
 *
 * A callback booked on a finished job is deliberate — asking for a review,
 * chasing a complaint — and filtering those out at the query meant such a
 * callback was accepted by the form and then never surfaced anywhere. Only
 * the "nothing scheduled" tab is restricted to open jobs, because a finished
 * job genuinely does not need a next step.
 */

export async function getWorkQueue(): Promise<WorkQueue> {
  const supabase = await createClient();
  const today = todayISO();

  const [partnershipsRes, jobsRes, placementsRes] = await Promise.all([
    supabase
      .from("partnerships")
      .select("id, business_name, follow_up_at, follow_up_note, follow_up_kind, poc_name, poc_phone, last_contact, status_id"),
    supabase
      .from("jobs")
      .select("id, job_id, customer_name, customer_phone, status, follow_up_at, follow_up_note, follow_up_kind"),
    supabase
      .from("campaign_placements")
      .select("id, partnership_id, location, cards_left, placed_on, last_restock_on, restock_interval_days, partnerships(business_name, poc_phone)")
      .is("removed_on", null),
  ]);

  // A failed query must never render as an empty queue. "No calls due" on a
  // book with 83 overdue partnerships is worse than an error page, because
  // nothing about it looks wrong.
  for (const [name, res] of [
    ["partnerships", partnershipsRes],
    ["jobs", jobsRes],
    ["campaign_placements", placementsRes],
  ] as const) {
    if (res.error) throw new Error(`Work queue could not read ${name}: ${res.error.message}`);
  }

  const partnerships = (partnershipsRes.data ?? []) as {
    id: string; business_name: string; follow_up_at: string | null;
    follow_up_note: string | null; follow_up_kind: string; poc_name: string | null;
    poc_phone: string | null; last_contact: string | null;
  }[];
  const jobs = (jobsRes.data ?? []) as {
    id: string; job_id: string; customer_name: string | null; customer_phone: string | null;
    status: string; follow_up_at: string | null; follow_up_note: string | null;
    follow_up_kind: string;
  }[];
  // The embedded join is typed as an array but is a single row, so it is
  // normalised here rather than asserted away at every use.
  const placements = ((placementsRes.data ?? []) as unknown as {
    id: string; partnership_id: string; location: string | null; cards_left: number | null;
    placed_on: string; last_restock_on: string | null; restock_interval_days: number;
    partnerships: { business_name: string; poc_phone: string | null }
      | { business_name: string; poc_phone: string | null }[]
      | null;
  }[]).map((r) => ({
    ...r,
    partnerships: Array.isArray(r.partnerships) ? (r.partnerships[0] ?? null) : r.partnerships,
  }));

  const calls: QueueItem[] = [];
  const noAction: QueueItem[] = [];

  for (const p of partnerships) {
    if (!p.follow_up_at) {
      noAction.push({
        id: p.id, href: `/partnerships/${p.id}`, kind: "partnership",
        title: p.business_name,
        subtitle: p.last_contact ? `last contact ${p.last_contact}` : "never contacted",
        dueOn: "", dueLabel: "nothing booked", state: "overdue", phone: p.poc_phone,
      });
      continue;
    }
    const due = chicagoDateOf(p.follow_up_at);
    if (due > today) continue;
    calls.push({
      id: p.id, href: `/partnerships/${p.id}`, kind: "partnership",
      title: p.business_name,
      subtitle: p.follow_up_note || p.poc_name || "Follow-up",
      dueOn: due, dueLabel: relLabel(due, today),
      state: due < today ? "overdue" : "today", phone: p.poc_phone,
      followKind: p.follow_up_kind,
    });
  }

  for (const j of jobs) {
    if (!j.follow_up_at) {
      // A finished job with nothing booked is correct, not a leak.
      if (!isJobOpen(j.status)) continue;
      noAction.push({
        id: j.id, href: `/jobs/${j.id}`, kind: "job",
        title: j.customer_name || j.job_id,
        subtitle: `${j.job_id} · ${j.status}`,
        dueOn: "", dueLabel: "nothing booked", state: "overdue", phone: j.customer_phone,
      });
      continue;
    }
    const due = chicagoDateOf(j.follow_up_at);
    if (due > today) continue;
    calls.push({
      id: j.id, href: `/jobs/${j.id}`, kind: "job",
      title: j.customer_name || j.job_id,
      subtitle: j.follow_up_note || `${j.job_id} · ${j.status}`,
      dueOn: due, dueLabel: relLabel(due, today),
      state: due < today ? "overdue" : "today", phone: j.customer_phone,
      followKind: j.follow_up_kind,
    });
  }

  const restocks: QueueItem[] = [];
  for (const pl of placements) {
    const base = pl.last_restock_on ?? pl.placed_on;
    const d = new Date(`${base}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + pl.restock_interval_days);
    const due = d.toISOString().slice(0, 10);
    if (due > today) continue;
    restocks.push({
      id: pl.id, href: `/partnerships/${pl.partnership_id}`, kind: "restock",
      title: pl.partnerships?.business_name ?? "—",
      subtitle: `${pl.location ?? "stack"}${pl.cards_left != null ? ` · ~${pl.cards_left} left` : ""}`,
      dueOn: due, dueLabel: relLabel(due, today),
      state: due < today ? "overdue" : "today",
      phone: pl.partnerships?.poc_phone ?? null,
    });
  }

  // Most overdue first — the queue is worked top to bottom.
  const byDue = (a: QueueItem, b: QueueItem) =>
    a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title);
  calls.sort(byDue);
  restocks.sort(byDue);
  noAction.sort((a, b) => a.title.localeCompare(b.title));

  return { calls, restocks, noAction };
}
