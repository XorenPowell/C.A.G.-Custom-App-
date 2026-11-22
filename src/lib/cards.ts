import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import type { CardReceipt } from "@/lib/types";

/**
 * The card ledger.
 *
 * Cards used to exist as running totals on partnerships — how many had
 * been dropped, never when, and nothing at all about how many were left
 * in the boot. Here every drop is dated and every batch collected is
 * recorded, so "how many have I got" has an answer.
 *
 * Two sides to the outgoing half, because cards leave in two ways: left
 * at a business on a visit, and handed to someone on the street. Both
 * count against the same stock.
 */

export type CardDrop = {
  date: string;
  quantity: number;
  /** Where it went, for the ledger line. */
  label: string;
  source: "visit" | "face-to-face";
  /** Set for visits, so the line links back to the business. */
  partnership_id?: string;
};

export type CardLedger = {
  receipts: CardReceipt[];
  /** Stock counts, newest first. Each one corrected the balance on its date. */
  counts: CardReceipt[];
  drops: CardDrop[];
  received: number;
  dropped: number;
  /** The running total of every correction a count has made. */
  adjustment: number;
  /** What should still be in the boot. */
  remaining: number;
  /** The most recent count, for saying how long the figure has been trusted. */
  lastCount: CardReceipt | null;
  /** Cards a day, measured since the most recent batch was collected. */
  burnPerDay: number | null;
  /** Calendar date the stock runs out at the current rate. */
  runsOut: string | null;
  failure: string | null;
};

export async function getCardLedger(): Promise<CardLedger> {
  const supabase = await createClient();

  const [receiptRes, visitRes, f2fRes, partnershipRes] = await Promise.all([
    supabase.from("card_receipts").select("*").order("received_on", { ascending: false }),
    supabase
      .from("activity")
      .select("partnership_id, occurred_at, cards_dropped, outcome")
      .not("cards_dropped", "is", null)
      .gt("cards_dropped", 0),
    supabase
      .from("face_to_face_conversations")
      .select("occurred_at, cards_dropped")
      .gt("cards_dropped", 0),
    supabase.from("partnerships").select("id, business_name"),
  ]);

  // An empty ledger and a broken one look identical, and this one is
  // counting money's worth of stock. Say which it is.
  const failures: string[] = [];
  for (const [name, res] of [
    ["card_receipts", receiptRes],
    ["activity", visitRes],
    ["face_to_face_conversations", f2fRes],
  ] as const) {
    if (res.error) failures.push(`${name}: ${res.error.message}`);
  }
  if (failures.length > 0) {
    return {
      receipts: [], counts: [], drops: [], received: 0, dropped: 0,
      adjustment: 0, remaining: 0, lastCount: null,
      burnPerDay: null, runsOut: null, failure: failures.join(" · "),
    };
  }

  // One table, two kinds of line. Rows written before migration 032 have
  // no kind at all, and those are collections.
  const rows = (receiptRes.data ?? []) as CardReceipt[];
  const receipts = rows.filter((r) => r.kind !== "count");
  const counts = rows.filter((r) => r.kind === "count");
  const names = new Map(
    ((partnershipRes.data ?? []) as { id: string; business_name: string }[])
      .map((p) => [p.id, p.business_name]),
  );

  const drops: CardDrop[] = [];

  for (const v of (visitRes.data ?? []) as {
    partnership_id: string | null; occurred_at: string; cards_dropped: number; outcome: string | null;
  }[]) {
    drops.push({
      date: v.occurred_at.slice(0, 10),
      quantity: v.cards_dropped,
      label: v.partnership_id ? (names.get(v.partnership_id) ?? "Partnership") : "Visit",
      source: "visit",
      partnership_id: v.partnership_id ?? undefined,
    });
  }

  for (const c of (f2fRes.data ?? []) as { occurred_at: string; cards_dropped: number }[]) {
    drops.push({
      date: c.occurred_at.slice(0, 10),
      quantity: c.cards_dropped,
      label: "Face to face",
      source: "face-to-face",
    });
  }

  drops.sort((a, b) => b.date.localeCompare(a.date));

  const received = receipts.reduce((s, r) => s + r.quantity, 0);
  const dropped = drops.reduce((s, d) => s + d.quantity, 0);
  const adjustment = counts.reduce((s, c) => s + c.quantity, 0);

  // Measured from the most recent collection or count rather than over
  // all time: the rate that matters is the current one, and the seeded
  // history carries dates from a sheet that was not kept daily. A count
  // anchors it too, because it is the other moment the stock was known.
  const anchors = [receipts[0]?.received_on, counts[0]?.received_on].filter(
    (d): d is string => !!d,
  );
  const since = anchors.length > 0 ? anchors.sort().reverse()[0] : null;
  let burnPerDay: number | null = null;
  if (since) {
    const days = Math.max(
      1,
      Math.round(
        (new Date(`${todayISO()}T00:00:00Z`).getTime() -
          new Date(`${since}T00:00:00Z`).getTime()) / 86_400_000,
      ),
    );
    const out = drops
      .filter((d) => d.date >= since)
      .reduce((s, d) => s + d.quantity, 0);
    burnPerDay = out > 0 ? out / days : null;
  }

  // Collected, less what went out, plus every correction a count has
  // made. A drop logged after a count still subtracts, so the corrected
  // figure keeps counting down on its own.
  const remaining = received - dropped + adjustment;
  let runsOut: string | null = null;
  if (burnPerDay && burnPerDay > 0 && remaining > 0) {
    const d = new Date(`${todayISO()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + Math.floor(remaining / burnPerDay));
    runsOut = d.toISOString().slice(0, 10);
  }

  return {
    receipts,
    counts,
    drops,
    received,
    dropped,
    adjustment,
    remaining,
    lastCount: counts[0] ?? null,
    burnPerDay,
    runsOut,
    failure: null,
  };
}

/**
 * How fast a business's stack empties.
 *
 * Measured from what was actually found on the last visit rather than
 * assuming the stack ran dry: dropping 50 and finding 10 still there
 * means 40 went, not 50. Falls back to assuming an empty stack when
 * nothing was counted, which is the best available guess and the one
 * that was being made by hand anyway.
 */
export function pickUpRate(
  visits: { occurred_at: string; cards_dropped: number | null; cards_found: number | null }[],
): { perWeek: number; basis: "counted" | "assumed" } | null {
  const dated = visits
    .filter((v) => v.cards_dropped != null && v.cards_dropped > 0)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  if (dated.length < 2) return null;

  const previous = dated[dated.length - 2];
  const latest = dated[dated.length - 1];

  const days = Math.round(
    (new Date(latest.occurred_at).getTime() - new Date(previous.occurred_at).getTime()) /
      86_400_000,
  );
  if (days < 1) return null;

  const counted = latest.cards_found != null;
  const taken = (previous.cards_dropped ?? 0) - (counted ? (latest.cards_found ?? 0) : 0);
  if (taken <= 0) return { perWeek: 0, basis: counted ? "counted" : "assumed" };

  return {
    perWeek: Math.round(((taken / days) * 7) * 10) / 10,
    basis: counted ? "counted" : "assumed",
  };
}
