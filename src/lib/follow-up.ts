import type { Partnership } from "@/lib/types";

/**
 * Partnership pipeline helpers. Pure — no server imports — so the form, the
 * list and the dashboard all apply identical rules.
 *
 * `date_signed` is the single discriminator. Null means the row is still a
 * lead: visible in the list, invisible to every metric.
 */

export function isLead(p: Pick<Partnership, "date_signed">): boolean {
  return !p.date_signed;
}

export function isSigned(p: Pick<Partnership, "date_signed">): boolean {
  return !!p.date_signed;
}

/** Local YYYY-MM-DD. Never routed through UTC, which shifts the day. */
export function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
