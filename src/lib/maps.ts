/**
 * Google Maps directions links for a day's run.
 *
 * Pure, and takes addresses as text, so it needs no geocoding, no API
 * key and no network call of our own — Maps resolves the addresses
 * itself when the link opens.
 */

/** The book stores street addresses with no city; every one is in Chicago. */
export function chicagoAddress(a: string): string {
  const trimmed = a.trim().replace(/\s+/g, " ");
  if (/\b(IL|Illinois)\b/i.test(trimmed)) return trimmed;
  if (/chicago/i.test(trimmed)) return `${trimmed}, IL`;
  return `${trimmed}, Chicago, IL`;
}

/**
 * Maps takes an origin, a destination and at most nine stops between —
 * ten points to a link. A fourteen-stop day does not fit in one.
 */
const POINTS_PER_LINK = 10;

export type MapsLeg = {
  href: string;
  /** 1-based stop numbers this link covers, for its label. */
  from: number;
  to: number;
};

/**
 * The run as directions, split into as many links as it takes.
 *
 * A long day is handed over as consecutive legs rather than truncated,
 * and each leg starts where the previous one ended so nothing falls
 * between them. Walking, because a day is one neighbourhood and that is
 * how it gets covered.
 */
export function mapsLegs(
  start: string | null,
  stopAddresses: (string | null | undefined)[],
): MapsLeg[] {
  const stops = stopAddresses
    .map((a) => a?.trim())
    .filter((a): a is string => !!a)
    .map(chicagoAddress);
  if (stops.length === 0) return [];

  const origin = start?.trim() ? chicagoAddress(start) : null;
  // With no start address the first stop is the origin, which is what
  // "drive to the first one, then walk" looks like.
  const points = origin ? [origin, ...stops] : stops;
  if (points.length < 2) return [];

  const legs: MapsLeg[] = [];
  let cursor = 0;

  while (cursor < points.length - 1) {
    const slice = points.slice(cursor, cursor + POINTS_PER_LINK);
    const params = new URLSearchParams({
      api: "1",
      origin: slice[0],
      destination: slice[slice.length - 1],
      travelmode: "walking",
    });
    const between = slice.slice(1, -1);
    if (between.length > 0) params.set("waypoints", between.join("|"));

    // Stop numbers as the list shows them, so a label matches the rows on
    // screen rather than counting the start address as a stop.
    const stopNumber = (pointIndex: number) => (origin ? pointIndex : pointIndex + 1);
    legs.push({
      href: `https://www.google.com/maps/dir/?${params.toString()}`,
      from: Math.max(1, stopNumber(cursor)),
      to: stopNumber(cursor + slice.length - 1),
    });

    // The next leg restarts at this one's destination, so no gap opens up.
    cursor += POINTS_PER_LINK - 1;
  }

  return legs;
}
