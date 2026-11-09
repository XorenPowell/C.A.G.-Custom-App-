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
  /**
   * The booked stops in walking order, when that differs from the order
   * they are booked in. Null means the day is already in a sensible
   * order, or too few stops are geocoded to say.
   */
  routedIds: string[] | null;
  /** Google Maps directions for the day, in its current order. */
  mapsHref: string | null;
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

export async function getVisitDays(): Promise<VisitDay[]> {
  const supabase = await createClient();
  const today = todayISO();

  const [plannedRes, placementRes, zoneRes] = await Promise.all([
    supabase
      .from("scheduled_actions")
      .select("id, partnership_id, due_at, note, kind")
      .eq("kind", "visit")
      .not("partnership_id", "is", null),
    supabase
      .from("campaign_placements")
      .select("id, partnership_id, placed_on, last_restock_on, restock_interval_days, cards_left")
      .is("removed_on", null),
    supabase.from("list_items").select("id, name").eq("kind", "zone"),
  ]);

  // A visits screen that quietly shows nothing because a query failed would
  // read as "no visits planned", which is the worst possible lie here.
  for (const [name, res] of [
    ["scheduled_actions", plannedRes],
    ["campaign_placements", placementRes],
  ] as const) {
    if (res.error) throw new Error(`Visits could not read ${name}: ${res.error.message}`);
  }

  const zoneName = new Map(
    ((zoneRes.data ?? []) as { id: string; name: string }[]).map((z) => [z.id, z.name]),
  );

  const planned = (plannedRes.data ?? []) as {
    id: string; partnership_id: string; due_at: string; note: string | null;
  }[];
  const placements = (placementRes.data ?? []) as {
    id: string; partnership_id: string; placed_on: string;
    last_restock_on: string | null; restock_interval_days: number; cards_left: number | null;
  }[];

  const ids = [
    ...new Set([...planned.map((p) => p.partnership_id), ...placements.map((p) => p.partnership_id)]),
  ];
  if (ids.length === 0) return [];

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

  return [...days.entries()]
    .map(([date, list]) => {
      list.sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
      const counts = new Map<string, number>();
      for (const s of list) counts.set(s.zone_name, (counts.get(s.zone_name) ?? 0) + 1);
      // Only booked stops can be re-sequenced: a restock has no row of its
      // own until it is given a time, so it keeps its place in the day.
      const booked = list.filter((s) => s.source === "scheduled");
      const routed = routeOrder(booked);
      const changed = routed.some((s, i) => s.id !== booked[i].id);

      return {
        date,
        stops: list,
        zones: [...counts.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
        overdue: date < today,
        routedIds: changed ? routed.map((s) => s.id) : null,
        mapsHref: mapsUrl(list),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
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

/* =====================================================================
 * Walking the day in the order the street is in
 * ===================================================================== */

/** Straight-line km between two points. Good enough to order a dozen stops. */
function km(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

type Placed = VisitStop & { latitude: number; longitude: number };

function isPlaced(s: VisitStop): s is Placed {
  return s.latitude != null && s.longitude != null;
}

/**
 * The day's stops, re-ordered into a sensible walk.
 *
 * Nearest-neighbour from the first stop. Not the optimal tour, but for the
 * three-to-twelve stops of one neighbourhood the difference is a street
 * corner, and it needs no service, no key and no network call — which
 * matters more at 8am than optimality does.
 *
 * Stops with no coordinates keep their place at the end rather than being
 * dropped: an ungeocoded business is still somewhere you have to go.
 */
export function routeOrder(stops: VisitStop[]): VisitStop[] {
  const placed = stops.filter(isPlaced);
  const unplaced = stops.filter((s) => !isPlaced(s));
  if (placed.length < 3) return stops;

  const remaining = placed.slice(1);
  const walk: Placed[] = [placed[0]];
  while (remaining.length > 0) {
    const from = walk[walk.length - 1];
    let best = 0;
    let bestKm = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = km(from, remaining[i]);
      if (d < bestKm) {
        bestKm = d;
        best = i;
      }
    }
    walk.push(remaining.splice(best, 1)[0]);
  }
  return [...walk, ...unplaced];
}

/** True when the route order differs from the order given. */
export function wouldReorder(stops: VisitStop[]): boolean {
  const routed = routeOrder(stops);
  return routed.some((s, i) => s.id !== stops[i].id);
}

/**
 * A Google Maps directions link for the day, in the order given.
 *
 * Addresses go in as text, so this needs no geocoding and no API key —
 * Maps resolves them itself. The URL form takes an origin, a destination
 * and up to nine waypoints between, which is more stops than a day holds.
 */
export function mapsUrl(stops: VisitStop[]): string | null {
  const points = stops.map((s) => s.address?.trim()).filter((a): a is string => !!a);
  if (points.length < 2) return null;

  const full = (a: string) => (/(IL|Illinois)/i.test(a) ? a : `${a}, Chicago, IL`);
  const params = new URLSearchParams({
    api: "1",
    origin: full(points[0]),
    destination: full(points[points.length - 1]),
    travelmode: "driving",
  });
  const between = points.slice(1, -1).slice(0, 9);
  if (between.length > 0) params.set("waypoints", between.map(full).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
