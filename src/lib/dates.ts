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

/** The business is Chicago-based; "today" always means Chicago's calendar day. */
const TIME_ZONE = "America/Chicago";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Chicago's current wall-clock date, carried as a UTC-midnight Date so every
 * getter/setter below can consistently use the UTC variants and get the
 * right answer regardless of what timezone the server process itself runs
 * in (Vercel's Node runtime defaults to UTC, which is NOT Chicago — reading
 * a plain `new Date()` with local getters silently returns the wrong
 * calendar day for roughly five hours every evening).
 */
function chicagoNow(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

/** UTC getters throughout — `d` is always one of our UTC-midnight date-carriers. */
function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Chicago's calendar date for an arbitrary instant (a timestamptz value, etc). */
export function chicagoDateOf(instant: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(typeof instant === "string" ? new Date(instant) : instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function todayISO(): string {
  return iso(chicagoNow());
}

/** UTC instant -> "YYYY-MM-DDTHH:mm" in Chicago wall time, for a <input type="datetime-local"> value. */
export function chicagoDateTimeInputValue(instant: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

/** "YYYY-MM-DDTHH:mm" Chicago wall time -> UTC ISO instant. */
export function chicagoLocalToUTCISO(local: string): string {
  // Parsed as if it were already UTC — just a fixed reference point to
  // measure Chicago's offset from; corrected below.
  const naiveUTC = new Date(`${local}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(naiveUTC);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asIfUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );
  const offsetMs = asIfUTC - naiveUTC.getTime();
  return new Date(naiveUTC.getTime() - offsetMs).toISOString();
}

export type DateRange = { start: string | null; end: string | null };

/** `null` on either bound means unbounded (used by All Time). */
export function resolveRange(
  preset: RangePreset,
  customStart?: string | null,
  customEnd?: string | null,
): DateRange {
  const now = chicagoNow();

  switch (preset) {
    case "Today": {
      const today = iso(now);
      return { start: today, end: today };
    }
    case "This Week": {
      const dow = now.getUTCDay(); // 0 = Sunday
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() - (dow === 0 ? 6 : dow - 1));
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      return { start: iso(monday), end: iso(sunday) };
    }
    case "This Month":
      return {
        start: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))),
        end: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))),
      };
    case "Last Month":
      return {
        start: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))),
        end: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))),
      };
    case "All Time":
      return { start: null, end: null };
    case "Custom":
      return { start: customStart || null, end: customEnd || null };
  }
}

export function monthStartISO(): string {
  const d = chicagoNow();
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

export function monthEndISO(): string {
  const d = chicagoNow();
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
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
export function payPeriodRange(startDay: number, today = chicagoNow()): DateRange {
  const dow = today.getUTCDay();
  const diff = (dow - startDay + 7) % 7;
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - diff);
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
