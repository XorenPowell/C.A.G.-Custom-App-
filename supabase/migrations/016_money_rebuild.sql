-- =====================================================================
-- 016 — Money model rebuild
--
-- Target invoice builds bottom-up: worker payout (gross, billed) + other
-- job costs + CAG (flat $5, hard-coded) form the base that commission %
-- and POS fee % both compute from -> + commission (fixed %, from
-- Settings) -> + POS fee % -> target invoice. That target auto-fills
-- jobs.total_invoice_paid, but the dispatcher can type over it with the
-- real number.
--
-- commission_amount is the REAL take: total_invoice_paid, net of the real
-- deposit fee (settings.deposit_fee_percent — a real-world deduction like
-- card processing, separate from the POS fee % shown on the target
-- invoice), minus gross worker payout, other job costs and the flat CAG
-- fee. Worker payout, other job costs and CAG are never touched —
-- commission alone absorbs the difference between the target and what
-- actually came in, uncapped in either direction (it goes negative if a
-- job lost money). cag_amount is always the flat CAG fee.
--
-- Per-job commission_percent/commission_cap are dropped: commission is
-- now a single fixed rate from Settings. The old flat other_job_costs
-- column is replaced by a job_costs table (description + amount per row,
-- like job_worker_fees) so a job can carry any number of ad-hoc costs. A
-- new Settings field, transfer_fee_percent, tracks the cost of
-- transferring money to a worker (their calculated pay minus this rate is
-- what they actually receive) — purely a payroll figure, it never touches
-- the invoice or the commission calculation, which always uses gross pay.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table settings add column if not exists transfer_fee_percent numeric(6,3) not null default 2.0;
alter table settings add column if not exists deposit_fee_percent numeric(6,3) not null default 2.5;
alter table settings drop column if exists default_commission_cap;

-- Must drop the old view before dropping the jobs columns it depends on.
drop view if exists job_financials cascade;

alter table jobs drop column if exists other_job_costs;
alter table jobs drop column if exists commission_percent;
alter table jobs drop column if exists commission_cap;

create table if not exists job_costs (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  description text,
  amount      numeric(12,2) not null default 0,
  sort_order  integer not null default 0
);
create index if not exists job_costs_job_idx on job_costs (job_id);

create view job_financials as
select
  j.id as job_id,
  fin.calculated_worker_payout,
  fin.total_worker_payout,
  fin.other_costs_total,
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
left join lateral (
  select sum(amount) as costs_total
  from job_costs
  where job_id = j.id
) oc on true
cross join lateral (
  with base as (
    select
      coalesce(j.total_worker_payout_override, p.payout, 0) as total_worker_payout,
      coalesce(oc.costs_total, 0)                            as other_costs_total
  ),
  -- Worker payout + other job costs + CAG together form the base that
  -- commission % and POS fee % both compute from.
  fees as (
    select
      b.total_worker_payout,
      b.other_costs_total,
      5.0                                                                                                   as cag_target, -- hard-coded, not settings-driven
      round((b.total_worker_payout + b.other_costs_total + 5.0) * j.pos_fee_percent / 100.0, 2)             as pos_fee_amount,
      round((b.total_worker_payout + b.other_costs_total + 5.0) * s.default_commission_percent / 100.0, 2)  as commission_target
    from base b
  ),
  totals as (
    select
      f.*,
      round(f.total_worker_payout + f.other_costs_total + f.commission_target + f.pos_fee_amount + f.cag_target, 2) as target_total_invoice,
      -- What's actually deposited, net of the real deposit fee — separate
      -- from (and not necessarily equal to) the POS fee % above.
      j.total_invoice_paid * (1 - s.deposit_fee_percent / 100.0) as deposited
    from fees f
  )
  select
    coalesce(p.payout, 0)                                                        as calculated_worker_payout,
    t.total_worker_payout,
    t.other_costs_total,
    t.pos_fee_amount,
    t.commission_target,
    t.cag_target,
    t.target_total_invoice,
    round(t.deposited - t.total_worker_payout - t.other_costs_total - t.cag_target, 2) as commission_amount,
    t.cag_target                                                                 as cag_amount
  from totals t
) fin;

alter view job_financials set (security_invoker = on);
grant select on job_financials to authenticated;

alter table job_costs enable row level security;
drop policy if exists job_costs_authenticated_all on job_costs;
create policy job_costs_authenticated_all on job_costs
  for all to authenticated using (true) with check (true);
