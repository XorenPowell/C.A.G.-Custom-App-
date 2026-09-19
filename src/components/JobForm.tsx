"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
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
import { calculatedWorkerPay, effectiveWorkerPay, jobTotals, netWorkerPay } from "@/lib/calc";
import { rateFor } from "@/lib/entity-filters";
import { dateLongDisplayNoYear, money, timeDisplay } from "@/lib/format";
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

type WindowState = { date: string; start_time: string; end_time: string };

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
  is_leader: boolean;
  fees: FeeState[];
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Collapsed-summary text for an arrival window's <summary>, e.g. "Thu, Sep 24, 6:00 AM – 8:00 AM". */
function windowSummary(w: WindowState): string {
  const range = w.start_time
    ? w.end_time
      ? `${timeDisplay(w.start_time)} – ${timeDisplay(w.end_time)}`
      : timeDisplay(w.start_time)
    : "";
  return [dateLongDisplayNoYear(w.date), range].filter(Boolean).join(", ");
}

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
  const [pending, start] = useGlobalTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatusMsg] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [form, setForm] = useState({
    customer_name: job?.customer_name ?? "",
    customer_phone: job?.customer_phone ?? "",
    customer_type: (job?.customer_type ?? "") as CustomerType | "",
    service_category_id: job?.service_category_id ?? "",
    inquiry_source_id: job?.inquiry_source_id ?? "",
    partnership_id: job?.partnership_id ?? "",
    zone_id: job?.zone_id ?? "",
    status: (job?.status ?? "Inquiry") as JobStatus,
    date_of_invoice: job?.date_of_invoice ?? "",
    confirmed_arrival_date: job?.confirmed_arrival_date ?? "",
    confirmed_arrival_time: job?.confirmed_arrival_time?.slice(0, 5) ?? "",
    estimated_duration_minutes: str(job?.estimated_duration_minutes),
    total_invoice_paid: str(job?.total_invoice_paid ?? 0),
    pos_fee_percent: str(job?.pos_fee_percent ?? settings.default_pos_fee_percent),
    total_worker_payout_override: str(job?.total_worker_payout_override),
    invoice_ref: job?.invoice_ref ?? "",
    notes: job?.notes ?? "",
    details: job?.details ?? "",
  });

  const [addresses, setAddresses] = useState<string[]>(
    job?.addresses?.length ? job.addresses : [""],
  );

  const [windows, setWindows] = useState<WindowState[]>(
    [0, 1, 2].map((i) => {
      const w = job?.job_arrival_windows.find((x) => x.sort_order === i);
      return {
        date: w?.date ?? "",
        start_time: w?.start_time?.slice(0, 5) ?? "",
        end_time: w?.end_time?.slice(0, 5) ?? "",
      };
    }),
  );

  // How many of the 3 window slots are shown — starts at 1 (or however many
  // the job already has filled in), with "+ add another" revealing more.
  const [windowCount, setWindowCount] = useState(
    Math.max(1, ...job?.job_arrival_windows.map((w) => w.sort_order + 1) ?? [0]),
  );

  function patchWindow(index: number, next: Partial<WindowState>) {
    setWindows((prev) => prev.map((w, i) => (i === index ? { ...w, ...next } : w)));
    setStatusMsg(null);
  }

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
      is_leader: w.is_leader,
      fees: (w.job_worker_fees ?? []).map((f) => ({
        description: f.description ?? "",
        amount: str(f.amount),
      })),
    })),
  );

  const [otherCosts, setOtherCosts] = useState<FeeState[]>(
    (job?.job_costs ?? []).map((c) => ({
      description: c.description ?? "",
      amount: str(c.amount),
    })),
  );

  function patch(next: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...next }));
    setStatusMsg(null);
  }

  /** Partnership only applies to the Partnership Referral inquiry source. */
  const showPartnership =
    !!partnershipReferralId && form.inquiry_source_id === partnershipReferralId;

  function setInquirySource(id: string) {
    patch({
      inquiry_source_id: id,
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
        is_leader: false,
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

  /** At most one leader per job — checking one clears the others. */
  function setLeader(index: number, isLeader: boolean) {
    setWorkers((prev) => prev.map((w, i) => ({ ...w, is_leader: i === index && isLeader })));
    setStatusMsg(null);
  }

  function patchOtherCost(index: number, next: Partial<FeeState>) {
    setOtherCosts((prev) => prev.map((c, i) => (i === index ? { ...c, ...next } : c)));
    setStatusMsg(null);
  }

  const totals = useMemo(
    () =>
      jobTotals(
        {
          total_invoice_paid: form.total_invoice_paid,
          pos_fee_percent: form.pos_fee_percent,
          total_worker_payout_override: form.total_worker_payout_override,
        },
        workers.map((w) => ({ ...w, fees: w.fees })),
        otherCosts,
        { default_commission_percent: settings.default_commission_percent },
      ),
    [form, workers, otherCosts, settings.default_commission_percent],
  );

  // Total Invoice Paid auto-fills from the target invoice until the
  // dispatcher types into it directly — existing jobs start "touched" so a
  // saved real number is never silently overwritten.
  const [totalInvoicePaidTouched, setTotalInvoicePaidTouched] = useState(!!job);
  useEffect(() => {
    if (totalInvoicePaidTouched) return;
    setForm((f) => ({ ...f, total_invoice_paid: str(totals.targetTotalInvoice) }));
  }, [totalInvoicePaidTouched, totals.targetTotalInvoice]);

  const payoutOverridden = form.total_worker_payout_override.trim() !== "";
  const netTotalWorkerPayout = netWorkerPay(totals.totalWorkerPayout, settings.transfer_fee_percent);

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
        inquiry_source_id: form.inquiry_source_id || null,
        partnership_id: showPartnership ? form.partnership_id || null : null,
        zone_id: form.zone_id || null,
        status: form.status,
        date_of_invoice: form.date_of_invoice || null,
        arrival_windows: windows.map((w) => ({
          date: w.date || null,
          start_time: w.start_time || null,
          end_time: w.end_time || null,
        })),
        confirmed_arrival_date: form.confirmed_arrival_date || null,
        confirmed_arrival_time: form.confirmed_arrival_time || null,
        estimated_duration_minutes: form.estimated_duration_minutes || null,
        addresses,
        total_invoice_paid: form.total_invoice_paid,
        pos_fee_percent: form.pos_fee_percent,
        total_worker_payout_override: form.total_worker_payout_override || null,
        invoice_ref: form.invoice_ref,
        notes: form.notes,
        details: form.details,
        workers: workers.map((w) => ({
          entity_id: w.entity_id,
          regular_hours: w.regular_hours,
          regular_rate: w.regular_rate,
          travel_hours: w.travel_hours,
          travel_rate: w.travel_rate,
          other_hours: w.other_hours,
          other_rate: w.other_rate,
          total_pay_override: w.total_pay_override || null,
          is_leader: w.is_leader,
          fees: w.fees,
        })),
        other_costs: otherCosts,
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
            label="Inquiry source"
            value={form.inquiry_source_id}
            onChange={(e) => setInquirySource(e.target.value)}
          >
            <option value="">— select —</option>
            {optionsFor(lists.inquiry_source, form.inquiry_source_id || null).map((c) => (
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
              hint="Shown because the inquiry source is Partnership Referral."
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
          <NumberInput
            label="Estimated duration (minutes)"
            step="15"
            min={0}
            value={form.estimated_duration_minutes}
            onChange={(e) => patch({ estimated_duration_minutes: e.target.value })}
          />
        </div>

        {form.status === "Booked" ? (
          <>
            <p className="muted mb-2 text-xs">
              Job is Booked — this is the confirmed schedule, not a candidate window.
            </p>
            <div className="grid-form">
              <TextInput
                label="Confirmed arrival date"
                type="date"
                value={form.confirmed_arrival_date}
                onChange={(e) => patch({ confirmed_arrival_date: e.target.value })}
              />
              <TextInput
                label="Confirmed arrival time"
                type="time"
                value={form.confirmed_arrival_time}
                onChange={(e) => patch({ confirmed_arrival_time: e.target.value })}
              />
            </div>
          </>
        ) : (
          <>
            <p className="muted mb-2 text-xs">
              Up to three optional arrival windows — fill in what you know.
            </p>
            <div className="flex flex-col gap-2">
              {windows.slice(0, windowCount).map((w, i) => (
                <details key={i} className="border border-[var(--color-line)]">
                  <summary className="label cursor-pointer list-none p-2">
                    Arrival window {i + 1}
                    {w.date ? ` — ${windowSummary(w)}` : ""}
                  </summary>
                  <div className="grid-form p-2 pt-0">
                    <TextInput
                      label="Date"
                      type="date"
                      value={w.date}
                      onChange={(e) => patchWindow(i, { date: e.target.value })}
                    />
                    <TextInput
                      label="Start time"
                      type="time"
                      value={w.start_time}
                      onChange={(e) => patchWindow(i, { start_time: e.target.value })}
                    />
                    <TextInput
                      label="End time"
                      type="time"
                      value={w.end_time}
                      onChange={(e) => patchWindow(i, { end_time: e.target.value })}
                    />
                  </div>
                </details>
              ))}
              {windowCount < 3 && (
                <button
                  type="button"
                  className="btn btn-sm self-start"
                  onClick={() => setWindowCount((n) => n + 1)}
                >
                  + Add another arrival window
                </button>
              )}
            </div>
          </>
        )}

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

              <label className="mb-2 flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={w.is_leader}
                  onChange={(e) => setLeader(i, e.target.checked)}
                  className="size-4 accent-[var(--color-accent)]"
                />
                Leader
              </label>

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
                  <span className="font-semibold">Worker pay (billed)</span>
                  <span className="mono text-base font-bold">{money(eff)}</span>
                </div>
                <div className="muted text-xs">
                  Calculated: {money(calc)}
                  {overridden && " — overridden below"}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                  <span>Net after {settings.transfer_fee_percent}% transfer fee</span>
                  <span className="mono">{money(netWorkerPay(eff, settings.transfer_fee_percent))}</span>
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

      {/* ---------- other job costs ---------- */}
      <Section title="Other Job Costs">
        <p className="muted mb-2 text-xs">
          Ad-hoc costs (parking, supplies, etc.) — added to worker pay and CAG before
          commission % and POS fee % are calculated.
        </p>
        {otherCosts.map((c, i) => (
          <div key={i} className="mb-1 flex gap-1">
            <input
              className="input"
              placeholder="Description"
              value={c.description}
              onChange={(e) => patchOtherCost(i, { description: e.target.value })}
            />
            <input
              className="input w-28 shrink-0"
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={c.amount}
              onChange={(e) => patchOtherCost(i, { amount: e.target.value })}
            />
            <button
              type="button"
              className="btn btn-sm btn-danger shrink-0"
              onClick={() => setOtherCosts((prev) => prev.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        <AddButton
          onClick={() => setOtherCosts((prev) => [...prev, { description: "", amount: "" }])}
        >
          Add cost
        </AddButton>
      </Section>

      {/* ---------- money ---------- */}
      <Section title="Money">
        <div className="grid-form">
          <NumberInput
            label="POS fee %"
            step="0.1"
            value={form.pos_fee_percent}
            onChange={(e) => patch({ pos_fee_percent: e.target.value })}
            hint={`Default is ${settings.default_pos_fee_percent}% — editable per job.`}
          />
          <TextInput
            label="Invoice ref (Square)"
            value={form.invoice_ref}
            onChange={(e) => patch({ invoice_ref: e.target.value })}
            hint="Optional — Square invoice number or link."
          />
        </div>
        <div className="mt-2 flex items-end gap-2">
          <div className="flex-1">
            <MoneyInput
              label="Total invoice paid"
              value={form.total_invoice_paid}
              onChange={(e) => {
                setTotalInvoicePaidTouched(true);
                patch({ total_invoice_paid: e.target.value });
              }}
              className="mb-0"
              hint={
                totalInvoicePaidTouched
                  ? `Calculated: ${money(totals.targetTotalInvoice)}`
                  : "Auto-filled from the calculation below — type over it if Square's real number differs."
              }
            />
          </div>
          <button
            type="button"
            className="btn btn-sm"
            disabled={!totalInvoicePaidTouched}
            onClick={() => setTotalInvoicePaidTouched(false)}
          >
            Reset to calculated
          </button>
        </div>
      </Section>

      {/* ---------- financial summary ---------- */}
      <Section title="Financial Summary">
        <dl className="text-sm">
          <SummaryRow
            label="Worker pay (billed)"
            value={money(totals.totalWorkerPayout)}
            note={
              payoutOverridden
                ? `overridden — calculated ${money(totals.calculatedWorkerPayout)}`
                : undefined
            }
          />
          {totals.otherCostsTotal !== 0 && (
            <SummaryRow label="Other job costs" value={money(totals.otherCostsTotal)} />
          )}
          <SummaryRow
            label={`Commission (${settings.default_commission_percent}%)`}
            value={money(totals.commissionTarget)}
          />
          <SummaryRow
            label={`POS fee (${form.pos_fee_percent || 0}%)`}
            value={money(totals.posFeeAmount)}
          />
          <SummaryRow label="CAG" value={money(totals.cagTarget)} />
          <SummaryRow label="Target invoice" value={money(totals.targetTotalInvoice)} strong />
        </dl>

        <p className="muted mb-1 mt-3 text-xs">Real take, from the actual Total Invoice Paid above:</p>
        <dl className="text-sm">
          <SummaryRow label="Total invoice paid" value={money(Number(form.total_invoice_paid) || 0)} />
          <SummaryRow
            label="Commission"
            value={money(totals.commissionAmount)}
            strong
            tone="good"
          />
          <SummaryRow
            label="CAG"
            value={money(totals.cagAmount)}
            strong
            tone={totals.cagAmount < 0 ? "bad" : "good"}
          />
          <SummaryRow
            label={`Total worker payout (${settings.transfer_fee_percent}% adjusted)`}
            value={money(netTotalWorkerPayout)}
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

      {/* ---------- details ---------- */}
      <Section title="Details">
        <TextArea
          value={form.details}
          onChange={(e) => patch({ details: e.target.value })}
          placeholder="Parking, gate codes, access instructions — anything worth texting to the customer or worker."
        />
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
          arrivalDates={
            form.status === "Booked"
              ? [form.confirmed_arrival_date].filter(Boolean)
              : windows.map((w) => w.date).filter(Boolean)
          }
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
