-- =====================================================================
-- 025 — Direct To Worker
--
-- An inquiry handed straight to a worker: the job is real and still needs
-- following up, but no money passes through the dispatcher, so there is
-- no invoice, no payout, no POS fee, no CAG and no commission.
--
-- Deliberately a flag, not a status. It is orthogonal to the pipeline — a
-- Direct To Worker job still moves Inquiry -> Booked -> Completed — and a
-- status would have meant reworking the completed_at trigger, the
-- open/closed rule, commission dating and the calendar sync for something
-- that is really one boolean.
--
-- Run once. Safe to re-run.
-- =====================================================================

alter table jobs
  add column if not exists direct_to_worker boolean not null default false;

create index if not exists jobs_direct_to_worker_idx
  on jobs (direct_to_worker) where direct_to_worker;

-- ---------------------------------------------------------------------
-- Money is zeroed at the view, not the columns
--
-- The underlying figures are left untouched, so unticking the box restores
-- the numbers rather than having lost them. Every consumer reads this view,
-- so none of them need to know the flag exists.
-- ---------------------------------------------------------------------
drop view if exists job_financials;

create view job_financials as
select
  j.id as job_id,
  case when j.direct_to_worker then 0 else fin.calculated_worker_payout end as calculated_worker_payout,
  case when j.direct_to_worker then 0 else fin.total_worker_payout      end as total_worker_payout,
  case when j.direct_to_worker then 0 else fin.other_costs_total        end as other_costs_total,
  case when j.direct_to_worker then 0 else fin.pos_fee_amount           end as pos_fee_amount,
  case when j.direct_to_worker then 0 else fin.commission_target        end as commission_target,
  case when j.direct_to_worker then 0 else fin.cag_target               end as cag_target,
  case when j.direct_to_worker then 0 else fin.target_total_invoice     end as target_total_invoice,
  case when j.direct_to_worker then 0 else fin.commission_amount        end as commission_amount,
  case when j.direct_to_worker then 0 else fin.cag_amount               end as cag_amount,
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
