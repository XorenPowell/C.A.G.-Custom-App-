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
  total_worker_payout_override: number | string | null;
};

/** The one money constant that comes from Settings, not the job. */
export type JobFormulaSettings = {
  default_commission_percent: number | string | null;
};

/** Flat admin fee folded into the target invoice alongside commission and the POS fee. */
export const CAG_FLAT_FEE = 5;

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

/** The override wins when present; everything downstream — including the invoice — uses this. */
export function effectiveWorkerPay(w: WorkerInput): number {
  const override = nullableNum(w.total_pay_override);
  return override ?? calculatedWorkerPay(w);
}

export function calculatedTotalWorkerPayout(workers: WorkerInput[]): number {
  return round2(workers.reduce((sum, w) => sum + effectiveWorkerPay(w), 0));
}

/**
 * What a worker actually receives once their pay is transferred — the gross
 * effective pay minus the transfer fee %. This never feeds the invoice: the
 * customer is billed the gross amount, and the transfer fee is the real
 * cost of moving that money out to the worker.
 */
export function netWorkerPay(
  grossPay: number,
  transferFeePercent: number | string | null,
): number {
  return round2(grossPay * (1 - n(transferFeePercent) / 100));
}

export type JobTotals = {
  calculatedWorkerPayout: number;
  totalWorkerPayout: number;
  posFeeAmount: number;
  /** Fixed % of worker payout, from Settings — the un-adjusted target. */
  commissionTarget: number;
  /** Flat $5, hard-coded — the un-adjusted target. */
  cagTarget: number;
  /** worker payout + commissionTarget + posFeeAmount + cagTarget — what Total Invoice Paid auto-fills to. */
  targetTotalInvoice: number;
  /** Real commission after the shortfall waterfall. Never exceeds commissionTarget; floors at 0. */
  commissionAmount: number;
  /** Real CAG after the shortfall waterfall. Can go negative. */
  cagAmount: number;
};

/**
 * The invoice builds bottom-up: worker payout -> + commission -> + POS fee
 * -> + CAG -> targetTotalInvoice. That target is what auto-fills Total
 * Invoice Paid in the form, but the dispatcher can type over it.
 *
 * commissionAmount/cagAmount are the REAL take, computed from whatever
 * total_invoice_paid actually is. Worker payout and the POS fee are never
 * touched. CAG is protected at exactly its flat target as long as there's
 * enough left to cover it; a shortfall below that eats into CAG itself
 * (which can go negative). Commission gets whatever's left after CAG's
 * target is covered — uncapped, so it absorbs any shortfall down to $0
 * and any surplus above target with no ceiling.
 */
export function jobTotals(
  job: JobMoneyInput,
  workers: WorkerInput[],
  settings: JobFormulaSettings,
): JobTotals {
  const calculatedWorkerPayout = calculatedTotalWorkerPayout(workers);
  const totalWorkerPayout =
    nullableNum(job.total_worker_payout_override) ?? calculatedWorkerPayout;

  const posFeeAmount = round2((totalWorkerPayout * n(job.pos_fee_percent)) / 100);
  const commissionTarget = round2(
    (totalWorkerPayout * n(settings.default_commission_percent)) / 100,
  );
  const cagTarget = CAG_FLAT_FEE;
  const targetTotalInvoice = round2(
    totalWorkerPayout + commissionTarget + posFeeAmount + cagTarget,
  );

  // CAG is protected at exactly its flat target first; commission gets
  // whatever's left, uncapped in either direction.
  const remaining = round2(n(job.total_invoice_paid) - totalWorkerPayout - posFeeAmount);
  const commissionAmount = round2(Math.max(remaining - cagTarget, 0));
  const cagAmount = round2(remaining - commissionAmount);

  return {
    calculatedWorkerPayout,
    totalWorkerPayout,
    posFeeAmount,
    commissionTarget,
    cagTarget,
    targetTotalInvoice,
    commissionAmount,
    cagAmount,
  };
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
