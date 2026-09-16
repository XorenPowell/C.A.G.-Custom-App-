import type { Partnership } from "@/lib/types";

/**
 * Partnership follow-up helpers. Pure — no server imports — so the form, the
 * list and the dashboard all apply identical rules.
 */

/**
 * Chicago's current calendar date, not the server process's. `Intl` is a
 * plain JS global (available in both the browser and Node), so this stays
 * import-free while still being correct when this runs server-side on a
 * host whose own clock isn't set to Chicago time (Vercel's Node runtime
 * defaults to UTC) — a `new Date()` read with local getters would silently
 * return the wrong calendar day for part of every evening.
 */
export function todayLocal(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * When the next touch is due. Computed from last contact plus the interval,
 * never stored — change either input and the due date follows.
 */
export function followUpDue(
  p: Pick<Partnership, "last_contact" | "follow_up_days">,
): string | null {
  if (!p.last_contact || p.follow_up_days == null) return null;
  return addDaysISO(p.last_contact, p.follow_up_days);
}

export type FollowUpState = "overdue" | "today" | "upcoming" | "none";

export function followUpState(
  p: Pick<Partnership, "last_contact" | "follow_up_days">,
  today = todayLocal(),
): FollowUpState {
  const due = followUpDue(p);
  if (!due) return "none";
  if (due < today) return "overdue";
  if (due === today) return "today";
  return "upcoming";
}

/** Whole days until the next touch; negative when overdue. */
export function daysUntilFollowUp(
  p: Pick<Partnership, "last_contact" | "follow_up_days">,
  today = todayLocal(),
): number | null {
  const due = followUpDue(p);
  if (!due) return null;
  const ms =
    new Date(`${due}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export function followUpLabel(
  p: Pick<Partnership, "last_contact" | "follow_up_days">,
  today = todayLocal(),
): string {
  const days = daysUntilFollowUp(p, today);
  if (days === null) {
    if (p.follow_up_days != null && !p.last_contact) return "awaiting first contact";
    return "—";
  }
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `in ${days}d`;
}
