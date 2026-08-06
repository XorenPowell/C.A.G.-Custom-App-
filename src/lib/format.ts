/** Display helpers. Nothing here touches the database. */

export function money(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function num(n: number | null | undefined, digits = 2): string {
  return Number(n ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function percent(n: number | null | undefined, digits = 1): string {
  return `${Number(n ?? 0).toFixed(digits)}%`;
}

/** Digits only, for tel:/sms: links and repeat-customer matching. */
export function phoneDigits(p: string | null | undefined): string {
  return (p ?? "").replace(/\D/g, "");
}

export function phoneDisplay(p: string | null | undefined): string {
  const d = phoneDigits(p);
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1"))
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return p ?? "";
}

/** `sms:`/`tel:` need an E.164-ish target; assume US when 10 digits. */
export function phoneLinkTarget(p: string | null | undefined): string {
  const d = phoneDigits(p);
  if (!d) return "";
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return d;
}

/** Renders a YYYY-MM-DD date string without dragging it through a timezone. */
export function dateDisplay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return `${m}/${d}/${String(y).slice(2)}`;
}

export function dateLongDisplay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "14:30:00" -> "2:30 PM" */
export function timeDisplay(t: string | null | undefined): string {
  if (!t) return "—";
  const [hStr, mStr] = t.split(":");
  let h = Number(hStr);
  const m = Number(mStr ?? 0);
  if (Number.isNaN(h)) return t;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function durationDisplay(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function entityType(rosterSize: number): "Individual" | "Crew" {
  return rosterSize === 1 ? "Individual" : "Crew";
}

/** Availability is stale after 6 days; the roster shows a red flag for it. */
export const STALE_AVAILABILITY_DAYS = 6;

export function isAvailabilityStale(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return true;
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  return ageMs > STALE_AVAILABILITY_DAYS * 24 * 60 * 60 * 1000;
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}
