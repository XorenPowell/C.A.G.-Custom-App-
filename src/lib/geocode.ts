import { chicagoAddress } from "@/lib/maps";

/**
 * Address to coordinates, via the US Census Bureau geocoder.
 *
 * Free, no key, and no restriction on storing what it returns — which is
 * why partnerships are placed with this rather than with Google, whose
 * Maps Platform terms cap how long a geocode may be cached.
 *
 * Used for the one address that is not already in the database: the
 * start of a run, typed in on the Visits screen.
 */

const ENDPOINT = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

export type Point = { latitude: number; longitude: number };

export async function geocodeAddress(address: string): Promise<Point | null> {
  if (!address.trim()) return null;

  const qs = new URLSearchParams({
    address: chicagoAddress(address),
    benchmark: "Public_AR_Current",
    format: "json",
  });

  try {
    const res = await fetch(`${ENDPOINT}?${qs}`, {
      headers: { accept: "application/json" },
      // A run is sorted now and again, not on every page load, and the
      // same start address keeps its answer for an hour.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const match = body?.result?.addressMatches?.[0];
    if (!match?.coordinates) return null;
    // x is longitude and y is latitude. Swapping them puts every stop in
    // the Indian Ocean.
    return {
      latitude: Number(match.coordinates.y),
      longitude: Number(match.coordinates.x),
    };
  } catch {
    // A geocoder that is down must not take the Visits screen with it.
    return null;
  }
}

/** Straight-line km. Good enough to order a dozen stops in one neighbourhood. */
export function km(a: Point, b: Point): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude));
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * A walkable order for a day's stops: one pass out, not a zigzag.
 *
 * Nearest-neighbour alone is greedy and leaves stragglers — it takes the
 * closest stop every time, then doubles back across the neighbourhood to
 * collect what it skipped. The 2-opt pass afterwards is what fixes that:
 * wherever the path crosses itself, reversing the section between the
 * crossing shortens it, and a path with no crossings is one that heads
 * in broadly one direction.
 *
 * Both run instantly at this size and need no service, no key and no
 * network call — which matters more at 8am than optimality does.
 */
export function routeOrder<T extends Point>(start: Point, points: T[]): T[] {
  return twoOpt(start, nearestNeighbourOrder(start, points));
}

/**
 * Removes crossings by reversing the segment between them.
 *
 * An open path, not a loop: the run ends wherever the last stop is
 * rather than coming back to the start, so the final leg costs nothing
 * and the last stop is free to be the far end of the walk.
 */
function twoOpt<T extends Point>(start: Point, path: T[]): T[] {
  if (path.length < 4) return path;

  const legs = (p: T[]) => {
    let total = km(start, p[0]);
    for (let i = 0; i < p.length - 1; i++) total += km(p[i], p[i + 1]);
    return total;
  };

  const out = [...path];
  let best = legs(out);
  let improved = true;
  // Bounded so a pathological set cannot spin: at this size it settles
  // in two or three passes.
  let passes = 0;

  while (improved && passes < 20) {
    improved = false;
    passes++;
    for (let i = 0; i < out.length - 1; i++) {
      for (let k = i + 1; k < out.length; k++) {
        const candidate = [
          ...out.slice(0, i),
          ...out.slice(i, k + 1).reverse(),
          ...out.slice(k + 1),
        ];
        const length = legs(candidate);
        if (length < best - 1e-9) {
          out.splice(0, out.length, ...candidate);
          best = length;
          improved = true;
        }
      }
    }
  }
  return out;
}

/** Greedy first pass: always take the closest stop not yet visited. */
function nearestNeighbourOrder<T extends Point>(start: Point, points: T[]): T[] {
  const remaining = [...points];
  const walk: T[] = [];
  let from: Point = start;

  while (remaining.length > 0) {
    let best = 0;
    let bestKm = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = km(from, remaining[i]);
      if (d < bestKm) {
        bestKm = d;
        best = i;
      }
    }
    const next = remaining.splice(best, 1)[0];
    walk.push(next);
    from = next;
  }
  return walk;
}
