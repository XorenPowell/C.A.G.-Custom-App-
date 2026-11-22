import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import { restockDue } from "@/lib/campaigns";

/**
 * Visits grouped into the days they will be walked.
 *
 * Zones are neighbourhood-sized here — Lakeview East, Uptown, Lincoln Park
 * West — so the zone of a day's visits is a good enough proxy for "can I
 * walk between these". Good enough that real routing would buy very little
 * for the cost of geocoding every address.
 */

export type VisitStop = {
  id: string;
  partnership_id: string;
  business_name: string;
  address: string | null;
  zone_id: string | null;
  zone_name: string;
  /** Null until scripts/geocode.mjs has placed the business. */
  latitude: number | null;
  longitude: number | null;
  /** UTC instant; null for a restock that has not been given a time yet. */
  due_at: string | null;
  note: string | null;
  /** A restock is a visit whose reason is the stack, not a booking. */
  source: "scheduled" | "restock";
  /** Position in the day's walking order. Null until the day is sorted. */
  sort_order: number | null;
  /** Only set for restocks: the placement that generated it. */
  placement_id?: string;
  cards_left?: number | null;
};

export type VisitDay = {
  /** YYYY-MM-DD in Chicago. */
  date: string;
  stops: VisitStop[];
  /** Zones represented, most-visited first. A day is usually one. */
  zones: { name: string; count: number }[];
  overdue: boolean;
  /** True once the day has been put in walking order. */
  sorted: boolean;
};

function chicagoDay(instant: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type VisitBook = {
  days: VisitDay[];
  /** Set when a source could not be read. The screen says so; it does not lie. */
  failure: string | null;
};

export async function getVisitDays(): Promise<VisitBook> {
  const supabase = await createClient();
  const today = todayISO();

  const [plannedRes, placementRes, zoneRes] = await Promise.all([
    supabase
      .from("scheduled_actions")
      .select("id, partnership_id, due_at, note, kind, sort_order")
      .eq("kind", "visit")
      .not("partnership_id", "is", null),
    supabase
      .from("campaign_placements")
      .select("id, partnership_id, placed_on, last_restock_on, restock_interval_days, cards_left")
      .is("removed_on", null),
    supabase.from("list_items").select("id, name").eq("kind", "zone"),
  ]);

  // A visits screen that quietly shows nothing because a query failed reads
  // as "no visits planned", which is the worst possible lie here. Throwing
  // is no better: it took Home down once, and here it rendered a blank page
  // that looked like an empty week. Reported and survivable, like the work
  // queue and the card ledger.
  const failures: string[] = [];
  for (const [name, res] of [
    ["scheduled_actions", plannedRes],
    ["campaign_placements", placementRes],
  ] as const) {
    if (res.error) failures.push(`${name}: ${res.error.message}`);
  }
  if (failures.length > 0) return { days: [], failure: failures.join(" · ") };

  const zoneName = new Map(
    ((zoneRes.data ?? []) as { id: string; name: string }[]).map((z) => [z.id, z.name]),
  );

  const planned = (plannedRes.data ?? []) as {
    id: string; partnership_id: string; due_at: string; note: string | null;
    sort_order: number | null;
  }[];
  const placements = (placementRes.data ?? []) as {
    id: string; partnership_id: string; placed_on: string;
    last_restock_on: string | null; restock_interval_days: number; cards_left: number | null;
  }[];

  const ids = [
    ...new Set([...planned.map((p) => p.partnership_id), ...placements.map((p) => p.partnership_id)]),
  ];
  if (ids.length === 0) return { days: [], failure: null };

  const { data: partnerships } = await supabase
    .from("partnerships")
    .select("id, business_name, address, zone_id, latitude, longitude")
    .in("id", ids);

  const byId = new Map(
    ((partnerships ?? []) as { id: string; business_name: string; address: string | null; zone_id: string | null; latitude: number | null; longitude: number | null }[])
      .map((p) => [p.id, p]),
  );

  const stops: VisitStop[] = [];

  for (const p of planned) {
    const biz = byId.get(p.partnership_id);
    if (!biz) continue;
    stops.push({
      id: p.id,
      partnership_id: p.partnership_id,
      business_name: biz.business_name,
      address: biz.address,
      zone_id: biz.zone_id,
      zone_name: biz.zone_id ? (zoneName.get(biz.zone_id) ?? "No zone") : "No zone",
      latitude: biz.latitude,
      longitude: biz.longitude,
      due_at: p.due_at,
      note: p.note,
      source: "scheduled",
      sort_order: p.sort_order,
    });
  }

  // Restocks join the run rather than living on their own screen: walking
  // past a business to restock it is the same trip as visiting it.
  const plannedPartnerships = new Set(planned.map((p) => p.partnership_id));
  for (const pl of placements) {
    const biz = byId.get(pl.partnership_id);
    if (!biz) continue;
    // Already has a booked visit — restocking happens on that trip.
    if (plannedPartnerships.has(pl.partnership_id)) continue;
    const due = restockDue({
      placed_on: pl.placed_on,
      last_restock_on: pl.last_restock_on,
      restock_interval_days: pl.restock_interval_days,
    } as Parameters<typeof restockDue>[0]);
    stops.push({
      id: `restock-${pl.id}`,
      partnership_id: pl.partnership_id,
      business_name: biz.business_name,
      address: biz.address,
      zone_id: biz.zone_id,
      zone_name: biz.zone_id ? (zoneName.get(biz.zone_id) ?? "No zone") : "No zone",
      latitude: biz.latitude,
      longitude: biz.longitude,
      due_at: `${due}T15:00:00.000Z`, // noon Chicago, a placeholder until timed
      note: pl.cards_left != null ? `Restock — about ${pl.cards_left} left` : "Restock",
      source: "restock",
      sort_order: null,
      placement_id: pl.id,
      cards_left: pl.cards_left,
    });
  }

  const days = new Map<string, VisitStop[]>();
  for (const s of stops) {
    const day = s.due_at ? chicagoDay(s.due_at) : today;
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push(s);
  }

  const built = [...days.entries()]
    .map(([date, list]) => {
      // The walking order wins where it has been set. A run is booked by
      // dropping a dozen visits on a date and they all land at 9:00, so
      // due_at orders nothing on its own; it is the tie-break for the
      // stops that genuinely have an appointment. Unsorted stops fall to
      // the end, so adding one to an ordered day does not drop it into
      // the middle of a walk.
      list.sort(
        (a, b) =>
          (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER) ||
          (a.due_at ?? "").localeCompare(b.due_at ?? "") ||
          a.business_name.localeCompare(b.business_name),
      );
      const counts = new Map<string, number>();
      for (const s of list) counts.set(s.zone_name, (counts.get(s.zone_name) ?? 0) + 1);
      return {
        date,
        stops: list,
        zones: [...counts.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
        overdue: date < today,
        sorted: list.some((s) => s.sort_order != null),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return { days: built, failure: null };
}

/**
 * The next day that already has visits in this zone.
 *
 * Booking a visit is really choosing which existing run it joins, so the
 * date that matters is "when am I next in that neighbourhood" rather than
 * a number of days from now.
 */
export function nextDayInZone(days: VisitDay[], zoneName: string, from: string): string | null {
  const match = days.find(
    (d) => d.date >= from && d.zones.some((z) => z.name === zoneName),
  );
  return match?.date ?? null;
}
