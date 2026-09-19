-- =====================================================================
-- 016 — Money model rebuild
--
-- Rebuilds job financials to match how money actually moves, bottom-up:
--   worker payout (gross, billed) -> + commission (fixed %, from Settings)
--   -> + POS fee % -> + CAG (flat $5, hard-coded) -> target invoice.
--
-- jobs.total_invoice_paid is still the real, editable number the customer
-- was actually charged (typically from Square) — the app auto-fills it
-- from the target invoice formula, but the dispatcher can type over it.
--
-- If the real invoice falls short of the target, the shortfall is
-- absorbed first by commission (down to $0), then by CAG (protected at
-- its full target until commission is fully depleted, then can go
-- negative) — worker payout and the POS fee are never touched. If the
-- real invoice exceeds target, CAG absorbs the surplus.
--
-- Per-job commission_percent/commission_cap and other_job_costs are
-- dropped: commission is now a single fixed rate from Settings, and
-- "other costs" had no role separate from worker payout. A new Settings
-- field, transfer_fee_percent, tracks the cost of transferring money to a
-- worker (their calculated pay minus this rate is what they actually
-- receive) — purely a payroll figure, it never touches the invoice.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table settings add column if not exists transfer_fee_percent numeric(6,3) not null default 2.0;
alter table settings drop column if exists default_commission_cap;

-- Must drop the old view before dropping the jobs columns it depends on.
drop view if exists job_financials cascade;

alter table jobs drop column if exists other_job_costs;
alter table jobs drop column if exists commission_percent;
alter table jobs drop column if exists commission_cap;

create view job_financials as
select
  j.id as job_id,
  fin.calculated_worker_payout,
  fin.total_worker_payout,
  fin.pos_fee_amount,
  fin.commission_target,
  fin.cag_target,
  fin.target_total_invoice,
  fin.commission_amount,
  fin.cag_amount,
  date_trunc('week', coalesce(j.date_of_invoice, j.arrival_date, j.created_at::date))::date as week_of,
  to_char(coalesce(j.date_of_invoice, j.arrival_date, j.created_at::date), 'YYYY-MM')       as month,
  exists (
    select 1 from jobs prior
    where prior.id <> j.id
      and prior.status = 'Completed'
      and nullif(regexp_replace(coalesce(prior.customer_phone,''), '\D', '', 'g'), '')
          = nullif(regexp_replace(coalesce(j.customer_phone,''), '\D', '', 'g'), '')
      and coalesce(prior.date_of_invoice, prior.arrival_date, prior.created_at::date)
          < coalesce(j.date_of_invoice, j.arrival_date, j.created_at::date)
  )                                                         as repeat_customer
from jobs j
cross join settings s
left join lateral (
  select sum(effective_pay) as payout
  from job_worker_pay
  where job_id = j.id
) p on true
cross join lateral (
  with base as (
    select coalesce(j.total_worker_payout_override, p.payout, 0) as total_worker_payout
  ),
  fees as (
    select
      b.total_worker_payout,
      round(b.total_worker_payout * j.pos_fee_percent / 100.0, 2)            as pos_fee_amount,
      round(b.total_worker_payout * s.default_commission_percent / 100.0, 2) as commission_target,
      5.0                                                                    as cag_target -- hard-coded, not settings-driven
    from base b
  ),
  totals as (
    select
      f.*,
      round(f.total_worker_payout + f.commission_target + f.pos_fee_amount + f.cag_target, 2) as target_total_invoice,
      (j.total_invoice_paid - f.total_worker_payout - f.pos_fee_amount) as remaining
    from fees f
  )
  select
    coalesce(p.payout, 0)                                                                        as calculated_worker_payout,
    t.total_worker_payout,
    t.pos_fee_amount,
    t.commission_target,
    t.cag_target,
    t.target_total_invoice,
    least(greatest(t.remaining - t.cag_target, 0), t.commission_target)                           as commission_amount,
    t.remaining - least(greatest(t.remaining - t.cag_target, 0), t.commission_target)              as cag_amount
  from totals t
) fin;

alter view job_financials set (security_invoker = on);
grant select on job_financials to authenticated;
