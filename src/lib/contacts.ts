import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/lib/types";

export type ContactWithPartnership = Contact & {
  partnership_name: string | null;
  zone_id: string | null;
};

export async function getContacts(): Promise<ContactWithPartnership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*, partnerships(business_name, zone_id)")
    .order("name");
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const { partnerships, ...rest } = row as Contact & {
      partnerships: { business_name: string; zone_id: string | null } | null;
    };
    return {
      ...rest,
      partnership_name: partnerships?.business_name ?? null,
      zone_id: partnerships?.zone_id ?? null,
    };
  });
}

export async function getContactsFor(partnershipId: string): Promise<Contact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("partnership_id", partnershipId)
    .order("created_at");
  if (error) throw new Error(`Could not read contacts: ${error.message}`);
  return (data ?? []) as Contact[];
}

export type ContactFilters = {
  q?: string;
  role?: string;
  zone?: string;
  partnership?: string;
  source?: string;
  /** "email" = has an email, "phone" = phone but no email. */
  reach?: string;
  sort?: string;
};

export const CONTACT_SORTS = [
  { value: "name", label: "Name" },
  { value: "partnership", label: "Business" },
  { value: "recent", label: "Recently added" },
  { value: "emailed", label: "Last emailed" },
] as const;

export function filterContacts(
  rows: ContactWithPartnership[],
  f: ContactFilters,
): ContactWithPartnership[] {
  const needle = (f.q ?? "").trim().toLowerCase();

  const out = rows.filter((c) => {
    if (f.role && c.role_id !== f.role) return false;
    if (f.zone && c.zone_id !== f.zone) return false;
    if (f.partnership && c.partnership_id !== f.partnership) return false;
    if (f.source && (c.source ?? "") !== f.source) return false;
    if (f.reach === "email" && !c.email) return false;
    if (f.reach === "phone" && (c.email || !c.phone)) return false;
    if (needle) {
      const hay = [c.name, c.email, c.phone, c.partnership_name, c.title, c.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const byName = (a: ContactWithPartnership, b: ContactWithPartnership) =>
    a.name.localeCompare(b.name);

  switch (f.sort) {
    case "partnership":
      return out.sort(
        (a, b) => (a.partnership_name ?? "").localeCompare(b.partnership_name ?? "") || byName(a, b),
      );
    case "recent":
      return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "emailed":
      // Never emailed sorts first: those are the ones still to reach.
      return out.sort(
        (a, b) => (a.last_emailed_at ?? "").localeCompare(b.last_emailed_at ?? "") || byName(a, b),
      );
    default:
      return out.sort(byName);
  }
}
