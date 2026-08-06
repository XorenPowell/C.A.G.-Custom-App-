import type { ListItem, ListKind } from "@/lib/types";

/**
 * Pure helpers for the Settings-driven dropdown lists.
 *
 * No server imports live here, so client components (the forms, the dispatch
 * picker) can share exactly the same option logic as the server pages.
 */

export type Lists = Record<ListKind, ListItem[]>;

export const EMPTY_LISTS: Lists = {
  service_category: [],
  lead_source: [],
  zone: [],
  vehicle_type: [],
  partnership_status: [],
  partnership_tier: [],
};

/** Options offered for new selections. Archived values stay resolvable. */
export function active(items: ListItem[]): ListItem[] {
  return items.filter((i) => !i.archived);
}

/**
 * Options for a select: the active list, plus the currently-selected value even
 * if archived, so editing an old record never silently drops its value.
 */
export function optionsFor(items: ListItem[], selectedId: string | null): ListItem[] {
  const out = active(items);
  if (selectedId && !out.some((i) => i.id === selectedId)) {
    const found = items.find((i) => i.id === selectedId);
    if (found) out.unshift(found);
  }
  return out;
}

/** Flat id -> name map across every list, for rendering FK columns. */
export function nameMap(lists: Lists): Map<string, string> {
  const m = new Map<string, string>();
  for (const kind of Object.keys(lists) as ListKind[]) {
    for (const item of lists[kind]) m.set(item.id, item.name);
  }
  return m;
}

export function lookup(map: Map<string, string>, id: string | null | undefined): string {
  return (id && map.get(id)) || "—";
}

/**
 * The lead source that reveals the partnership picker on a job.
 * Matched by name at read time so the row can be renamed without a code change.
 */
export const PARTNERSHIP_REFERRAL = "Partnership Referral";

export function partnershipReferralId(lists: Lists): string | null {
  return (
    lists.lead_source.find(
      (l) => l.name.trim().toLowerCase() === PARTNERSHIP_REFERRAL.toLowerCase(),
    )?.id ?? null
  );
}
