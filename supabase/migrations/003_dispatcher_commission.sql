-- =====================================================================
-- 003 — Dispatcher commission replaces business profit
--
-- The dispatcher's take on a job is a flat percent of the worker payout,
-- capped in dollars — not the old invoice-minus-costs "profit". It is
-- deliberately independent of the invoice, the POS fee and other job
-- costs. The old profit figure is not tracked anywhere right now (that is
-- an admin-view concern for later); this replaces it everywhere it showed.
--
-- POS fee % and other job costs are untouched — they keep being tracked
-- exactly as before, they just no longer feed this figure.
--
-- Because this is a view column (never stored), every existing job's
-- commission recalculates the moment this runs — that is expected.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table settings add column if not exists default_commission_percent numeric(6,3)  not null default 5.0;
alter table settings add column if not exists default_commission_cap     numeric(12,2) not null default 50.0;

alter table jobs add column if not exists commission_percent numeric(6,3)  not null default 5.0;
alter table jobs add column if not exists commission_cap     numeric(12,2) not null default 50.0;

-- `create or replace view` cannot drop/rename an existing column (`profit`),
-- so the view is dropped and recreated. This only touches the saved query,
-- not the underlying tables — no data is affected.
drop view if exists job_financials;

create view job_financials as
select
  j.id as job_id,
  coalesce(p.payout, 0)                                     as calculated_worker_payout,
  coalesce(j.total_worker_payout_override, p.payout, 0)     as total_worker_payout,
  round(j.total_invoice_paid * j.pos_fee_percent / 100.0, 2) as pos_fee_amount,
  coalesce(j.total_worker_payout_override, p.payout, 0)
    + round(j.total_invoice_paid * j.pos_fee_percent / 100.0, 2)
    + j.other_job_costs                                     as total_job_costs,
  least(
    round(coalesce(j.total_worker_payout_override, p.payout, 0) * j.commission_percent / 100.0, 2),
    j.commission_cap
  )                                                          as commission_amount,
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
left join lateral (
  select sum(effective_pay) as payout
  from job_worker_pay
  where job_id = j.id
) p on true;

alter view job_financials set (security_invoker = on);
grant select on job_financials to authenticated;
