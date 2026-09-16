"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import SaveBar from "@/components/SaveBar";
import { Field, NumberInput, Section, Select, TextArea, TextInput } from "@/components/Form";
import { saveConversation, type ConversationPayload } from "@/app/actions/face-to-face";
import { optionsFor, type Lists } from "@/lib/lists";
import { INQUIRY_FOR_OPTIONS, type FaceToFaceConversation, type InquiryFor } from "@/lib/types";

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default function ConversationForm({
  conversation,
  lists,
}: {
  conversation: FaceToFaceConversation;
  lists: Lists;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatusMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    contact_name: conversation.contact_name ?? "",
    contact_phone: conversation.contact_phone ?? "",
    contact_email: conversation.contact_email ?? "",
    inquiry_for: (conversation.inquiry_for ?? "") as InquiryFor | "",
    service_category_id: conversation.service_category_id ?? "",
    zone_id: conversation.zone_id ?? "",
    cards_given: str(conversation.cards_given),
    intent_level: str(conversation.intent_level),
    notes: conversation.notes ?? "",
  });

  function patch(next: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...next }));
    setStatusMsg(null);
  }

  function save() {
    start(async () => {
      setError(null);
      setStatusMsg(null);

      const payload: ConversationPayload = {
        id: conversation.id,
        contact_name: form.contact_name,
        contact_phone: form.contact_phone,
        contact_email: form.contact_email,
        inquiry_for: form.inquiry_for || null,
        service_category_id: form.service_category_id || null,
        zone_id: form.zone_id || null,
        cards_given: form.cards_given,
        intent_level: form.intent_level,
        notes: form.notes,
      };

      const res = await saveConversation(payload);
      if (!res.ok) {
        setError(res.error ?? "Save failed.");
        return;
      }
      setStatusMsg("Saved.");
      router.refresh();
    });
  }

  return (
    <>
      <Section title="Contact">
        <div className="grid-form">
          <TextInput
            label="Name"
            value={form.contact_name}
            onChange={(e) => patch({ contact_name: e.target.value })}
          />
          <TextInput
            label="Phone"
            type="tel"
            inputMode="tel"
            value={form.contact_phone}
            onChange={(e) => patch({ contact_phone: e.target.value })}
          />
          <TextInput
            label="Email"
            type="email"
            value={form.contact_email}
            onChange={(e) => patch({ contact_email: e.target.value })}
          />
          <Select
            label="Inquiring for"
            value={form.inquiry_for}
            onChange={(e) => patch({ inquiry_for: e.target.value as InquiryFor | "" })}
          >
            <option value="">— select —</option>
            {INQUIRY_FOR_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </div>
      </Section>

      <Section title="Details">
        <div className="grid-form">
          <Select
            label="Service interest"
            value={form.service_category_id}
            onChange={(e) => patch({ service_category_id: e.target.value })}
          >
            <option value="">— select —</option>
            {optionsFor(lists.service_category, form.service_category_id || null).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
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
          <NumberInput
            label="Cards given"
            min={0}
            step="1"
            value={form.cards_given}
            onChange={(e) => patch({ cards_given: e.target.value })}
          />
        </div>

        <Field label={`Intent level — ${form.intent_level || 5}/10`}>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={form.intent_level || "5"}
            onChange={(e) => patch({ intent_level: e.target.value })}
            className="w-full accent-[var(--color-accent)]"
          />
        </Field>
      </Section>

      <Section title="Notes">
        <TextArea
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Anything else worth remembering about this conversation."
        />
      </Section>

      <SaveBar onSave={save} pending={pending} status={status} error={error} />
    </>
  );
}
