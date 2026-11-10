"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, orNull, toInt, type ActionResult } from "@/lib/persist";

export type ReceiptPayload = {
  received_on: string;
  quantity: number | string;
  source: string | null;
  note: string | null;
};

/** A batch of cards collected from the printer. The ledger's income side. */
export async function addCardReceipt(payload: ReceiptPayload): Promise<ActionResult> {
  const quantity = toInt(payload.quantity);
  if (quantity === 0) return fail("How many cards?");
  if (!payload.received_on) return fail("Pick the date they were collected.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_receipts")
    .insert({
      received_on: payload.received_on,
      quantity,
      kind: "receipt",
      source: orNull(payload.source),
      note: orNull(payload.note),
    })
    .select("id")
    .single();

  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return ok((data as { id: string }).id);
}

export async function deleteCardReceipt(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("card_receipts").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return ok();
}

export type CountPayload = {
  counted_on: string;
  /** The number actually in hand. */
  total: number | string;
  /** What the ledger believed at the moment of counting. */
  expected: number;
  note: string | null;
};

/**
 * A stock count.
 *
 * The balance is derived from collections minus drops, and both sides
 * are only as complete as what got logged. Counting what is actually
 * there is the one measurement that is never an estimate, so it wins —
 * but it is recorded as a correction rather than a replacement, so the
 * history stays intact and the size of the gap stays visible.
 *
 * The correction is computed here, against the figure the screen was
 * showing when the number was typed, so the two cannot disagree.
 */
export async function recordCardCount(payload: CountPayload): Promise<ActionResult> {
  const total = toInt(payload.total, -1);
  if (total < 0) return fail("How many cards are there?");
  if (!payload.counted_on) return fail("Pick the date they were counted.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_receipts")
    .insert({
      received_on: payload.counted_on,
      quantity: total - payload.expected,
      kind: "count",
      counted_total: total,
      source: null,
      note: orNull(payload.note),
    })
    .select("id")
    .single();

  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return ok((data as { id: string }).id);
}
