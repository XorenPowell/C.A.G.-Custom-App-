/** Date-range helpers for the dashboard. All dates are YYYY-MM-DD strings. */

export const RANGE_PRESETS = [
  "Today",
  "This Week",
  "This Month",
  "Last Month",
  "All Time",
  "Custom",
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type DateRange = { start: string | null; end: string | null };

/** `null` on either bound means unbounded (used by All Time). */
export function resolveRange(
  preset: RangePreset,
  customStart?: string | null,
  customEnd?: string | null,
): DateRange {
  const now = new Date();

  switch (preset) {
    case "Today": {
      const today = iso(now);
      return { start: today, end: today };
    }
    case "This Week": {
      const dow = now.getDay(); // 0 = Sunday
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: iso(monday), end: iso(sunday) };
    }
    case "This Month":
      return {
        start: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    case "Last Month":
      return {
        start: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        end: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "All Time":
      return { start: null, end: null };
    case "Custom":
      return { start: customStart || null, end: customEnd || null };
  }
}

export function monthStartISO(): string {
  const d = new Date();
  return iso(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function monthEndISO(): string {
  const d = new Date();
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * The current pay period: the most recent occurrence of `startDay`
 * (0=Sunday..6=Saturday) on or before today, through today — inclusive on
 * both ends. If today itself is `startDay`, the period is just today.
 */
export function payPeriodRange(startDay: number, today = new Date()): DateRange {
  const dow = today.getDay();
  const diff = (dow - startDay + 7) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - diff);
  return { start: iso(start), end: iso(today) };
}

export function rangeLabel(r: DateRange): string {
  if (!r.start && !r.end) return "All time";
  if (r.start && r.end) return `${r.start} → ${r.end}`;
  if (r.start) return `since ${r.start}`;
  return `through ${r.end}`;
}

/** A job's effective date for range filtering (spec uses date_of_invoice). */
export function inRange(date: string | null, r: DateRange): boolean {
  if (!date) return !r.start && !r.end;
  const d = date.slice(0, 10);
  if (r.start && d < r.start) return false;
  if (r.end && d > r.end) return false;
  return true;
}
