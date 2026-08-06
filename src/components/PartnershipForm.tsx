"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import SaveBar from "@/components/SaveBar";
import { NumberInput, Section, Select, TextArea, TextInput } from "@/components/Form";
import { savePartnership, type PartnershipPayload } from "@/app/actions/partnerships";
import { optionsFor, type Lists } from "@/lib/lists";
import { followUpDue, followUpLabel, todayLocal } from "@/lib/follow-up";
import { dateLongDisplay } from "@/lib/format";
import type { Partnership } from "@/lib/types";

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default function PartnershipForm({
  partnership,
  lists,
}: {
  partnership: Partnership | null;
  lists: Lists;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatusMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    business_name: partnership?.business_name ?? "",
    address: partnership?.address ?? "",
    zone_id: partnership?.zone_id ?? "",
    status_id: partnership?.status_id ?? "",
    tier_id: partnership?.tier_id ?? "",
    poc_name: partnership?.poc_name ?? "",
    poc_phone: partnership?.poc_phone ?? "",
    poc_email: partnership?.poc_email ?? "",
    secondary_poc_name: partnership?.secondary_poc_name ?? "",
    secondary_poc_phone: partnership?.secondary_poc_phone ?? "",
    secondary_poc_email: partnership?.secondary_poc_email ?? "",
    last_visit: partnership?.last_visit ?? "",
    cards_dropped_last_visit: str(partnership?.cards_dropped_last_visit ?? 0),
    total_cards_dropped: str(partnership?.total_cards_dropped ?? 0),
    fliers_dropped_last_visit: str(partnership?.fliers_dropped_last_visit ?? 0),
    total_fliers_dropped: str(partnership?.total_fliers_dropped ?? 0),
    date_signed: partnership?.date_signed ?? "",
    last_contact: partnership?.last_contact ?? "",
    follow_up_days: str(partnership?.follow_up_days ?? ""),
    notes: partnership?.notes ?? "",
  });

  function patch(next: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...next }));
    setStatusMsg(null);
  }

  // date_signed is the only thing that separates a lead from a partnership.
  const isLeadNow = !form.date_signed;
  const followUpInput = {
    last_contact: form.last_contact || null,
    follow_up_days: form.follow_up_days === "" ? null : Number(form.follow_up_days),
  };
  const due = followUpDue(followUpInput);
  const dueLabel = followUpLabel(followUpInput);

  function save() {
    start(async () => {
      setError(null);
      const payload: PartnershipPayload = {
        id: partnership?.id ?? null,
        ...form,
      };
      const res = await savePartnership(payload);
      if (!res.ok) {
        setError(res.error ?? "Save failed.");
        return;
      }
      if (!partnership) router.push(`/partnerships/${res.id}`);
      else setStatusMsg("Saved.");
      router.refresh();
    });
  }

  return (
    <>
      <Section title="Business">
        <div className="grid-form">
          <TextInput
            label="Business name"
            value={form.business_name}
            onChange={(e) => patch({ business_name: e.target.value })}
          />
          <TextInput
            label="Address"
            value={form.address}
            onChange={(e) => patch({ address: e.target.value })}
          />
          <Select
            label="Zone"
            value={form.zone_id}
            onChange={(e) => patch({ zone_id: e.target.value })}
          >
            <option value="">— select —</option>
            {optionsFor(lists.zone, form.zone_id || null).map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Select>
          <Select
            label="Status"
            value={form.status_id}
            onChange={(e) => patch({ status_id: e.target.value })}
          >
            <option value="">— select —</option>
            {optionsFor(lists.partnership_status, form.status_id || null).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            label="Tier"
            value={form.tier_id}
            onChange={(e) => patch({ tier_id: e.target.value })}
          >
            <option value="">— select —</option>
            {optionsFor(lists.partnership_tier, form.tier_id || null).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </Section>

      <Section title="Pipeline">
        <div className="grid-form">
          <TextInput
            label="Date signed"
            type="date"
            value={form.date_signed}
            onChange={(e) => patch({ date_signed: e.target.value })}
            hint="Leave blank while this is still a lead."
          />
          <TextInput
            label="Last contact"
            type="date"
            value={form.last_contact}
            onChange={(e) => patch({ last_contact: e.target.value })}
            hint="Any outreach — call, email or visit."
          />
          <NumberInput
            label="Follow up in (days)"
            step="1"
            min={0}
            placeholder="e.g. 14"
            value={form.follow_up_days}
            onChange={(e) => patch({ follow_up_days: e.target.value })}
            hint="Counted from last contact."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => patch({ last_contact: todayLocal() })}
          >
            Contacted today
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => patch({ date_signed: todayLocal() })}
            disabled={!!form.date_signed}
          >
            Signed today
          </button>
        </div>

        <p
          className={`mt-3 border p-2 text-sm ${
            isLeadNow
              ? "border-[var(--color-line)] bg-[var(--color-sunken)]"
              : "border-[var(--color-good)] text-[var(--color-good)]"
          }`}
        >
          {isLeadNow ? (
            <>
              <strong>Lead.</strong> Visible in your list, but excluded from New
              Partnerships, the tier chart and every other figure until a signed date is
              set.
            </>
          ) : (
            <>
              <strong>Signed partnership.</strong> Counts toward New Partnerships for{" "}
              {dateLongDisplay(form.date_signed)} and appears in the tier breakdown.
            </>
          )}
        </p>

        {due && (
          <p className="muted mt-2 text-sm">
            Next follow-up: <strong>{dateLongDisplay(due)}</strong> ({dueLabel})
          </p>
        )}
        {!due && form.follow_up_days && !form.last_contact && (
          <p className="muted mt-2 text-sm">
            Set a last contact date and the follow-up date will calculate from it.
          </p>
        )}
      </Section>

      <Section title="Primary Contact">
        <div className="grid-form">
          <TextInput
            label="Name"
            value={form.poc_name}
            onChange={(e) => patch({ poc_name: e.target.value })}
          />
          <TextInput
            label="Phone"
            type="tel"
            inputMode="tel"
            value={form.poc_phone}
            onChange={(e) => patch({ poc_phone: e.target.value })}
          />
          <TextInput
            label="Email"
            type="email"
            value={form.poc_email}
            onChange={(e) => patch({ poc_email: e.target.value })}
          />
        </div>
      </Section>

      <Section title="Secondary Contact">
        <div className="grid-form">
          <TextInput
            label="Name"
            value={form.secondary_poc_name}
            onChange={(e) => patch({ secondary_poc_name: e.target.value })}
          />
          <TextInput
            label="Phone"
            type="tel"
            inputMode="tel"
            value={form.secondary_poc_phone}
            onChange={(e) => patch({ secondary_poc_phone: e.target.value })}
          />
          <TextInput
            label="Email"
            type="email"
            value={form.secondary_poc_email}
            onChange={(e) => patch({ secondary_poc_email: e.target.value })}
          />
        </div>
      </Section>

      <Section title="Visits & Collateral">
        <div className="grid-form">
          <TextInput
            label="Last visit"
            type="date"
            value={form.last_visit}
            onChange={(e) => patch({ last_visit: e.target.value })}
          />
          <NumberInput
            label="Cards dropped last visit"
            step="1"
            min={0}
            value={form.cards_dropped_last_visit}
            onChange={(e) => patch({ cards_dropped_last_visit: e.target.value })}
          />
          <NumberInput
            label="Total cards dropped"
            step="1"
            min={0}
            value={form.total_cards_dropped}
            onChange={(e) => patch({ total_cards_dropped: e.target.value })}
          />
          <NumberInput
            label="Fliers dropped last visit"
            step="1"
            min={0}
            value={form.fliers_dropped_last_visit}
            onChange={(e) => patch({ fliers_dropped_last_visit: e.target.value })}
          />
          <NumberInput
            label="Total fliers dropped"
            step="1"
            min={0}
            value={form.total_fliers_dropped}
            onChange={(e) => patch({ total_fliers_dropped: e.target.value })}
          />
        </div>
      </Section>

      <Section title="Notes">
        <TextArea value={form.notes} onChange={(e) => patch({ notes: e.target.value })} />
      </Section>

      <SaveBar onSave={save} pending={pending} status={status} error={error} />
    </>
  );
}
