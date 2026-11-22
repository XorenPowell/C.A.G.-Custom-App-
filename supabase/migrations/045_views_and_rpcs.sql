-- =====================================================================
-- 045 — views and functions for the role screens
-- Customers and workers never read the base tables, which hold money and
-- other people's data. They read these views, which return only the
-- columns their screen needs.
--
-- Two kinds of view, chosen on purpose:
--  * security_invoker views (staff use): they obey the caller's row-level
--    security, so staff see everything and everyone else sees nothing.
--  * own-row views (customer and worker use): they run with the owner's
--    rights so they can reach rows the caller could not read directly, and
--    each one filters strictly to the signed-in account. The filter in the
--    WHERE clause is the access control for these views. Do not remove it.
--
-- Safe to re-run.
-- =====================================================================

-- ---------- helper: when a job's crew may see the customer's details --
create or replace function job_arrival_at(p_job jobs) returns timestamptz
language sql immutable as $$
  select coalesce(
           (p_job.confirmed_arrival_date + coalesce(p_job.confirmed_arrival_time, time '00:00')),
           (p_job.arrival_date + coalesce(p_job.arrival_time, time '00:00')))::timestamptz;
$$;
comment on function job_arrival_at(jobs) is 'The job''s arrival moment: the confirmed one when set, else the arrival mirror.';

-- ---------- v_worker_jobs: a worker's own jobs --------------------------
-- Jobs offered to, or worked by, the signed-in worker's entity. Customer
-- contact details are hidden until contact_reveal_minutes before arrival.
-- Never shows invoices, commission, or other crew members' pay.
-- Workers see only their own offers' jobs through the view above; the
-- stop_count_only_placeholder column is removed in the next statement.
create or replace view v_worker_jobs as
select
  j.id                                  as job_id,
  j.job_id                              as job_number,
  j.title,
  j.status,
  j.arrival_date,
  j.arrival_time,
  j.estimated_duration_minutes,
  j.details                             as site_details,
  j.site_parking,
  j.site_access,
  j.site_rules,
  j.site_flags,
  case when job_arrival_at(j) - make_interval(mins => s.contact_reveal_minutes) <= now()
       then j.customer_name  end        as customer_name,
  case when job_arrival_at(j) - make_interval(mins => s.contact_reveal_minutes) <= now()
       then j.customer_phone end        as customer_phone,
  case when job_arrival_at(j) - make_interval(mins => s.contact_reveal_minutes) <= now()
       then (select array_agg(st.address order by st.position)
               from job_stops st where st.job_id = j.id) end as stop_addresses,
  my.entity_id,
  my.on_crew,
  my.released_at
from jobs j
cross join settings s
join lateral (
  select my_entity_id() as entity_id,
         exists (select 1 from job_workers w where w.job_id = j.id and w.entity_id = my_entity_id() and w.released_at is null) as on_crew,
         (select w.released_at from job_workers w where w.job_id = j.id and w.entity_id = my_entity_id()) as released_at
) my on true
where s.id = true
  and my.entity_id is not null
  and (
    my.on_crew
    or exists (select 1 from job_offers o
                where o.job_id = j.id and o.entity_id = my.entity_id
                  and o.outcome in ('offered','waiting'))
  );
comment on view v_worker_jobs is 'A worker''s own jobs: ones offered to them or on their crew. Contact details appear only inside the reveal window. Never shows money.';
grant select on v_worker_jobs to authenticated;

-- ---------- v_customer_jobs: a customer's own jobs ---------------------
-- Plain-word status, crew first names, and the payment status. Never payout,
-- commission, or internal notes.
create or replace view v_customer_jobs as
select
  j.id                                  as job_id,
  j.job_id                              as job_number,
  j.title,
  case j.status
    when 'Inquiry'     then 'Being looked at'
    when 'Assigning'   then 'Finding your crew'
    when 'Queued'      then 'Finding your crew'
    when 'Quoted'      then 'Quote sent'
    when 'Booked'      then 'Booked'
    when 'On the way'  then 'On the way'
    when 'Working'     then 'In progress'
    when 'Completed'   then 'Complete'
    when 'Cancelled'   then 'Cancelled'
    when 'Lost'        then 'Closed'
    when 'Rejected'    then 'Closed'
    else j.status
  end                                   as status_label,
  coalesce(j.confirmed_arrival_date, j.arrival_date) as arrival_date,
  coalesce(j.confirmed_arrival_time, j.arrival_time) as arrival_time,
  (select array_agg(st.address order by st.position) from job_stops st where st.job_id = j.id) as stop_addresses,
  (select array_agg(split_part(e.worker_names[1], ' ', 1))
     from job_workers w join entities e on e.id = w.entity_id
    where w.job_id = j.id and w.released_at is null and array_length(e.worker_names, 1) > 0) as crew_first_names,
  p.status                              as payment_status,
  p.square_link                         as payment_link,
  p.amount_invoiced                     as amount_invoiced
from jobs j
left join lateral (
  select * from customer_payments cp where cp.job_id = j.id order by cp.created_at desc limit 1
) p on true
where j.customer_profile_id = auth.uid();
comment on view v_customer_jobs is 'A customer''s own jobs. Plain status words, crew first names, and the payment link. Never payout, commission, or notes.';
grant select on v_customer_jobs to authenticated;

-- ---------- v_my_customer_details: the customer's own details -----------
-- Leaves out `notes`, which is staff-only.
create or replace view v_my_customer_details as
select cd.profile_id, cd.default_address, cd.customer_type
  from customer_details cd
 where cd.profile_id = auth.uid();
comment on view v_my_customer_details is 'The signed-in customer''s own details, without the staff-only notes column.';
grant select on v_my_customer_details to authenticated;

-- ---------- v_my_entity: a worker's own roster record -------------------
-- Leaves out payout_handle (admin only), reliability_notes and notes.
create or replace view v_my_entity as
select e.id, e.entity_name, e.entity_kind, e.worker_names, e.photo_path,
       e.home_address, e.uses_public_transport, e.payout_method, e.status
  from entities e
 where e.profile_id = auth.uid();
comment on view v_my_entity is 'The signed-in worker''s own roster record, without the admin-only payout handle and notes.';
grant select on v_my_entity to authenticated;

-- ---------- v_my_rating: a worker's own score ---------------------------
create or replace view v_my_rating as
select my_entity_id() as entity_id,
       greatest(0, least(10, 10 + coalesce(sum(re.delta), 0))) as rating
  from rating_events re
 where re.entity_id = my_entity_id()
 having my_entity_id() is not null;
comment on view v_my_rating is 'The signed-in worker''s own rating: 10 plus the sum of rating events, clamped to 0 to 10.';
grant select on v_my_rating to authenticated;

-- ---------- v2_entity_rating: the rating for staff ----------------------
create or replace view v2_entity_rating with (security_invoker = on) as
select e.id as entity_id,
       greatest(0, least(10, 10 + coalesce(sum(re.delta), 0))) as rating
  from entities e
  left join rating_events re on re.entity_id = e.id
 group by e.id;
comment on view v2_entity_rating is 'Current rating for every entity: 10 plus the sum of its rating events, clamped to 0 to 10. Staff only.';
grant select on v2_entity_rating to authenticated;

-- ---------- v2_dispatchable_entities: who may be offered jobs ----------
-- Active, with the required paperwork approved and not expired.
create or replace view v2_dispatchable_entities with (security_invoker = on) as
select e.id as entity_id
  from entities e
 where e.status = 'Active'
   and (
     select count(distinct d.doc_type)
       from entity_documents d
      where d.entity_id = e.id
        and d.status = 'approved'
        and d.doc_type in ('w9','ic_agreement','photo_id','background_check')
   ) = 4
   and not exists (
     select 1 from entity_documents d
      where d.entity_id = e.id
        and d.doc_type in ('drivers_license','vehicle_insurance')
        and (d.status <> 'approved' or (d.expires_on is not null and d.expires_on < current_date))
   );
comment on view v2_dispatchable_entities is 'Entities that may be offered jobs: active, with W-9, IC agreement, photo ID and background check approved, and any driver licence or vehicle insurance on file approved and in date.';
grant select on v2_dispatchable_entities to authenticated;

-- ---------- v2_job_worker_payout: per-seat pay with expenses -----------
-- The payout is V1's job_worker_pay. Expenses are shown beside it, not added:
-- whether they reimburse the worker on top of pay is an open decision.
create or replace view v2_job_worker_payout with (security_invoker = on) as
select p.*,
       coalesce(x.expenses_total, 0) as expenses_total
  from job_worker_pay p
  left join lateral (
    select sum(amount) as expenses_total from job_expenses where job_worker_id = p.job_worker_id
  ) x on true;
comment on view v2_job_worker_payout is 'Per crew seat: V1 pay plus a separate expenses_total. Expenses are not yet added to effective_pay.';
grant select on v2_job_worker_payout to authenticated;

-- ---------- v2_job_financials: invoice figures from snapshots ----------
-- Same arithmetic as V1 job_financials, but uses the rates snapshotted on the
-- job and the flat company fee from settings, so later rate changes do not
-- move a booked job.
create or replace view v2_job_financials with (security_invoker = on) as
select
  j.id as job_id,
  coalesce(p.payout, 0)                                                   as calculated_worker_payout,
  coalesce(j.total_worker_payout_override, p.payout, 0)                   as total_worker_payout,
  coalesce(oc.costs_total, 0)                                             as other_costs_total,
  j.flat_fee_snapshot                                                      as cag_fee,
  round((coalesce(j.total_worker_payout_override, p.payout, 0)
         + coalesce(oc.costs_total, 0) + j.flat_fee_snapshot)
        * j.commission_percent_snapshot / 100.0, 2)                        as commission_target,
  round((coalesce(j.total_worker_payout_override, p.payout, 0)
         + coalesce(oc.costs_total, 0) + j.flat_fee_snapshot)
        * j.pos_fee_percent / 100.0, 2)                                    as pos_fee_amount,
  round(j.total_invoice_paid * (1 - j.deposit_fee_snapshot / 100.0)
        - coalesce(j.total_worker_payout_override, p.payout, 0)
        - coalesce(oc.costs_total, 0)
        - j.flat_fee_snapshot, 2)                                          as commission_amount
from jobs j
left join lateral (select sum(effective_pay) as payout from job_worker_pay where job_id = j.id) p on true
left join lateral (select sum(amount) as costs_total from job_costs where job_id = j.id) oc on true;
comment on view v2_job_financials is 'V2 invoice figures for each job, using the job''s rate snapshots and the flat company fee. Staff only.';
grant select on v2_job_financials to authenticated;

-- ---------- v2_payouts_owed --------------------------------------------
create or replace view v2_payouts_owed with (security_invoker = on) as
select pa.id as payout_id, pa.job_worker_id, pa.status, pa.computed_amount,
       p.effective_pay as current_amount
  from payouts pa
  join job_worker_pay p on p.job_worker_id = pa.job_worker_id
 where pa.status = 'pending';
comment on view v2_payouts_owed is 'Pay not yet sent, with the current calculated amount beside the amount stored when it was marked.';
grant select on v2_payouts_owed to authenticated;

-- ---------- v2_worker_ytd: year-to-date paid per worker ---------------
create or replace view v2_worker_ytd with (security_invoker = on) as
select w.entity_id, extract(year from pa.marked_at)::int as pay_year,
       sum(pa.computed_amount) as paid_total
  from payouts pa
  join job_workers w on w.id = pa.job_worker_id
 where pa.status = 'sent'
 group by w.entity_id, extract(year from pa.marked_at);
comment on view v2_worker_ytd is 'Total paid per worker per calendar year, from payouts marked sent.';
grant select on v2_worker_ytd to authenticated;

-- ---------- v2_card_ledger: card stock ---------------------------------
-- One row. Stock = receipts - (drops + hand-outs + refills). The last count
-- and the difference from it are shown beside the expected stock.
create or replace view v2_card_ledger with (security_invoker = on) as
with receipts as (
  select coalesce(sum(quantity), 0) as received from card_receipts where kind = 'receipt'
),
drops as (
  select coalesce((select sum(cards_dropped) from activity), 0)
       + coalesce((select sum(cards_dropped) from face_to_face_conversations), 0)
       + coalesce((select sum(cards_added) from placement_refills), 0) as dropped
),
last_count as (
  select counted_total, received_on from card_receipts
   where kind = 'count' order by received_on desc, created_at desc limit 1
)
select
  r.received,
  d.dropped,
  r.received - d.dropped                                    as expected_stock,
  lc.counted_total                                          as last_count,
  lc.received_on                                            as last_count_on,
  case when lc.counted_total is null then null
       else lc.counted_total - (r.received - d.dropped) end as difference_from_last_count
from receipts r
cross join drops d
left join last_count lc on true
where is_staff();
comment on view v2_card_ledger is 'Card stock: receipts minus drops, hand-outs and refills, with the last physical count and its difference. A difference means cards are missing or were not logged.';
grant select on v2_card_ledger to authenticated;

-- ---------- v_work_queue: everything due, in time order ----------------
create or replace view v_work_queue with (security_invoker = on) as
select 'job'::text as source, j.id as ref_id, j.follow_up_kind as kind,
       j.follow_up_at as due_at, j.follow_up_note as note,
       j.customer_name as label
  from jobs j where j.follow_up_at is not null
union all
select 'partnership', p.id, p.follow_up_kind, p.follow_up_at, p.follow_up_note, p.business_name
  from partnerships p where p.follow_up_at is not null
union all
select 'scheduled', s.id, s.kind, s.due_at, s.note, null
  from scheduled_actions s
union all
select 'checklist', c.job_id, c.line_key, c.due_at, null, null
  from job_checklist_items c where c.done_at is null and c.due_at is not null
order by due_at;
comment on view v_work_queue is 'Everything due: job and partnership follow-ups, scheduled actions, and unsent checklist texts, in due-time order.';
grant select on v_work_queue to authenticated;

-- ---------- take_offer: a worker takes a job they were offered --------
create or replace function take_offer(p_job uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := my_entity_id();
  seats_needed_n int;
  seats_taken int;
begin
  if me is null then
    raise exception 'no worker record for this account';
  end if;

  -- Lock the job so two workers cannot both take the last seat.
  select seats_needed into seats_needed_n from jobs where id = p_job for update;
  if not found then
    raise exception 'job not found';
  end if;

  if not exists (select 1 from job_offers
                  where job_id = p_job and entity_id = me and outcome in ('offered','waiting')) then
    return 'already_gone';
  end if;

  select count(*) into seats_taken
    from job_workers where job_id = p_job and released_at is null;

  if seats_taken >= seats_needed_n then
    update job_offers set outcome = 'skipped', responded_at = now()
     where job_id = p_job and entity_id = me;
    return 'already_gone';
  end if;

  insert into job_workers (job_id, entity_id, assigned_via, assigned_at)
  values (p_job, me, 'offer', now());

  update job_offers set outcome = 'taken', responded_at = now()
   where job_id = p_job and entity_id = me;

  return 'taken';
end $$;
comment on function take_offer(uuid) is 'Takes a seat on a job the signed-in worker was offered. Returns taken, or already_gone when the job filled first. Locks the job row so the last seat cannot be double-booked.';
grant execute on function take_offer(uuid) to authenticated;

-- ---------- match_jobs_for_contact: find jobs for a new account ---------
create or replace function match_jobs_for_contact(p_name text, p_phone text, p_email text)
returns table (job_id uuid, job_number text, job_date date, service text, matched_on text[])
language plpgsql stable security definer set search_path = public as $$
declare
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if not is_local_admin() then
    raise exception 'only a local admin may match jobs to accounts';
  end if;

  return query
  select j.id,
         j.job_id,
         coalesce(j.date_of_invoice, j.arrival_date),
         sc.name,
         array_remove(array[
           case when digits <> '' and (
                  regexp_replace(coalesce(j.customer_phone,''), '\D', '', 'g') = digits
               or regexp_replace(coalesce(j.onsite_phone,''), '\D', '', 'g') = digits
           ) then 'phone' end,
           case when p_email is not null and p_email <> '' and (
                  lower(trim(coalesce(j.customer_email,''))) = lower(trim(p_email))
           ) then 'email' end,
           case when p_name is not null and p_name <> '' and (
                  lower(trim(coalesce(j.customer_name,''))) = lower(trim(p_name))
               or lower(trim(coalesce(j.onsite_name,''))) = lower(trim(p_name))
           ) then 'name' end
         ], null)
    from jobs j
    left join list_items sc on sc.id = j.service_category_id
   where j.customer_profile_id is null
     and (
          (digits <> '' and (regexp_replace(coalesce(j.customer_phone,''), '\D', '', 'g') = digits
                          or regexp_replace(coalesce(j.onsite_phone,''), '\D', '', 'g') = digits))
       or (p_email is not null and p_email <> '' and lower(trim(coalesce(j.customer_email,''))) = lower(trim(p_email)))
       or (p_name is not null and p_name <> '' and (lower(trim(coalesce(j.customer_name,''))) = lower(trim(p_name))
                                                 or lower(trim(coalesce(j.onsite_name,''))) = lower(trim(p_name))))
     )
   order by coalesce(j.date_of_invoice, j.arrival_date) desc nulls last;
end $$;
comment on function match_jobs_for_contact(text, text, text) is 'Finds unlinked jobs whose payer or on-site contact matches a name, phone or email. Name alone is shown as a match but never links without an admin choosing it. Local admin only.';
grant execute on function match_jobs_for_contact(text, text, text) to authenticated;

-- ---------- link_jobs_to_account: link chosen jobs to a customer -------
create or replace function link_jobs_to_account(p_profile uuid, p_job_ids uuid[])
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if not is_local_admin() then
    raise exception 'only a local admin may link jobs to accounts';
  end if;

  update jobs
     set customer_profile_id = p_profile,
         customer_linked_by  = auth.uid(),
         customer_linked_at  = now(),
         customer_linked_via = 'admin'
   where id = any(p_job_ids);
  get diagnostics n = row_count;
  return n;
end $$;
comment on function link_jobs_to_account(uuid, uuid[]) is 'Links the chosen jobs to a customer account and records that an admin did it. Local admin only.';
grant execute on function link_jobs_to_account(uuid, uuid[]) to authenticated;
