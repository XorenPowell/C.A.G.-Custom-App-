-- =====================================================================
-- 039 — job columns for V2
-- Widens the job status list, and adds the payer and on-site contact, the
-- customer account link, the owner, the quote, site details, dispatch seats
-- and the rate snapshots. Next-action and follow-up already exist on jobs
-- (follow_up_at, follow_up_kind, follow_up_note), so they are not repeated.
-- Existing rows are untouched; every new column is nullable or defaulted.
-- Safe to re-run.
-- =====================================================================

-- ---------- status: widen the list ---------------------------------
-- Keeps every V1 status. Browser app: add the new values to JOB_STATUSES in
-- src/lib/types.ts before the app writes them.
alter table jobs drop constraint if exists jobs_status_check;
alter table jobs add constraint jobs_status_check check (status in (
  'Inquiry','Assigning','Queued','Quoted','Booked','On the way','Working',
  'Completed','Cancelled','Lost','Rejected'));
comment on column jobs.status is 'Where the job is. Inquiry through Booked are pre-work; On the way and Working are in progress; Completed, Cancelled, Lost and Rejected are final.';

-- ---------- payer and on-site contact -----------------------------
alter table jobs add column if not exists customer_email text;
alter table jobs add column if not exists onsite_same_as_payer boolean not null default true;
comment on column jobs.onsite_same_as_payer is 'True when the person on site is the payer. When false, onsite_name and onsite_phone apply.';
alter table jobs add column if not exists onsite_name text;
alter table jobs add column if not exists onsite_phone text;

-- ---------- customer account link ----------------------------------
alter table jobs add column if not exists customer_profile_id uuid references profiles(id) on delete set null;
comment on column jobs.customer_profile_id is 'The customer account this job belongs to, once linked. Null means no account yet.';
alter table jobs add column if not exists customer_linked_by uuid references profiles(id) on delete set null;
alter table jobs add column if not exists customer_linked_at timestamptz;
alter table jobs add column if not exists customer_linked_via text
  check (customer_linked_via is null or customer_linked_via in ('admin','phone_verified','email_verified'));
comment on column jobs.customer_linked_via is 'How the link was made: by an admin, or by a verified phone or email at sign-up.';

-- ---------- owner ---------------------------------------------------
alter table jobs add column if not exists owner_dispatcher_id uuid references profiles(id) on delete set null;
comment on column jobs.owner_dispatcher_id is 'The dispatcher responsible for this job. Shown in the job list and used to scope a dispatcher''s own jobs.';

-- ---------- title and ending ---------------------------------------
alter table jobs add column if not exists title text;
comment on column jobs.title is 'Short title workers see on the job, e.g. "Jane''s Couch".';
alter table jobs add column if not exists ending_reason_id uuid references list_items(id) on delete set null;
comment on column jobs.ending_reason_id is 'Why a job ended (a job_ending_reason list item). Set when it is Cancelled, Lost or Rejected.';
alter table jobs add column if not exists ending_note text;

-- ---------- service description ------------------------------------
alter table jobs add column if not exists customer_description text;
comment on column jobs.customer_description is 'What the customer asked for, in their words. Kept separate from notes (internal) and details (site text).';
alter table jobs add column if not exists category_answers jsonb not null default '{}'::jsonb;
comment on column jobs.category_answers is 'Answers to the questions for this job''s service category, keyed by category_questions.id.';

-- ---------- quote ---------------------------------------------------
alter table jobs add column if not exists quote_type text check (quote_type is null or quote_type in ('fixed','estimate'));
alter table jobs add column if not exists quote_fixed_total numeric(12,2);
alter table jobs add column if not exists quote_hourly_rate numeric(12,2);
alter table jobs add column if not exists quote_min_hours numeric(5,2);
alter table jobs add column if not exists quote_est_hours numeric(5,2);
alter table jobs add column if not exists quote_sent_at timestamptz;
alter table jobs add column if not exists quote_accepted_at timestamptz;
comment on column jobs.quote_type is 'fixed = one price; estimate = hourly with a minimum and an estimated number of hours.';

-- ---------- site details --------------------------------------------
alter table jobs add column if not exists site_parking text;
alter table jobs add column if not exists site_access text;
alter table jobs add column if not exists site_rules text;
alter table jobs add column if not exists site_flags jsonb not null default '{}'::jsonb;
comment on column jobs.site_flags is 'Tick-box site facts, e.g. {"large_or_fragile": true, "gate_code": true, "do_not_touch": true}.';

-- ---------- schedule and dispatch -----------------------------------
alter table jobs add column if not exists confirmed_arrival_end_time time;
comment on column jobs.confirmed_arrival_end_time is 'When set, the confirmed arrival is a window from confirmed_arrival_time to this time.';
alter table jobs add column if not exists seats_needed integer not null default 1
  check (seats_needed between 1 and 10);
comment on column jobs.seats_needed is 'How many workers the job needs. Capped at 10 to match crew_cap.';
alter table jobs add column if not exists is_vendor_job boolean not null default false;
alter table jobs add column if not exists vendor_entity_id uuid references entities(id) on delete set null;
alter table jobs add column if not exists queued_at timestamptz;
comment on column jobs.queued_at is 'When the job entered the dispatch queue. Used to order the queue.';

-- ---------- rate snapshots ------------------------------------------
-- Copied from settings when the job is created, so changing a rate later
-- never changes a job already booked.
alter table jobs add column if not exists commission_percent_snapshot numeric(6,3);
alter table jobs add column if not exists flat_fee_snapshot numeric(12,2);
alter table jobs add column if not exists transfer_fee_snapshot numeric(6,3);
alter table jobs add column if not exists deposit_fee_snapshot numeric(6,3);

create or replace function snapshot_job_rates() returns trigger
language plpgsql set search_path = public as $$
begin
  select default_commission_percent, flat_company_fee, transfer_fee_percent, deposit_fee_percent
    into new.commission_percent_snapshot, new.flat_fee_snapshot,
         new.transfer_fee_snapshot, new.deposit_fee_snapshot
    from settings
   where id = true;
  return new;
end $$;
comment on function snapshot_job_rates() is 'Fills the four rate snapshot columns from settings the first time a job is inserted.';

drop trigger if exists jobs_snapshot_rates on jobs;
create trigger jobs_snapshot_rates before insert on jobs
  for each row
  when (new.commission_percent_snapshot is null)
  execute function snapshot_job_rates();

-- Backfill: existing jobs get today's rates, so the snapshot is never blank.
update jobs j
   set commission_percent_snapshot = s.default_commission_percent,
       flat_fee_snapshot           = s.flat_company_fee,
       transfer_fee_snapshot       = s.transfer_fee_percent,
       deposit_fee_snapshot        = s.deposit_fee_percent
  from settings s
 where s.id = true
   and j.commission_percent_snapshot is null;

-- ---------- partnerships: starred -----------------------------------
alter table partnerships add column if not exists starred boolean not null default false;
comment on column partnerships.starred is 'Pinned to the top of the partnerships list.';
