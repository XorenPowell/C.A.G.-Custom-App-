"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, orNull, type ActionResult } from "@/lib/persist";

export type ContactPayload = {
  id: string | null;
  partnership_id: string | null;
  name: string;
  role_id: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source: string | null;
  email_opt_out: boolean;
};

export async function saveContact(payload: ContactPayload): Promise<ActionResult> {
  const supabase = await createClient();

  const name = (payload.name ?? "").trim();
  if (!name) return fail("A contact needs a name.");

  // A contact with no phone and no email cannot be acted on, so it is not a
  // contact — the name belongs in the partnership's notes instead.
  if (!orNull(payload.email) && !orNull(payload.phone)) {
    return fail("A contact needs a phone number or an email address.");
  }

  const row = {
    partnership_id: payload.partnership_id || null,
    name,
    role_id: payload.role_id || null,
    title: orNull(payload.title),
    email: orNull(payload.email),
    phone: orNull(payload.phone),
    notes: orNull(payload.notes),
    source: orNull(payload.source) ?? "Entered manually",
    email_opt_out: !!payload.email_opt_out,
  };

  const res = payload.id
    ? await supabase.from("contacts").update(row).eq("id", payload.id).select("id").single()
    : await supabase.from("contacts").insert(row).select("id").single();

  if (res.error) return fail(res.error.message);

  revalidatePath("/contacts");
  revalidatePath("/partnerships", "layout");
  return ok((res.data as { id: string }).id);
}

export async function deleteContact(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/contacts");
  revalidatePath("/partnerships", "layout");
  return ok();
}

/**
 * Records that a batch of contacts was emailed.
 *
 * The app composes and hands off to the device's mail client, exactly like
 * the sms:/tel: actions elsewhere — nothing is sent from a server here, so
 * there is no sending reputation or unsubscribe obligation on this app.
 */
export async function markEmailed(ids: string[]): Promise<ActionResult> {
  if (ids.length === 0) return ok();
  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ last_emailed_at: new Date().toISOString() })
    .in("id", ids);
  if (error) return fail(error.message);
  revalidatePath("/contacts");
  return ok();
}

export async function setOptOut(id: string, optOut: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ email_opt_out: optOut })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/contacts");
  revalidatePath("/partnerships", "layout");
  return ok();
}
