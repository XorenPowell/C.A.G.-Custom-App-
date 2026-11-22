-- =====================================================================
-- 048 — role access fixes
-- Closes the gaps found when 034–047 were checked against V2_DATA_MAP.md:
--
--  1. Customers can now request a job (also without an account), accept a
--     quote and sign the customer agreement, and raise a change or cancel
--     request. Their job view now carries the quote and the crew.
--  2. Self sign-up: a new login gets a customer profile, and past jobs link
--     automatically once the matching phone or email is verified, each
--     channel on its own (canvas 2.10.1).
--  3. Workers get the job view the Figma screens need, their own payouts and
--     rates, Something's up, "I can't make it", and slides that move the job
--     through On the way → Working → Completed and fill in their hours.
--  4. Customers and workers can read the dropdown lists and the service
--     questions (guests can read the service list for the request form).
--  5. Customer details unlock for the crew in Chicago time, not UTC.
--  6. Customers can see their job photos.
--  7. Only a Local Admin can mark payouts sent or correct them (canvas 5.5.3).
--  8. Crew leader and point of contact are two separate roles (canvas 2.2.3).
--  9. Workers can add slides, photos and expenses but never edit or delete
--     them (canvas 2.1.4: the original times are kept).
-- 10. Customer status words match the canvas (canvas 2.1.1).
--
-- Additive: nothing the browser app reads is renamed or dropped. The V2
-- views v_worker_jobs, v_customer_jobs and v_my_entity are rebuilt (only the
-- phone app reads them). Safe to re-run.
-- =====================================================================


-- =====================================================================
-- Helpers
-- =====================================================================

-- Last 10 digits of a phone number, so "(312) 555-0142" and "+13125550142" match.
create or replace function phone_key(p text) returns text
language sql immutable as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10);
$$;
comment on function phone_key(text) is 'Last 10 digits of a phone number; used to match phones written in different formats.';

-- (5) When the crew may see the customer: arrival is Chicago local time.
create or replace function job_arrival_at(p_job jobs) returns timestamptz
language sql stable as $$
  select case
           when p_job.confirmed_arrival_date is not null
             then (p_job.confirmed_arrival_date + coalesce(p_job.confirmed_arrival_time, time '00:00'))
           else (p_job.arrival_date + coalesce(p_job.arrival_time, time '00:00'))
         end at time zone 'America/Chicago';
$$;
comment on function job_arrival_at(jobs) is 'The job''s arrival as a real moment in time, reading the stored date and time as Chicago local time.';

-- The jobs linked to the signed-in customer. Customers cannot read jobs
-- directly, so policies call this instead of a subquery.
create or replace function my_customer_job_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from jobs where customer_profile_id = auth.uid();
$$;
comment on function my_customer_job_ids() is 'Ids of the jobs linked to the signed-in customer account.';


-- =====================================================================
-- (8) Crew leader and point of contact are separate
-- =====================================================================
alter table job_workers add column if not exists is_point_of_contact boolean not null default false;
comment on column job_workers.is_point_of_contact is 'The crew member responsible for staying in touch (canvas 2.2.3). Separate from is_leader, the job leader.';

-- V1 used is_leader to mean "whose phone represents the job", which is the
-- point of contact. Copy it across once so nothing is lost.
update job_workers set is_point_of_contact = true
 where is_leader and not is_point_of_contact
   and not exists (select 1 from job_workers o where o.job_id = job_workers.job_id and o.is_point_of_contact);

create unique index if not exists job_workers_point_of_contact_idx on job_workers (job_id) where is_point_of_contact;


-- =====================================================================
-- (7) Payouts: staff read, Local Admin writes
-- =====================================================================
drop policy if exists payouts_staff_all on payouts;
drop policy if exists payouts_staff_read on payouts;
create policy payouts_staff_read on payouts
  for select to authenticated using (is_staff());
drop policy if exists payouts_admin_write on payouts;
create policy payouts_admin_write on payouts
  for all to authenticated using (is_local_admin()) with check (is_local_admin());

drop policy if exists payout_corrections_staff_all on payout_corrections;
drop policy if exists payout_corrections_staff_read on payout_corrections;
create policy payout_corrections_staff_read on payout_corrections
  for select to authenticated using (is_staff());
drop policy if exists payout_corrections_admin_write on payout_corrections;
create policy payout_corrections_admin_write on payout_corrections
  for all to authenticated using (is_local_admin()) with check (is_local_admin());


-- =====================================================================
-- (9) Workers add records but never change them
-- =====================================================================
drop policy if exists job_slides_own on job_slides;
drop policy if exists job_slides_own_read on job_slides;
create policy job_slides_own_read on job_slides
  for select to authenticated using (job_worker_id in (select my_job_worker_ids()));
drop policy if exists job_slides_own_insert on job_slides;
create policy job_slides_own_insert on job_slides
  for insert to authenticated with check (job_worker_id in (select my_job_worker_ids()));

drop policy if exists job_photos_own on job_photos;
drop policy if exists job_photos_own_insert on job_photos;
create policy job_photos_own_insert on job_photos
  for insert to authenticated with check (job_worker_id in (select my_job_worker_ids()));
-- (6) The whole crew and the job's customer can see the job's photos.
drop policy if exists job_photos_crew_read on job_photos;
create policy job_photos_crew_read on job_photos
  for select to authenticated using (job_id in (select my_job_ids()));
drop policy if exists job_photos_customer_read on job_photos;
create policy job_photos_customer_read on job_photos
  for select to authenticated using (job_id in (select my_customer_job_ids()));

drop policy if exists job_expenses_own on job_expenses;
drop policy if exists job_expenses_own_read on job_expenses;
create policy job_expenses_own_read on job_expenses
  for select to authenticated using (job_worker_id in (select my_job_worker_ids()));
drop policy if exists job_expenses_own_insert on job_expenses;
create policy job_expenses_own_insert on job_expenses
  for insert to authenticated with check (job_worker_id in (select my_job_worker_ids()));

-- (6) Storage: the customer rule in 047 read the jobs table, which
-- customers cannot see. Use the helper instead.
drop policy if exists storage_customer_job_photos on storage.objects;
create policy storage_customer_job_photos on storage.objects
  for select to authenticated
  using (bucket_id = 'job-photos'
         and (storage.foldername(name))[1] in (select my_customer_job_ids()::text));


-- =====================================================================
-- (4) Lists and service questions are readable by everyone who needs them
-- =====================================================================
drop policy if exists list_items_read on list_items;
create policy list_items_read on list_items
  for select to authenticated using (true);
drop policy if exists list_items_guest_read on list_items;
create policy list_items_guest_read on list_items
  for select to anon using (kind = 'service_category' and not archived);

drop policy if exists category_questions_read on category_questions;
create policy category_questions_read on category_questions
  for select to authenticated, anon using (not archived);

-- The few settings the phone app needs, without exposing fees or goals.
create or replace view v_app_settings as
select dispatch_wait_seconds, contact_reveal_minutes, rating_threshold, expiring_soon_days, crew_cap
  from settings
 where id = true;
comment on view v_app_settings is 'Settings the phone app needs (offer countdown, contact reveal, rating threshold). Leaves out fees and goals.';
grant select on v_app_settings to authenticated;


-- =====================================================================
-- (2) Self sign-up: profile on sign-up, job linking on verification
-- =====================================================================
alter table jobs drop constraint if exists jobs_customer_linked_via_check;
alter table jobs add constraint jobs_customer_linked_via_check check (
  customer_linked_via is null
  or customer_linked_via in ('admin','phone_verified','email_verified','self_request'));

-- Every new login starts as a customer. The Local Admin's create-account
-- server function then sets the real role (worker, dispatcher, local_admin)
-- with the service role, and removes the customer_details row if not a customer.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, full_name, phone, email)
  values (new.id,
          'customer',
          coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, ''), '@', 1), 'Customer'),
          coalesce(new.phone, new.raw_user_meta_data->>'phone'),
          new.email)
  on conflict (id) do nothing;

  insert into customer_details (profile_id)
  select new.id where exists (select 1 from profiles where id = new.id and role = 'customer')
  on conflict (profile_id) do nothing;
  return new;
end $$;
comment on function handle_new_user() is 'Creates a customer profile for every new login. The admin create-account flow changes the role afterwards.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Links unlinked jobs to a customer by whichever channels are verified.
-- A job that matches only the email waits until the email is confirmed;
-- the same for phone. Name never links on its own.
create or replace function link_verified_jobs(p_user uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
  v_email text;
  v_phone_ok boolean;
  v_email_ok boolean;
  v_n integer := 0;
  v_m integer := 0;
begin
  if not exists (select 1 from profiles where id = p_user and role = 'customer' and status = 'active') then
    return 0;
  end if;

  select phone_key(u.phone), lower(trim(coalesce(u.email, ''))),
         u.phone_confirmed_at is not null, u.email_confirmed_at is not null
    into v_phone, v_email, v_phone_ok, v_email_ok
    from auth.users u where u.id = p_user;

  if v_phone_ok and length(v_phone) = 10 then
    update jobs
       set customer_profile_id = p_user, customer_linked_at = now(), customer_linked_via = 'phone_verified'
     where customer_profile_id is null
       and (phone_key(customer_phone) = v_phone or phone_key(onsite_phone) = v_phone);
    get diagnostics v_n = row_count;
  end if;

  if v_email_ok and v_email <> '' then
    update jobs
       set customer_profile_id = p_user, customer_linked_at = now(), customer_linked_via = 'email_verified'
     where customer_profile_id is null
       and lower(trim(coalesce(customer_email, ''))) = v_email;
    get diagnostics v_m = row_count;
  end if;

  return v_n + v_m;
end $$;
comment on function link_verified_jobs(uuid) is 'Links past jobs to a customer by their verified phone and/or verified email (canvas 2.10.1).';
revoke execute on function link_verified_jobs(uuid) from public, anon, authenticated;

create or replace function on_auth_user_verified() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.phone_confirmed_at is not null and old.phone_confirmed_at is null)
     or (new.email_confirmed_at is not null and old.email_confirmed_at is null) then
    perform link_verified_jobs(new.id);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_verified on auth.users;
create trigger on_auth_user_verified after update of phone_confirmed_at, email_confirmed_at on auth.users
  for each row execute function on_auth_user_verified();


-- =====================================================================
-- (1) Customer actions
-- =====================================================================

-- A customer (signed in or a guest) sends the request form (canvas 3.2.2).
-- p_window: 'Morning' | 'Afternoon' | 'Evening' | 'Specific' (then p_time).
create or replace function create_job_request(
  p_name text, p_phone text, p_email text,
  p_service_category_id uuid, p_answers jsonb,
  p_stops text[], p_date date, p_window text, p_time time,
  p_parking text, p_access text, p_rules text, p_flags jsonb,
  p_description text,
  p_onsite_same boolean, p_onsite_name text, p_onsite_phone text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_is_customer boolean := exists (select 1 from profiles where id = auth.uid() and role = 'customer' and status = 'active');
  v_job uuid;
  v_number text;
  v_start time;
  v_end time;
  v_i integer;
begin
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' then
    raise exception 'name and phone are required';
  end if;
  if p_date is null then
    raise exception 'a date is required';
  end if;
  if p_stops is null or array_length(array_remove(p_stops, ''), 1) is null then
    raise exception 'at least one address is required';
  end if;

  v_start := case p_window when 'Morning' then time '08:00' when 'Afternoon' then time '12:00'
                           when 'Evening' then time '17:00' when 'Specific' then p_time end;
  v_end   := case p_window when 'Morning' then time '12:00' when 'Afternoon' then time '17:00'
                           when 'Evening' then time '20:00' when 'Specific' then p_time end;

  insert into jobs (
    customer_name, customer_phone, customer_email, customer_type,
    service_category_id, category_answers, customer_description,
    site_parking, site_access, site_rules, site_flags,
    onsite_same_as_payer, onsite_name, onsite_phone,
    inquiry_source_id, status, follow_up_at, follow_up_note,
    customer_profile_id, customer_linked_at, customer_linked_via
  ) values (
    trim(p_name), trim(p_phone), nullif(trim(coalesce(p_email, '')), ''),
    (select customer_type from customer_details where profile_id = v_me),
    p_service_category_id, coalesce(p_answers, '{}'::jsonb), p_description,
    p_parking, p_access, p_rules, coalesce(p_flags, '{}'::jsonb),
    coalesce(p_onsite_same, true),
    case when coalesce(p_onsite_same, true) then null else p_onsite_name end,
    case when coalesce(p_onsite_same, true) then null else p_onsite_phone end,
    (select id from list_items where kind = 'inquiry_source' and lower(name) in ('app','mobile app','website') order by sort_order limit 1),
    'Inquiry', now(), 'New request — review & quote',
    case when v_is_customer then v_me end,
    case when v_is_customer then now() end,
    case when v_is_customer then 'self_request' end
  )
  returning id, job_id into v_job, v_number;

  v_i := 0;
  for v_i in 1 .. array_length(p_stops, 1) loop
    if coalesce(trim(p_stops[v_i]), '') <> '' then
      insert into job_stops (job_id, position, address)
      values (v_job, (select count(*) from job_stops where job_id = v_job), trim(p_stops[v_i]));
    end if;
  end loop;

  insert into job_arrival_windows (job_id, sort_order, date, start_time, end_time)
  values (v_job, 0, p_date, v_start, v_end);

  insert into job_checklist_items (job_id, line_key, due_at)
  values (v_job, 'inquiry_received', now())
  on conflict (job_id, line_key) do nothing;

  return jsonb_build_object('job_id', v_job, 'job_number', v_number);
end $$;
comment on function create_job_request(text,text,text,uuid,jsonb,text[],date,text,time,text,text,text,jsonb,text,boolean,text,text)
  is 'The customer request form (signed in or guest). Creates an Inquiry with its stops, preferred window and the first checklist line.';
grant execute on function create_job_request(text,text,text,uuid,jsonb,text[],date,text,time,text,text,text,jsonb,text,boolean,text,text) to anon, authenticated;

-- The customer accepts the quote; on their first job they also sign the
-- current customer agreement (canvas 2.1.3 step 6, 2.7.2).
create or replace function accept_quote(p_job uuid, p_signed_name text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_text uuid;
begin
  select status into v_status from jobs
   where id = p_job and customer_profile_id = auth.uid()
   for update;
  if not found then
    raise exception 'job not found';
  end if;
  if v_status <> 'Quoted' then
    raise exception 'this quote is no longer open';
  end if;

  if not exists (select 1 from signed_agreements sa join agreement_texts t on t.id = sa.agreement_text_id
                  where sa.profile_id = auth.uid() and t.kind = 'customer') then
    select id into v_text from agreement_texts
     where kind = 'customer' and effective_from <= current_date
     order by effective_from desc limit 1;
    if v_text is not null then
      if coalesce(trim(p_signed_name), '') = '' then
        return 'agreement_required';
      end if;
      insert into signed_agreements (agreement_text_id, profile_id, job_id, signed_name)
      values (v_text, auth.uid(), p_job, trim(p_signed_name))
      on conflict (profile_id, agreement_text_id) do nothing;
    end if;
  end if;

  update jobs
     set status = 'Booked', quote_accepted_at = now(),
         follow_up_at = now(), follow_up_note = 'Quote accepted — confirm the crew'
   where id = p_job;
  return 'booked';
end $$;
comment on function accept_quote(uuid, text) is 'Customer accepts a quote. Returns agreement_required when they still need to sign the customer agreement, else books the job.';
grant execute on function accept_quote(uuid, text) to authenticated;

-- A customer or a crew member raises something with the dispatcher
-- (customer: change / cancel / problem; worker: Something's up).
create or replace function raise_job_event(p_job uuid, p_kind text, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_customer boolean := p_job in (select my_customer_job_ids());
  v_crew boolean := exists (select 1 from job_workers w where w.job_id = p_job and w.entity_id = my_entity_id() and w.released_at is null);
  v_id uuid;
begin
  if not (is_staff()
          or (v_customer and p_kind in ('change_request','cancel_request','problem'))
          or (v_crew and p_kind in ('problem','running_late','cant_get_in','job_bigger','damage'))) then
    raise exception 'not allowed to raise % on this job', p_kind;
  end if;

  insert into job_events (job_id, kind, body, raised_by)
  values (p_job, p_kind, p_body, auth.uid())
  returning id into v_id;

  -- Puts it at the top of the dispatcher's work queue.
  update jobs set follow_up_at = now(),
                  follow_up_note = replace(initcap(replace(p_kind, '_', ' ')), 'Cant', 'Can''t')
                                   || coalesce(': ' || left(p_body, 120), '')
   where id = p_job;
  return v_id;
end $$;
comment on function raise_job_event(uuid, text, text) is 'Customer change/cancel/problem requests and worker Something''s up. Logs the event and puts it in the dispatcher''s work queue.';
grant execute on function raise_job_event(uuid, text, text) to authenticated;


-- =====================================================================
-- (3) Worker actions
-- =====================================================================

-- Raw hours for one crew seat from its slides, in 15-minute steps:
-- travel = online → first arrival; regular = first arrival → complete.
create or replace function slide_hours(p_job_worker uuid)
returns table (travel_hours numeric, regular_hours numeric)
language sql stable security definer set search_path = public as $$
  with s as (
    select min(occurred_at) filter (where kind = 'online')   as t_online,
           min(occurred_at) filter (where kind = 'arrive')   as t_arrive,
           max(occurred_at) filter (where kind = 'complete') as t_complete
      from job_slides where job_worker_id = p_job_worker
  )
  select case when t_online is not null and t_arrive is not null
              then greatest(0.25, ceil(extract(epoch from (t_arrive - t_online)) / 900.0) / 4) else 0 end,
         case when t_arrive is not null and t_complete is not null
              then greatest(0.25, ceil(extract(epoch from (t_complete - t_arrive)) / 900.0) / 4) else 0 end
    from s;
$$;
revoke execute on function slide_hours(uuid) from public, anon, authenticated;

-- Public version: staff, or the worker for their own seat.
create or replace function hours_from_slides(p_job_worker uuid)
returns table (travel_hours numeric, regular_hours numeric)
language sql stable security definer set search_path = public as $$
  select h.travel_hours, h.regular_hours
    from slide_hours(p_job_worker) h
   where is_staff() or p_job_worker in (select my_job_worker_ids());
$$;
comment on function hours_from_slides(uuid) is 'Travel and regular hours for one crew seat, from its slide times, in 15-minute steps (canvas 2.1.4).';
grant execute on function hours_from_slides(uuid) to authenticated;

-- Slides move the job along: going online → On the way; when every active
-- crew member has completed → Completed, hours filled in, payouts opened.
create or replace function on_job_slide() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_job uuid;
  v_status text;
  v_open integer;
  v_done integer;
  h record;
begin
  select w.job_id into v_job from job_workers w where w.id = new.job_worker_id;
  select status into v_status from jobs where id = v_job for update;

  if new.kind = 'online' and v_status = 'Booked' then
    update jobs set status = 'On the way' where id = v_job;

  elsif new.kind = 'complete' then
    -- This seat's hours from its own slides, unless a dispatcher corrected them.
    select * into h from slide_hours(new.job_worker_id);
    update job_workers w
       set travel_hours  = h.travel_hours,
           regular_hours = h.regular_hours,
           regular_rate  = case when w.regular_rate = 0 then coalesce(
                             (select r.regular_rate from entity_rates r join jobs j on j.id = w.job_id
                               where r.entity_id = w.entity_id and r.service_category_id = j.service_category_id), 0)
                           else w.regular_rate end,
           travel_rate   = case when w.travel_rate = 0 then coalesce(
                             (select r.travel_rate from entity_rates r join jobs j on j.id = w.job_id
                               where r.entity_id = w.entity_id and r.service_category_id = j.service_category_id), 0)
                           else w.travel_rate end
     where w.id = new.job_worker_id and w.hours_corrected_at is null;

    select count(*) filter (where w.released_at is null),
           count(*) filter (where w.released_at is null
                              and exists (select 1 from job_slides s where s.job_worker_id = w.id and s.kind = 'complete'))
      into v_open, v_done
      from job_workers w where w.job_id = v_job;

    if v_open > 0 and v_open = v_done and v_status in ('Booked','On the way','Working') then
      update jobs set status = 'Completed', follow_up_at = now(),
                      follow_up_note = 'Job done — send sign-off and the Square invoice'
       where id = v_job;
      insert into payouts (job_worker_id)
      select w.id from job_workers w where w.job_id = v_job and w.released_at is null
      on conflict (job_worker_id) do nothing;
    end if;
  end if;
  return new;
end $$;
comment on function on_job_slide() is 'Moves the job to On the way when a crew member goes online, and to Completed (with hours and payouts) when the whole crew has completed.';

drop trigger if exists job_slides_progress on job_slides;
create trigger job_slides_progress after insert on job_slides
  for each row execute function on_job_slide();

-- The before photo at the first stop starts Working (Figma job detail 3 → 4).
create or replace function on_job_photo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'before' then
    update jobs set status = 'Working' where id = new.job_id and status = 'On the way';
  end if;
  return new;
end $$;

drop trigger if exists job_photos_progress on job_photos;
create trigger job_photos_progress after insert on job_photos
  for each row execute function on_job_photo();

-- "I can't make it": the worker gives their seat back (canvas 2.2.5, 7).
create or replace function give_back_job(p_job uuid, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_seat uuid;
  v_rule record;
begin
  select id into v_seat from job_workers
   where job_id = p_job and entity_id = my_entity_id() and released_at is null
   for update;
  if v_seat is null then
    raise exception 'you are not on this job';
  end if;
  if exists (select 1 from jobs where id = p_job and status in ('On the way','Working','Completed')) then
    raise exception 'this job has already started — use Something''s up instead';
  end if;

  update job_workers set released_at = now(), is_leader = false, is_point_of_contact = false where id = v_seat;

  insert into job_events (job_id, kind, body, raised_by)
  values (p_job, 'give_back', p_note, auth.uid());

  update jobs
     set status = case when status = 'Assigning' then 'Queued' else status end,
         queued_at = now(), follow_up_at = now(), follow_up_note = 'A worker gave their seat back — fill the crew'
   where id = p_job;

  select id, delta into v_rule from rating_rules where event_key = 'give_back' and active;
  if found then
    insert into rating_events (entity_id, rule_id, delta, job_id, created_by)
    values (my_entity_id(), v_rule.id, v_rule.delta, p_job, auth.uid());
  end if;
  return 'released';
end $$;
comment on function give_back_job(uuid, text) is 'Worker gives their seat back before the job starts. Alerts the dispatcher and applies the give_back rating rule if one exists.';
grant execute on function give_back_job(uuid, text) to authenticated;

-- Take an offer, or a seat from the job queue (canvas 2.2.4). Replaces 045's
-- version, which only allowed jobs with a live offer.
create or replace function take_offer(p_job uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := my_entity_id();
  v_seats int;
  v_taken int;
  v_status text;
begin
  if me is null then
    raise exception 'no worker record for this account';
  end if;

  select seats_needed, status into v_seats, v_status from jobs where id = p_job for update;
  if not found then
    raise exception 'job not found';
  end if;

  if not (exists (select 1 from job_offers where job_id = p_job and entity_id = me and outcome = 'offered')
          or (v_status = 'Queued' and exists (select 1 from job_pool where job_id = p_job and entity_id = me))) then
    return 'already_gone';
  end if;
  if exists (select 1 from job_workers where job_id = p_job and entity_id = me and released_at is null) then
    return 'taken';
  end if;

  select count(*) into v_taken from job_workers where job_id = p_job and released_at is null;
  if v_taken >= v_seats then
    update job_offers set outcome = 'skipped', responded_at = now()
     where job_id = p_job and entity_id = me and outcome in ('offered','waiting');
    return 'already_gone';
  end if;

  insert into job_workers (job_id, entity_id, assigned_via, assigned_at, is_leader, is_point_of_contact)
  values (p_job, me, case when v_status = 'Queued' then 'queue' else 'offer' end, now(),
          v_taken = 0, v_taken = 0);

  update job_offers set outcome = 'taken', responded_at = now()
   where job_id = p_job and entity_id = me and outcome in ('offered','waiting');

  if v_taken + 1 >= v_seats then
    update jobs set status = case when status = 'Queued' then 'Assigning' else status end,
                    follow_up_at = now(), follow_up_note = 'Crew filled — send the quote'
     where id = p_job;
  end if;
  return 'taken';
end $$;
grant execute on function take_offer(uuid) to authenticated;


-- =====================================================================
-- (3) Worker views — own rows only (run with owner rights; the WHERE
-- clause on my_entity_id() is the access control: do not remove it)
-- =====================================================================
drop view if exists v_worker_jobs;
create view v_worker_jobs as
select
  j.id                                                     as job_id,
  j.job_id                                                 as job_number,
  coalesce(j.title, sc.name)                               as title,
  sc.name                                                  as service,
  z.name                                                   as zone,
  j.status,
  case
    when seat.id is null and o.outcome = 'offered'                 then 'Offered'
    when seat.id is null and j.status = 'Queued'                   then 'In the queue'
    when j.status in ('Assigning','Queued','Quoted')               then 'Pending'
    when j.status = 'Booked'                                       then 'Scheduled'
    else j.status
  end                                                      as worker_status,
  coalesce(j.confirmed_arrival_date, j.arrival_date)       as job_date,
  coalesce(j.confirmed_arrival_time, j.arrival_time)       as arrival_time,
  j.confirmed_arrival_end_time                             as arrival_end_time,
  seat.be_online_by,
  seat.id                                                  as my_job_worker_id,
  coalesce(seat.is_leader, false)                          as my_is_leader,
  coalesce(seat.is_point_of_contact, false)                as my_is_point_of_contact,
  (seat.id is not null)                                    as on_crew,
  o.outcome                                                as offer_outcome,
  o.offered_at,
  o.expires_at,
  j.seats_needed,
  (select count(*) from job_stops st where st.job_id = j.id) as stop_count,
  rv.revealed,
  case when rv.revealed then
    case when j.onsite_same_as_payer then j.customer_name else coalesce(j.onsite_name, j.customer_name) end
  end                                                      as customer_name,
  case when rv.revealed then
    case when j.onsite_same_as_payer then j.customer_phone else coalesce(j.onsite_phone, j.customer_phone) end
  end                                                      as customer_phone,
  case when rv.revealed then
    (select array_agg(st.address order by st.position) from job_stops st where st.job_id = j.id)
  end                                                      as stop_addresses,
  j.site_parking,
  j.site_access,
  j.site_rules,
  j.site_flags,
  j.details                                                as site_details,
  j.customer_description                                   as description,
  j.category_answers,
  (select array_agg(coalesce(n.item_name, li.name) || case when n.quantity > 1 then ' ×' || n.quantity else '' end order by n.created_at)
     from job_needs n left join list_items li on li.id = n.list_item_id
    where n.job_id = j.id)                                 as needs,
  (select jsonb_agg(jsonb_build_object(
            'name', coalesce(p.full_name, e.entity_name),
            'is_leader', cw.is_leader,
            'is_point_of_contact', cw.is_point_of_contact,
            'is_me', cw.entity_id = me.eid,
            'phone', case when rv.revealed then coalesce(p.phone, e.poc_phone) end)
          order by cw.sort_order, cw.created_at)
     from job_workers cw
     join entities e on e.id = cw.entity_id
     left join profiles p on p.id = e.profile_id
    where cw.job_id = j.id and cw.released_at is null)     as crew,
  case
    when seat.id is not null and coalesce(pay.effective_pay, 0) > 0 then pay.effective_pay
    else round(coalesce(j.quote_est_hours, j.estimated_duration_minutes / 60.0) * r.regular_rate, 2)
  end                                                      as estimated_pay,
  d.full_name                                              as dispatcher_name,
  d.phone                                                  as dispatcher_phone
from jobs j
cross join (select my_entity_id() as eid) me
cross join settings s
left join lateral (
  select w.* from job_workers w
   where w.job_id = j.id and w.entity_id = me.eid and w.released_at is null
   order by w.created_at desc limit 1
) seat on true
left join lateral (
  select o2.* from job_offers o2
   where o2.job_id = j.id and o2.entity_id = me.eid
   order by o2.created_at desc limit 1
) o on true
left join job_worker_pay pay on pay.job_worker_id = seat.id
left join list_items sc on sc.id = j.service_category_id
left join list_items z on z.id = j.zone_id
left join entity_rates r on r.entity_id = me.eid and r.service_category_id = j.service_category_id
left join profiles d on d.id = j.owner_dispatcher_id
cross join lateral (
  select (j.status in ('On the way','Working','Completed')
          or job_arrival_at(j) - make_interval(mins => s.contact_reveal_minutes) <= now()) as revealed
) rv
where s.id = true
  and me.eid is not null
  and (
    seat.id is not null
    or o.outcome = 'offered'
    or (j.status = 'Queued' and exists (select 1 from job_pool jp where jp.job_id = j.id and jp.entity_id = me.eid))
  );
comment on view v_worker_jobs is 'The signed-in worker''s offers, queue seats and jobs. Customer name, phone and addresses stay hidden until contact_reveal_minutes before arrival (Chicago time). No invoice, commission or other crew members'' pay.';
grant select on v_worker_jobs to authenticated;

-- The worker's own payouts, one row per completed job (Earnings screen).
create or replace view v_my_payouts as
select
  j.id                                   as job_id,
  j.job_id                               as job_number,
  coalesce(j.title, sc.name)             as title,
  j.completed_at,
  w.id                                   as job_worker_id,
  coalesce(w.regular_hours, 0) + coalesce(w.travel_hours, 0) as hours,
  coalesce(pay.effective_pay, 0)         as amount,
  coalesce(x.expenses_total, 0)          as expenses_total,
  coalesce(pa.status, 'pending')         as status,
  pa.sent_on,
  pa.method
from job_workers w
join jobs j on j.id = w.job_id
left join list_items sc on sc.id = j.service_category_id
left join job_worker_pay pay on pay.job_worker_id = w.id
left join payouts pa on pa.job_worker_id = w.id
left join lateral (select sum(amount) as expenses_total from job_expenses where job_worker_id = w.id) x on true
where w.entity_id = my_entity_id()
  and w.released_at is null
  and j.status = 'Completed';
comment on view v_my_payouts is 'The signed-in worker''s pay for each completed job and whether it has been sent.';
grant select on v_my_payouts to authenticated;

-- The worker's own rates per service (My profile).
create or replace view v_my_rates as
select sc.name as service, r.regular_rate, r.travel_rate, r.other_rate
  from entity_rates r
  join list_items sc on sc.id = r.service_category_id
 where r.entity_id = my_entity_id();
comment on view v_my_rates is 'The signed-in worker''s hourly rates per service.';
grant select on v_my_rates to authenticated;

-- The worker's own roster record, now with their payout handle (they set it).
drop view if exists v_my_entity;
create view v_my_entity as
select e.id, e.entity_name, e.entity_kind, e.worker_names, e.photo_path,
       e.home_address, e.uses_public_transport, e.payout_method, e.payout_handle, e.status,
       (select array_agg(li.name) from list_items li where li.id = any(e.vehicle_type_ids)) as vehicles,
       (select array_agg(eq.item_name order by eq.sort_order) from entity_equipment eq where eq.entity_id = e.id) as equipment
  from entities e
 where e.profile_id = auth.uid();
comment on view v_my_entity is 'The signed-in worker''s roster record. Leaves out reliability and internal notes.';
grant select on v_my_entity to authenticated;


-- =====================================================================
-- (1, 10) Customer job view — own rows only (owner rights; the WHERE
-- clause on auth.uid() is the access control: do not remove it)
-- =====================================================================
drop view if exists v_customer_jobs;
create view v_customer_jobs as
select
  j.id                                                     as job_id,
  j.job_id                                                 as job_number,
  coalesce(j.title, sc.name)                               as title,
  sc.name                                                  as service,
  j.status,
  case j.status
    when 'Inquiry'    then 'Inquiry sent'
    when 'Assigning'  then 'Inquiry sent'
    when 'Queued'     then 'Inquiry sent'
    when 'Quoted'     then 'Quote ready'
    when 'Lost'       then 'Closed'
    when 'Rejected'   then 'Closed'
    else j.status
  end                                                      as status_label,
  er.name                                                  as ending_reason,
  coalesce(j.confirmed_arrival_date, j.arrival_date)       as job_date,
  coalesce(j.confirmed_arrival_time, j.arrival_time)       as arrival_time,
  j.confirmed_arrival_end_time                             as arrival_end_time,
  (select jsonb_agg(jsonb_build_object('date', aw.date, 'start', aw.start_time, 'end', aw.end_time) order by aw.sort_order)
     from job_arrival_windows aw where aw.job_id = j.id)   as arrival_windows,
  (select array_agg(st.address order by st.position) from job_stops st where st.job_id = j.id) as stop_addresses,
  j.onsite_same_as_payer,
  j.onsite_name,
  j.onsite_phone,
  j.customer_description                                   as description,
  j.category_answers,
  j.site_parking,
  j.site_access,
  j.site_rules,
  j.site_flags,
  j.quote_type,
  j.quote_fixed_total,
  j.quote_hourly_rate,
  j.quote_min_hours,
  j.quote_est_hours,
  j.quote_sent_at,
  j.quote_accepted_at,
  case when j.status in ('Booked','On the way','Working','Completed') then
    (select jsonb_agg(jsonb_build_object(
              'first_name', split_part(coalesce(p.full_name, e.entity_name), ' ', 1),
              'photo_path', e.photo_path,
              'vehicles', (select array_agg(li.name) from list_items li where li.id = any(e.vehicle_type_ids)))
            order by cw.sort_order, cw.created_at)
       from job_workers cw
       join entities e on e.id = cw.entity_id
       left join profiles p on p.id = e.profile_id
      where cw.job_id = j.id and cw.released_at is null)
  end                                                      as crew,
  coalesce(pm.status, 'none')                              as payment_status,
  pm.square_link                                           as payment_link,
  pm.amount_invoiced,
  pm.amount_paid,
  pm.tip,
  pm.amount_refunded,
  pm.due_on,
  (pm.status in ('unpaid','partly_paid') and pm.due_on < current_date) as payment_overdue,
  exists (select 1 from signed_agreements sa join agreement_texts t on t.id = sa.agreement_text_id
           where sa.profile_id = auth.uid() and t.kind = 'customer') as agreement_signed
from jobs j
left join list_items sc on sc.id = j.service_category_id
left join list_items er on er.id = j.ending_reason_id
left join lateral (
  select * from customer_payments cp where cp.job_id = j.id order by cp.created_at desc limit 1
) pm on true
where j.customer_profile_id = auth.uid();
comment on view v_customer_jobs is 'The signed-in customer''s jobs: plain-word status (canvas 2.1.1), quote, crew first names and vehicles once booked, and the Square payment. Never payout, commission or internal notes.';
grant select on v_customer_jobs to authenticated;
