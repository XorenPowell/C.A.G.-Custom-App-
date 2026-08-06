"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import SaveBar from "@/components/SaveBar";
import {
  AddButton,
  Checkbox,
  Field,
  MoneyInput,
  NumberInput,
  RepeatRow,
  Section,
  Select,
  TextArea,
  TextInput,
} from "@/components/Form";
import EquipmentItemInput from "@/components/EquipmentItemInput";
import { saveEntity, type EntityPayload } from "@/app/actions/entities";
import { active, optionsFor, type Lists } from "@/lib/lists";
import { entityType } from "@/lib/format";
import {
  ENTITY_STATUSES,
  type EntityFull,
  type EntityStatus,
  type EquipmentPreset,
} from "@/lib/types";

type RefRow = EntityPayload["references"][number];
type RateRow = EntityPayload["rates"][number];
type FeeRow = EntityPayload["fees"][number];
type EquipRow = EntityPayload["equipment"][number];

export default function EntityForm({
  entity,
  lists,
  presets,
}: {
  entity: EntityFull | null;
  lists: Lists;
  presets: EquipmentPreset[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatusMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    entity_name: entity?.entity_name ?? "",
    roster_size: entity?.roster_size ?? 1,
    status: (entity?.status ?? "Active") as EntityStatus,
    poc_name: entity?.poc_name ?? "",
    poc_phone: entity?.poc_phone ?? "",
    zone_id: entity?.zone_id ?? "",
    ic_agreement_link: entity?.ic_agreement_link ?? "",
    photo_id_link: entity?.photo_id_link ?? "",
    equipment_photos_link: entity?.equipment_photos_link ?? "",
    reliability_notes: entity?.reliability_notes ?? "",
    notes: entity?.notes ?? "",
  });

  const [workerNames, setWorkerNames] = useState<string[]>(entity?.worker_names ?? []);
  const [vehicleIds, setVehicleIds] = useState<string[]>(entity?.vehicle_type_ids ?? []);

  const [refs, setRefs] = useState<RefRow[]>(
    (entity?.entity_references ?? []).map((r) => ({
      reference_name: r.reference_name,
      reference_phone: r.reference_phone,
      service_category_id: r.service_category_id,
      verified: r.verified,
    })),
  );
  const [rates, setRates] = useState<RateRow[]>(
    (entity?.entity_rates ?? []).map((r) => ({
      service_category_id: r.service_category_id,
      regular_rate: Number(r.regular_rate),
      travel_rate: Number(r.travel_rate),
      other_rate: Number(r.other_rate),
    })),
  );
  const [fees, setFees] = useState<FeeRow[]>(
    (entity?.entity_fees ?? []).map((f) => ({
      fee_name: f.fee_name,
      description: f.description,
      amount: Number(f.amount),
    })),
  );
  const [equipment, setEquipment] = useState<EquipRow[]>(
    (entity?.entity_equipment ?? []).map((e) => ({
      item_name: e.item_name,
      quantity: e.quantity,
      notes: e.notes,
    })),
  );

  function patch(next: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...next }));
    setStatusMsg(null);
  }

  const categories = active(lists.service_category);
  const vehicles = active(lists.vehicle_type);

  /** Every default note in the library, used to tell autofill from real writing. */
  const presetNotes = useMemo(
    () => new Set(presets.map((p) => p.default_note?.trim()).filter(Boolean) as string[]),
    [presets],
  );

  /**
   * Fills the note from the chosen preset, but only over a blank note or one
   * still holding a previous preset's untouched default. A note the dispatcher
   * actually wrote survives switching items.
   */
  function applyPreset(index: number, preset: EquipmentPreset) {
    setEquipment((prev) =>
      prev.map((row, j) => {
        if (j !== index) return row;
        const current = (row.notes ?? "").trim();
        const isAutofilled = current === "" || presetNotes.has(current);
        return {
          ...row,
          item_name: preset.item_name,
          notes: isAutofilled ? (preset.default_note ?? "") : row.notes,
        };
      }),
    );
    setStatusMsg(null);
  }

  function save() {
    start(async () => {
      setError(null);
      setStatusMsg(null);

      const payload: EntityPayload = {
        id: entity?.id ?? null,
        entity_name: form.entity_name,
        roster_size: Number(form.roster_size) || 1,
        worker_names: workerNames,
        poc_name: form.poc_name,
        poc_phone: form.poc_phone,
        status: form.status,
        zone_id: form.zone_id || null,
        vehicle_type_ids: vehicleIds,
        ic_agreement_link: form.ic_agreement_link,
        photo_id_link: form.photo_id_link,
        equipment_photos_link: form.equipment_photos_link,
        reliability_notes: form.reliability_notes,
        notes: form.notes,
        references: refs,
        rates,
        fees,
        equipment,
      };

      const res = await saveEntity(payload);
      if (!res.ok) {
        setError(res.error ?? "Save failed.");
        return;
      }
      router.push(`/roster/${res.id}`);
      router.refresh();
    });
  }

  return (
    <>
      <Section title="Identity">
        <div className="grid-form">
          <TextInput
            label="Entity name"
            value={form.entity_name}
            onChange={(e) => patch({ entity_name: e.target.value })}
            placeholder="e.g. Marcus T. or Southside Crew"
          />
          <NumberInput
            label="Roster size"
            min={1}
            step="1"
            value={form.roster_size}
            onChange={(e) => patch({ roster_size: Number(e.target.value) })}
            hint={`Type: ${entityType(Number(form.roster_size) || 1)} — derived from this number.`}
          />
          <TextInput
            label="POC name"
            value={form.poc_name}
            onChange={(e) => patch({ poc_name: e.target.value })}
          />
          <TextInput
            label="POC phone"
            type="tel"
            inputMode="tel"
            value={form.poc_phone}
            onChange={(e) => patch({ poc_phone: e.target.value })}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => patch({ status: e.target.value as EntityStatus })}
          >
            {ENTITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        <span className="label">Worker names</span>
        {workerNames.map((name, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <input
              className="input"
              value={name}
              placeholder={`Worker ${i + 1}`}
              onChange={(e) =>
                setWorkerNames((prev) => prev.map((w, j) => (j === i ? e.target.value : w)))
              }
            />
            <button
              type="button"
              className="btn btn-sm btn-danger shrink-0"
              onClick={() => setWorkerNames((prev) => prev.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        <AddButton onClick={() => setWorkerNames((p) => [...p, ""])}>Add worker name</AddButton>
      </Section>

      <Section title="Coverage">
        <Select
          label="Zone"
          value={form.zone_id}
          onChange={(e) => patch({ zone_id: e.target.value })}
        >
          <option value="">— none —</option>
          {optionsFor(lists.zone, form.zone_id || null).map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </Select>

        <span className="label">Vehicle types</span>
        {vehicles.length === 0 ? (
          <p className="muted text-sm">None defined — add some in Settings.</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {vehicles.map((v) => (
              <Checkbox
                key={v.id}
                label={v.name}
                checked={vehicleIds.includes(v.id)}
                onChange={(on) =>
                  setVehicleIds((prev) =>
                    on ? [...prev, v.id] : prev.filter((id) => id !== v.id),
                  )
                }
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="Rates">
        <p className="muted mb-2 text-xs">
          One row per service this entity can perform. No row means they will not appear
          in the dispatch picker for that service.
        </p>
        {rates.map((r, i) => (
          <RepeatRow
            key={i}
            title={`Rate ${i + 1}`}
            onRemove={() => setRates((prev) => prev.filter((_, j) => j !== i))}
          >
            <Select
              label="Service category"
              value={r.service_category_id}
              onChange={(e) =>
                setRates((prev) =>
                  prev.map((row, j) =>
                    j === i ? { ...row, service_category_id: e.target.value } : row,
                  ),
                )
              }
            >
              <option value="">— select —</option>
              {optionsFor(lists.service_category, r.service_category_id || null).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
              <MoneyInput
                label="Regular"
                value={r.regular_rate}
                onChange={(e) =>
                  setRates((prev) =>
                    prev.map((row, j) =>
                      j === i ? { ...row, regular_rate: Number(e.target.value) } : row,
                    ),
                  )
                }
              />
              <MoneyInput
                label="Travel"
                value={r.travel_rate}
                onChange={(e) =>
                  setRates((prev) =>
                    prev.map((row, j) =>
                      j === i ? { ...row, travel_rate: Number(e.target.value) } : row,
                    ),
                  )
                }
              />
              <MoneyInput
                label="Other"
                value={r.other_rate}
                onChange={(e) =>
                  setRates((prev) =>
                    prev.map((row, j) =>
                      j === i ? { ...row, other_rate: Number(e.target.value) } : row,
                    ),
                  )
                }
              />
            </div>
          </RepeatRow>
        ))}
        <AddButton
          onClick={() =>
            setRates((p) => [
              ...p,
              { service_category_id: "", regular_rate: 0, travel_rate: 0, other_rate: 0 },
            ])
          }
        >
          Add rate
        </AddButton>
        {categories.length === 0 && (
          <p className="muted mt-2 text-xs">No service categories defined yet.</p>
        )}
      </Section>

      <Section title="Standing Fees">
        <p className="muted mb-2 text-xs">Pre-loaded onto a job when this entity is dispatched.</p>
        {fees.map((f, i) => (
          <RepeatRow
            key={i}
            title={`Fee ${i + 1}`}
            onRemove={() => setFees((prev) => prev.filter((_, j) => j !== i))}
          >
            <div className="grid-form">
              <TextInput
                label="Fee name"
                value={f.fee_name ?? ""}
                onChange={(e) =>
                  setFees((prev) =>
                    prev.map((row, j) => (j === i ? { ...row, fee_name: e.target.value } : row)),
                  )
                }
              />
              <MoneyInput
                label="Amount"
                value={f.amount}
                onChange={(e) =>
                  setFees((prev) =>
                    prev.map((row, j) =>
                      j === i ? { ...row, amount: Number(e.target.value) } : row,
                    ),
                  )
                }
              />
            </div>
            <TextInput
              label="Description"
              value={f.description ?? ""}
              onChange={(e) =>
                setFees((prev) =>
                  prev.map((row, j) => (j === i ? { ...row, description: e.target.value } : row)),
                )
              }
            />
          </RepeatRow>
        ))}
        <AddButton
          onClick={() => setFees((p) => [...p, { fee_name: "", description: "", amount: 0 }])}
        >
          Add fee
        </AddButton>
      </Section>

      <Section title="Equipment">
        <p className="muted mb-2 text-xs">
          Searchable across the whole roster, on both the item name and its notes. Type
          to search the preset library — picking a bundle fills in what it contains.
        </p>
        {equipment.map((it, i) => (
          <RepeatRow
            key={i}
            title={`Item ${i + 1}`}
            onRemove={() => setEquipment((prev) => prev.filter((_, j) => j !== i))}
          >
            <div className="grid-form">
              <Field label="Item">
                <EquipmentItemInput
                  value={it.item_name ?? ""}
                  presets={presets}
                  onChange={(v) =>
                    setEquipment((prev) =>
                      prev.map((row, j) => (j === i ? { ...row, item_name: v } : row)),
                    )
                  }
                  onPickPreset={(preset) => applyPreset(i, preset)}
                />
              </Field>
              <NumberInput
                label="Quantity"
                min={0}
                step="1"
                value={it.quantity}
                onChange={(e) =>
                  setEquipment((prev) =>
                    prev.map((row, j) =>
                      j === i ? { ...row, quantity: Number(e.target.value) } : row,
                    ),
                  )
                }
              />
            </div>
            <TextArea
              label="Notes"
              className="mb-0"
              value={it.notes ?? ""}
              placeholder="Filled from the preset when you pick one — edit freely"
              onChange={(e) =>
                setEquipment((prev) =>
                  prev.map((row, j) => (j === i ? { ...row, notes: e.target.value } : row)),
                )
              }
            />
          </RepeatRow>
        ))}
        <AddButton
          onClick={() => setEquipment((p) => [...p, { item_name: "", quantity: 1, notes: "" }])}
        >
          Add item
        </AddButton>
        {presets.length === 0 && (
          <p className="muted mt-2 text-xs">
            No presets in the library yet — add them in Settings &rarr; Equipment Presets.
          </p>
        )}
      </Section>

      <Section title="References">
        <p className="muted mb-2 text-xs">Prior clients who hired this entity, for vetting.</p>
        {refs.map((r, i) => (
          <RepeatRow
            key={i}
            title={`Reference ${i + 1}`}
            onRemove={() => setRefs((prev) => prev.filter((_, j) => j !== i))}
          >
            <div className="grid-form">
              <TextInput
                label="Name"
                value={r.reference_name ?? ""}
                onChange={(e) =>
                  setRefs((prev) =>
                    prev.map((row, j) =>
                      j === i ? { ...row, reference_name: e.target.value } : row,
                    ),
                  )
                }
              />
              <TextInput
                label="Phone"
                type="tel"
                inputMode="tel"
                value={r.reference_phone ?? ""}
                onChange={(e) =>
                  setRefs((prev) =>
                    prev.map((row, j) =>
                      j === i ? { ...row, reference_phone: e.target.value } : row,
                    ),
                  )
                }
              />
            </div>
            <Select
              label="Service performed"
              value={r.service_category_id ?? ""}
              onChange={(e) =>
                setRefs((prev) =>
                  prev.map((row, j) =>
                    j === i ? { ...row, service_category_id: e.target.value } : row,
                  ),
                )
              }
            >
              <option value="">— select —</option>
              {optionsFor(lists.service_category, r.service_category_id).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Checkbox
              label="Verified"
              checked={r.verified}
              onChange={(on) =>
                setRefs((prev) =>
                  prev.map((row, j) => (j === i ? { ...row, verified: on } : row)),
                )
              }
            />
          </RepeatRow>
        ))}
        <AddButton
          onClick={() =>
            setRefs((p) => [
              ...p,
              {
                reference_name: "",
                reference_phone: "",
                service_category_id: "",
                verified: false,
              },
            ])
          }
        >
          Add reference
        </AddButton>
      </Section>

      <Section title="Documents">
        <TextInput
          label="IC agreement link"
          type="url"
          placeholder="https://drive.google.com/…"
          value={form.ic_agreement_link}
          onChange={(e) => patch({ ic_agreement_link: e.target.value })}
        />
        <TextInput
          label="Photo ID link"
          type="url"
          placeholder="https://drive.google.com/…"
          value={form.photo_id_link}
          onChange={(e) => patch({ photo_id_link: e.target.value })}
        />
        <TextInput
          label="Equipment photos link"
          type="url"
          placeholder="https://drive.google.com/…"
          value={form.equipment_photos_link}
          onChange={(e) => patch({ equipment_photos_link: e.target.value })}
        />
      </Section>

      <Section title="Notes">
        <TextArea
          label="Reliability notes"
          value={form.reliability_notes}
          onChange={(e) => patch({ reliability_notes: e.target.value })}
        />
        <TextArea
          label="General notes"
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </Section>

      <p className="muted mb-2 text-xs">
        Availability is edited from the entity page, so saving this form never resets the
        availability clock.
      </p>

      <SaveBar onSave={save} pending={pending} status={status} error={error} />
    </>
  );
}
