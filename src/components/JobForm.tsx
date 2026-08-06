"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import SaveBar from "@/components/SaveBar";
import DispatchPicker from "@/components/DispatchPicker";
import {
  AddButton,
  MoneyInput,
  NumberInput,
  Section,
  Select,
  TextArea,
  TextInput,
} from "@/components/Form";
import { saveJob, type JobPayload } from "@/app/actions/jobs";
import { optionsFor, type Lists } from "@/lib/lists";
import { calculatedWorkerPay, effectiveWorkerPay, jobTotals } from "@/lib/calc";
import { rateFor } from "@/lib/entity-filters";
import { money } from "@/lib/format";
import {
  CUSTOMER_TYPES,
  JOB_STATUSES,
  type CustomerType,
  type EntityFull,
  type JobFull,
  type JobStatus,
  type Settings,
} from "@/lib/types";

type FeeState = { description: string; amount: string };

type WorkerState = {
  key: string;
  entity_id: string | null;
  entity_name: string;
  regular_hours: string;
  regular_rate: string;
  travel_hours: string;
  travel_rate: string;
  other_hours: string;
  other_rate: string;
  total_pay_override: string;
  fees: FeeState[];
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default function JobForm({
  job,
  lists,
  entities,
  partnerships,
  settings,
  partnershipReferralId,
}: {
  job: JobFull | null;
  lists: Lists;
  entities: EntityFull[];
  partnerships: { id: string; business_name: string }[];
  settings: Settings;
  partnershipReferralId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatusMsg] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [form, setForm] = useState({
    customer_name: job?.customer_name ?? "",
    customer_phone: job?.customer_phone ?? "",
    customer_type: (job?.customer_type ?? "") as CustomerType | "",
    service_category_id: job?.service_category_id ?? "",
    lead_source_id: job?.lead_source_id ?? "",
    partnership_id: job?.partnership_id ?? "",
    zone_id: job?.zone_id ?? "",
    status: (job?.status ?? "Inquiry") as JobStatus,
    date_of_invoice: job?.date_of_invoice ?? "",
    arrival_date: job?.arrival_date ?? "",
    arrival_time: job?.arrival_time?.slice(0, 5) ?? "",
    estimated_duration_minutes: str(job?.estimated_duration_minutes),
    total_invoice_paid: str(job?.total_invoice_paid ?? 0),
    pos_fee_percent: str(job?.pos_fee_percent ?? settings.default_pos_fee_percent),
    other_job_costs: str(job?.other_job_costs ?? 0),
    total_worker_payout_override: str(job?.total_worker_payout_override),
    invoice_ref: job?.invoice_ref ?? "",
    notes: job?.notes ?? "",
  });

  const [addresses, setAddresses] = useState<string[]>(
    job?.addresses?.length ? job.addresses : [""],
  );

  const [workers, setWorkers] = useState<WorkerState[]>(
    (job?.job_workers ?? []).map((w, i) => ({
      key: `w${i}`,
      entity_id: w.entity_id,
      entity_name: w.entity_id
        ? (entities.find((e) => e.id === w.entity_id)?.entity_name ?? "Removed entity")
        : "Unassigned",
      regular_hours: str(w.regular_hours),
      regular_rate: str(w.regular_rate),
      travel_hours: str(w.travel_hours),
      travel_rate: str(w.travel_rate),
      other_hours: str(w.other_hours),
      other_rate: str(w.other_rate),
      total_pay_override: str(w.total_pay_override),
      fees: (w.job_worker_fees ?? []).map((f) => ({
        description: f.description ?? "",
        amount: str(f.amount),
      })),
    })),
  );

  function patch(next: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...next }));
    setStatusMsg(null);
  }

  /** Partnership only applies to the Partnership Referral lead source. */
  const showPartnership =
    !!partnershipReferralId && form.lead_source_id === partnershipReferralId;

  function setLeadSource(id: string) {
    patch({
      lead_source_id: id,
      partnership_id: id === partnershipReferralId ? form.partnership_id : "",
    });
  }

  /**
   * Autofill on add: rates come from the entity's row for this job's service
   * category, and standing fees are pre-loaded. Everything stays editable and
   * nothing is ever written back to the profile.
   */
  function addWorker(entity: EntityFull) {
    const rate = rateFor(entity, form.service_category_id || null);
    setWorkers((prev) => [
      ...prev,
      {
        key: `w${Date.now()}${prev.length}`,
        entity_id: entity.id,
        entity_name: entity.entity_name,
        regular_hours: "",
        regular_rate: str(rate?.regular_rate ?? ""),
        travel_hours: "",
        travel_rate: str(rate?.travel_rate ?? ""),
        other_hours: "", // per-job catch-all, always blank on autofill
        other_rate: str(rate?.other_rate ?? ""),
        total_pay_override: "",
        fees: entity.entity_fees.map((f) => ({
          description: f.fee_name ?? f.description ?? "",
          amount: str(f.amount),
        })),
      },
    ]);
    setPickerOpen(false);
    setStatusMsg(null);
  }

  function patchWorker(index: number, next: Partial<WorkerState>) {
    setWorkers((prev) => prev.map((w, i) => (i === index ? { ...w, ...next } : w)));
    setStatusMsg(null);
  }

  const totals = useMemo(
    () =>
      jobTotals(
        {
          total_invoice_paid: form.total_invoice_paid,
          pos_fee_percent: form.pos_fee_percent,
          other_job_costs: form.other_job_costs,
          total_worker_payout_override: form.total_worker_payout_override,
        },
        workers.map((w) => ({ ...w, fees: w.fees })),
      ),
    [form, workers],
  );

  const payoutOverridden = form.total_worker_payout_override.trim() !== "";

  function save() {
    start(async () => {
      setError(null);
      setStatusMsg(null);

      const payload: JobPayload = {
        id: job?.id ?? null,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_type: form.customer_type || null,
        service_category_id: form.service_category_id || null,
        lead_source_id: form.lead_source_id || null,
        partnership_id: showPartnership ? form.partnership_id || null : null,
        zone_id: form.zone_id || null,
        status: form.status,
        date_of_invoice: form.date_of_invoice || null,
        arrival_date: form.arrival_date || null,
        arrival_time: form.arrival_time || null,
        estimated_duration_minutes: form.estimated_duration_minutes || null,
        addresses,
        total_invoice_paid: form.total_invoice_paid,
        pos_fee_percent: form.pos_fee_percent,
        other_job_costs: form.other_job_costs,
        total_worker_payout_override: form.total_worker_payout_override || null,
        invoice_ref: form.invoice_ref,
        notes: form.notes,
        workers: workers.map((w) => ({
          entity_id: w.entity_id,
          regular_hours: w.regular_hours,
          regular_rate: w.regular_rate,
          travel_hours: w.travel_hours,
          travel_rate: w.travel_rate,
          other_hours: w.other_hours,
          other_rate: w.other_rate,
          total_pay_override: w.total_pay_override || null,
          fees: w.fees,
        })),
      };

      const res = await saveJob(payload);
      if (!res.ok) {
        setError(res.error ?? "Save failed.");
        return;
      }
      if (res.warning) setStatusMsg(`Saved. ${res.warning}`);
      else setStatusMsg("Saved.");

      if (!job) {
        router.push(`/jobs/${res.id}`);
      }
      router.refresh();
    });
  }

  const namesRecord = useMemo(() => {
    const rec: Record<string, string> = {};
    for (const kind of Object.keys(lists) as (keyof Lists)[]) {
      for (const item of lists[kind]) rec[item.id] = item.name;
    }
    return rec;
  }, [lists]);

  return (
    <>
      {/* ---------- customer ---------- */}
      <Section title="Customer">
        <div className="grid-form">
          <TextInput
            label="Customer name"
            value={form.customer_name}
            onChange={(e) => patch({ customer_name: e.target.value })}
          />
          <TextInput
            label="Phone"
            type="tel"
            inputMode="tel"
            value={form.customer_phone}
            onChange={(e) => patch({ customer_phone: e.target.value })}
          />
          <Select
            label="Customer type"
            value={form.customer_type}
            onChange={(e) => patch({ customer_type: e.target.value as CustomerType | "" })}
          >
            <option value="">— select —</option>
            {CUSTOMER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
      </Section>

      {/* ---------- classification ---------- */}
      <Section title="Classification">
        <div className="grid-form">
          <Select
            label="Service category"
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
            label="Lead source"
            value={form.lead_source_id}
            onChange={(e) => setLeadSource(e.target.value)}
          >
            <option value="">— select —</option>
            {optionsFor(lists.lead_source, form.lead_source_id || null).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          {showPartnership && (
            <Select
              label="Partnership"
              value={form.partnership_id}
              onChange={(e) => patch({ partnership_id: e.target.value })}
              hint="Shown because the lead source is Partnership Referral."
            >
              <option value="">— select —</option>
              {partnerships.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.business_name}
                </option>
              ))}
            </Select>
          )}

          <Select
            label="Zone"
            value={form.zone_id}
            onChange={(e) => patch({ zone_id: e.target.value })}
          >
            <option value="">— select —</option>
            {optionsFor(lists.zone, form.zone_id || null).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select
            label="Status"
            value={form.status}
            onChange={(e) => patch({ status: e.target.value as JobStatus })}
          >
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </Section>

      {/* ---------- scheduling ---------- */}
      <Section title="Scheduling">
        <div className="grid-form">
          <TextInput
            label="Invoice date"
            type="date"
            value={form.date_of_invoice}
            onChange={(e) => patch({ date_of_invoice: e.target.value })}
            hint="Drives week/month grouping and the dashboard date range."
          />
          <TextInput
            label="Arrival date"
            type="date"
            value={form.arrival_date}
            onChange={(e) => patch({ arrival_date: e.target.value })}
          />
          <TextInput
            label="Arrival time"
            type="time"
            value={form.arrival_time}
            onChange={(e) => patch({ arrival_time: e.target.value })}
          />
          <NumberInput
            label="Estimated duration (minutes)"
            step="15"
            min={0}
            value={form.estimated_duration_minutes}
            onChange={(e) => patch({ estimated_duration_minutes: e.target.value })}
          />
        </div>

        <span className="label">Addresses / stops</span>
        {addresses.map((a, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <input
              className="input"
              value={a}
              placeholder={i === 0 ? "First stop" : `Stop ${i + 1}`}
              onChange={(e) =>
                setAddresses((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
              }
            />
            <button
              type="button"
              className="btn btn-sm btn-danger shrink-0"
              onClick={() => setAddresses((prev) => prev.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        <AddButton onClick={() => setAddresses((p) => [...p, ""])}>Add stop</AddButton>
      </Section>

      {/* ---------- workers ---------- */}
      <Section
        title={`Workers (${workers.length})`}
        action={
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setPickerOpen(true)}
          >
            + Add worker
          </button>
        }
      >
        {workers.length === 0 && (
          <p className="muted text-sm">No workers assigned.</p>
        )}

        {workers.map((w, i) => {
          const calc = calculatedWorkerPay(w);
          const eff = effectiveWorkerPay(w);
          const overridden = w.total_pay_override.trim() !== "";

          return (
            <div key={w.key} className="row-repeat mb-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-bold">
                  {w.entity_id ? (
                    <Link href={`/roster/${w.entity_id}`} className="link">
                      {w.entity_name}
                    </Link>
                  ) : (
                    w.entity_name
                  )}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => setWorkers((prev) => prev.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-2 gap-x-3">
                <NumberInput
                  label="Regular hrs"
                  step="0.25"
                  value={w.regular_hours}
                  onChange={(e) => patchWorker(i, { regular_hours: e.target.value })}
                />
                <MoneyInput
                  label="Regular rate"
                  value={w.regular_rate}
                  onChange={(e) => patchWorker(i, { regular_rate: e.target.value })}
                />
                <NumberInput
                  label="Travel hrs"
                  step="0.25"
                  value={w.travel_hours}
                  onChange={(e) => patchWorker(i, { travel_hours: e.target.value })}
                />
                <MoneyInput
                  label="Travel rate"
                  value={w.travel_rate}
                  onChange={(e) => patchWorker(i, { travel_rate: e.target.value })}
                />
                <NumberInput
                  label="Other hrs"
                  step="0.25"
                  value={w.other_hours}
                  onChange={(e) => patchWorker(i, { other_hours: e.target.value })}
                />
                <MoneyInput
                  label="Other rate"
                  value={w.other_rate}
                  onChange={(e) => patchWorker(i, { other_rate: e.target.value })}
                />
              </div>

              <span className="label">Fees</span>
              {w.fees.map((f, fi) => (
                <div key={fi} className="mb-1 flex gap-1">
                  <input
                    className="input"
                    placeholder="Description"
                    value={f.description}
                    onChange={(e) =>
                      patchWorker(i, {
                        fees: w.fees.map((x, j) =>
                          j === fi ? { ...x, description: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <input
                    className="input w-28 shrink-0"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={f.amount}
                    onChange={(e) =>
                      patchWorker(i, {
                        fees: w.fees.map((x, j) =>
                          j === fi ? { ...x, amount: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-danger shrink-0"
                    onClick={() =>
                      patchWorker(i, { fees: w.fees.filter((_, j) => j !== fi) })
                    }
                  >
                    âœ•
                  </button>
                </div>
              ))}
              <AddButton
                onClick={() =>
                  patchWorker(i, { fees: [...w.fees, { description: "", amount: "" }] })
                }
              >
                Add fee
              </AddButton>

              {/* worker_total_pay — calculated, with an editable override */}
              <div className="mt-3 border-t border-[var(--color-line)] pt-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">Worker total pay</span>
                  <span className="mono text-base font-bold">{money(eff)}</span>
                </div>
                <div className="muted text-xs">
                  Calculated: {money(calc)}
                  {overridden && " — overridden below"}
                </div>
                <div className="mt-1 flex items-end gap-2">
                  <div className="flex-1">
                    <MoneyInput
                      label="Override"
                      placeholder="auto"
                      value={w.total_pay_override}
                      onChange={(e) => patchWorker(i, { total_pay_override: e.target.value })}
                      className="mb-0"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm mb-3"
                    disabled={!overridden}
                    onClick={() => patchWorker(i, { total_pay_override: "" })}
                  >
                    Reset to auto
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </Section>

      {/* ---------- money ---------- */}
      <Section title="Money">
        <div className="grid-form">
          <MoneyInput
            label="Total invoice paid"
            value={form.total_invoice_paid}
            onChange={(e) => patch({ total_invoice_paid: e.target.value })}
          />
          <NumberInput
            label="POS fee %"
            step="0.1"
            value={form.pos_fee_percent}
            onChange={(e) => patch({ pos_fee_percent: e.target.value })}
            hint={`Default is ${settings.default_pos_fee_percent}% — editable per job.`}
          />
          <MoneyInput
            label="Other job costs"
            value={form.other_job_costs}
            onChange={(e) => patch({ other_job_costs: e.target.value })}
          />
          <TextInput
            label="Invoice ref (Square)"
            value={form.invoice_ref}
            onChange={(e) => patch({ invoice_ref: e.target.value })}
            hint="Optional — Square invoice number or link."
          />
        </div>
      </Section>

      {/* ---------- financial summary ---------- */}
      <Section title="Financial Summary">
        <dl className="text-sm">
          <SummaryRow label="Total invoice paid" value={money(Number(form.total_invoice_paid) || 0)} />
          <SummaryRow
            label={`POS fee (${form.pos_fee_percent || 0}%)`}
            value={money(totals.posFeeAmount)}
          />
          <SummaryRow label="Other job costs" value={money(Number(form.other_job_costs) || 0)} />
          <SummaryRow
            label="Total worker payout"
            value={money(totals.totalWorkerPayout)}
            note={
              payoutOverridden
                ? `overridden — calculated ${money(totals.calculatedWorkerPayout)}`
                : undefined
            }
          />
          <SummaryRow label="Total job costs" value={money(totals.totalJobCosts)} strong />
          <SummaryRow
            label="Profit"
            value={money(totals.profit)}
            strong
            tone={totals.profit < 0 ? "bad" : "good"}
          />
        </dl>

        <div className="mt-3 flex items-end gap-2 border-t border-[var(--color-line)] pt-2">
          <div className="flex-1">
            <MoneyInput
              label="Override total worker payout"
              placeholder="auto"
              value={form.total_worker_payout_override}
              onChange={(e) => patch({ total_worker_payout_override: e.target.value })}
              className="mb-0"
            />
          </div>
          <button
            type="button"
            className="btn btn-sm mb-3"
            disabled={!payoutOverridden}
            onClick={() => patch({ total_worker_payout_override: "" })}
          >
            Reset to auto
          </button>
        </div>
      </Section>

      {/* ---------- notes ---------- */}
      <Section title="Notes">
        <TextArea
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Anything the dispatcher needs on this job."
        />
      </Section>

      {pickerOpen && (
        <DispatchPicker
          entities={entities}
          serviceCategoryId={form.service_category_id || null}
          zoneId={form.zone_id || null}
          arrivalDate={form.arrival_date || null}
          alreadyPicked={workers.map((w) => w.entity_id).filter(Boolean) as string[]}
          names={namesRecord}
          onPick={addWorker}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <SaveBar onSave={save} pending={pending} status={status} error={error} />
    </>
  );
}

function SummaryRow({
  label,
  value,
  note,
  strong,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
  tone?: "good" | "bad";
}) {
  const color =
    tone === "bad"
      ? "text-[var(--color-danger)]"
      : tone === "good"
        ? "text-[var(--color-good)]"
        : "";
  return (
    <div
      className={`flex items-baseline justify-between gap-2 border-b border-[var(--color-line-soft)] py-1.5 last:border-0 ${
        strong ? "font-bold" : ""
      }`}
    >
      <dt>
        {label}
        {note && <span className="muted block text-xs font-normal">{note}</span>}
      </dt>
      <dd className={`mono shrink-0 ${color}`}>{value}</dd>
    </div>
  );
}
