"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  fail,
  ok,
  orNull,
  replaceChildren,
  toInt,
  toNum,
  type ActionResult,
} from "@/lib/persist";
import type { EntityStatus } from "@/lib/types";

export type EntityPayload = {
  id: string | null;
  entity_name: string;
  roster_size: number;
  worker_names: string[];
  poc_name: string | null;
  poc_phone: string | null;
  status: EntityStatus;
  zone_id: string | null;
  vehicle_type_ids: string[];
  ic_agreement_link: string | null;
  photo_id_link: string | null;
  equipment_photos_link: string | null;
  reliability_notes: string | null;
  notes: string | null;
  references: {
    reference_name: string | null;
    reference_phone: string | null;
    service_category_id: string | null;
    verified: boolean;
  }[];
  rates: {
    service_category_id: string;
    regular_rate: number;
    travel_rate: number;
    other_rate: number;
  }[];
  fees: { fee_name: string | null; description: string | null; amount: number }[];
  equipment: { item_name: string | null; quantity: number; notes: string | null }[];
};

/**
 * Creates or updates an entity and its repeating rows.
 * Deliberately does not touch `entity_availability` — that has its own action,
 * so saving a profile never resets the staleness clock.
 */
export async function saveEntity(payload: EntityPayload): Promise<ActionResult> {
  const supabase = await createClient();

  if (!payload.entity_name.trim()) return fail("Entity name is required.");

  const rateCategories = payload.rates.map((r) => r.service_category_id);
  if (rateCategories.some((c) => !c)) return fail("Every rate row needs a service category.");
  if (new Set(rateCategories).size !== rateCategories.length)
    return fail("Only one rate row per service category.");

  const row = {
    entity_name: payload.entity_name.trim(),
    roster_size: Math.max(1, toInt(payload.roster_size, 1)),
    worker_names: payload.worker_names.map((w) => w.trim()).filter(Boolean),
    poc_name: orNull(payload.poc_name),
    poc_phone: orNull(payload.poc_phone),
    status: payload.status,
    zone_id: payload.zone_id || null,
    vehicle_type_ids: payload.vehicle_type_ids,
    ic_agreement_link: orNull(payload.ic_agreement_link),
    photo_id_link: orNull(payload.photo_id_link),
    equipment_photos_link: orNull(payload.equipment_photos_link),
    reliability_notes: orNull(payload.reliability_notes),
    notes: orNull(payload.notes),
  };

  let entityId = payload.id;

  if (entityId) {
    const { error } = await supabase.from("entities").update(row).eq("id", entityId);
    if (error) return fail(error.message);
  } else {
    const { data, error } = await supabase
      .from("entities")
      .insert(row)
      .select("id")
      .single();
    if (error) return fail(error.message);
    entityId = data.id as string;
  }

  const errors = [
    await replaceChildren(
      supabase,
      "entity_references",
      "entity_id",
      entityId,
      payload.references.map((r) => ({
        reference_name: orNull(r.reference_name),
        reference_phone: orNull(r.reference_phone),
        service_category_id: r.service_category_id || null,
        verified: !!r.verified,
      })),
    ),
    await replaceChildren(
      supabase,
      "entity_fees",
      "entity_id",
      entityId,
      payload.fees.map((f) => ({
        fee_name: orNull(f.fee_name),
        description: orNull(f.description),
        amount: toNum(f.amount),
      })),
    ),
    await replaceChildren(
      supabase,
      "entity_equipment",
      "entity_id",
      entityId,
      payload.equipment.map((e) => ({
        item_name: orNull(e.item_name),
        quantity: toInt(e.quantity, 1),
        notes: orNull(e.notes),
      })),
    ),
  ].filter(Boolean);

  if (errors.length) return fail(errors[0]!);

  // entity_rates has no sort_order column, so it is written directly.
  const delRates = await supabase.from("entity_rates").delete().eq("entity_id", entityId);
  if (delRates.error) return fail(delRates.error.message);

  if (payload.rates.length) {
    const { error } = await supabase.from("entity_rates").insert(
      payload.rates.map((r) => ({
        entity_id: entityId,
        service_category_id: r.service_category_id,
        regular_rate: toNum(r.regular_rate),
        travel_rate: toNum(r.travel_rate),
        other_rate: toNum(r.other_rate),
      })),
    );
    if (error) return fail(error.message);
  }

  revalidatePath("/roster", "layout");
  return ok(entityId);
}

export async function deleteEntity(id: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("job_workers")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", id);

  if (count) {
    return fail(
      `This entity is on ${count} job${count === 1 ? "" : "s"}. Set them Inactive instead — deleting would strip them from that job history.`,
    );
  }

  const { error } = await supabase.from("entities").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/roster", "layout");
  return ok();
}

export type AvailabilityBlock = {
  date: string;
  start_time: string | null;
  end_time: string | null;
};

/**
 * Availability has its own save path so the >6-day staleness flag means what it
 * says: the timestamp moves only when availability itself is touched.
 */
export async function saveAvailability(
  entityId: string,
  blocks: AvailabilityBlock[],
  note: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();

  const clean = blocks.filter((b) => b.date);

  const del = await supabase.from("entity_availability").delete().eq("entity_id", entityId);
  if (del.error) return fail(del.error.message);

  if (clean.length) {
    const { error } = await supabase.from("entity_availability").insert(
      clean.map((b) => ({
        entity_id: entityId,
        date: b.date,
        start_time: b.start_time || null,
        end_time: b.end_time || null,
      })),
    );
    if (error) return fail(error.message);
  }

  // The trigger only fires on child rows, so clearing every block still needs
  // the parent stamped — and the note lives on the parent regardless.
  const { error } = await supabase
    .from("entities")
    .update({ availability_note: orNull(note), availability_updated_at: new Date().toISOString() })
    .eq("id", entityId);
  if (error) return fail(error.message);

  revalidatePath("/roster", "layout");
  return ok(entityId);
}
