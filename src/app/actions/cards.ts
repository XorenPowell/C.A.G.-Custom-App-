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
