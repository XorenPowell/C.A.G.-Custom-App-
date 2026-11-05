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

/** The Chicago calendar date an instant falls on. */
function chicagoDayOf(instant: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

type FollowUpFields = Pick<Partnership, "follow_up_at">;

/**
 * When the next callback is due, as a Chicago calendar date.
 *
 * Reads `follow_up_at`, a real booked moment. This used to be derived from
 * last_contact plus an interval, which meant the due date silently moved
 * every time contact was logged, and no callback could be booked at all for
 * a partnership that had never been contacted.
 */
export function followUpDue(p: FollowUpFields): string | null {
  if (!p.follow_up_at) return null;
  return chicagoDayOf(p.follow_up_at);
}

export type FollowUpState = "overdue" | "today" | "upcoming" | "none";

export function followUpState(p: FollowUpFields, today = todayLocal()): FollowUpState {
  const due = followUpDue(p);
  if (!due) return "none";
  if (due < today) return "overdue";
  if (due === today) return "today";
  return "upcoming";
}

/** Whole days until the next callback; negative when overdue. */
export function daysUntilFollowUp(p: FollowUpFields, today = todayLocal()): number | null {
  const due = followUpDue(p);
  if (!due) return null;
  const ms =
    new Date(`${due}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export function followUpLabel(p: FollowUpFields, today = todayLocal()): string {
  const days = daysUntilFollowUp(p, today);
  if (days === null) return "—";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `in ${days}d`;
}

/** "9:00 AM" for the booked callback, or empty when none is set. */
export function followUpTime(p: FollowUpFields): string {
  if (!p.follow_up_at) return "";
  return new Date(p.follow_up_at).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Nothing scheduled at all — the quiet leak the redesign surfaces. */
export function hasNoNextAction(p: FollowUpFields): boolean {
  return !p.follow_up_at;
}
