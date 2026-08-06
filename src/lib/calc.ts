/**
 * Derived-value engine (spec section 4).
 *
 * These are computed on read and never written to the database. This module
 * mirrors the `job_worker_pay` / `job_financials` SQL views exactly so the job
 * form can show live totals while editing. If you change one, change both.
 */

export type WorkerFeeInput = { amount: number | string | null };

export type WorkerInput = {
  regular_hours: number | string | null;
  regular_rate: number | string | null;
  travel_hours: number | string | null;
  travel_rate: number | string | null;
  other_hours: number | string | null;
  other_rate: number | string | null;
  total_pay_override: number | string | null;
  fees: WorkerFeeInput[];
};

export type JobMoneyInput = {
  total_invoice_paid: number | string | null;
  pos_fee_percent: number | string | null;
  other_job_costs: number | string | null;
  total_worker_payout_override: number | string | null;
};

/** Empty string, null and undefined all mean zero. */
export function n(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const parsed = typeof v === "number" ? v : Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** null only when the field is genuinely blank — this is how an override clears. */
export function nullableNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : null;
}

export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function workerFeesTotal(fees: WorkerFeeInput[]): number {
  return round2(fees.reduce((sum, f) => sum + n(f.amount), 0));
}

/**
 * (regular_hours × regular_rate) + (travel_hours × travel_rate)
 * + (other_hours × other_rate) + sum(fees)
 */
export function calculatedWorkerPay(w: WorkerInput): number {
  return round2(
    n(w.regular_hours) * n(w.regular_rate) +
      n(w.travel_hours) * n(w.travel_rate) +
      n(w.other_hours) * n(w.other_rate) +
      workerFeesTotal(w.fees),
  );
}

/** The override wins when present; everything downstream uses this. */
export function effectiveWorkerPay(w: WorkerInput): number {
  const override = nullableNum(w.total_pay_override);
  return override ?? calculatedWorkerPay(w);
}

export function calculatedTotalWorkerPayout(workers: WorkerInput[]): number {
  return round2(workers.reduce((sum, w) => sum + effectiveWorkerPay(w), 0));
}

export type JobTotals = {
  calculatedWorkerPayout: number;
  totalWorkerPayout: number;
  posFeeAmount: number;
  totalJobCosts: number;
  profit: number;
};

export function jobTotals(job: JobMoneyInput, workers: WorkerInput[]): JobTotals {
  const calculatedWorkerPayout = calculatedTotalWorkerPayout(workers);
  const totalWorkerPayout =
    nullableNum(job.total_worker_payout_override) ?? calculatedWorkerPayout;
  // pos_fee_percent is a percentage: 5.0 means 5%.
  const posFeeAmount = round2((n(job.total_invoice_paid) * n(job.pos_fee_percent)) / 100);
  const totalJobCosts = round2(totalWorkerPayout + posFeeAmount + n(job.other_job_costs));
  const profit = round2(n(job.total_invoice_paid) - totalJobCosts);
  return { calculatedWorkerPayout, totalWorkerPayout, posFeeAmount, totalJobCosts, profit };
}

/** Monday of the week containing the given YYYY-MM-DD date. */
export function weekOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0 = Sunday
  const shift = dow === 0 ? 6 : dow - 1;
  dt.setUTCDate(dt.getUTCDate() - shift);
  return dt.toISOString().slice(0, 10);
}

/** YYYY-MM of the given date. */
export function monthOf(iso: string | null | undefined): string | null {
  return iso ? iso.slice(0, 7) : null;
}
