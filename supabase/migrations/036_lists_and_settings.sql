-- =====================================================================
-- 036 — lists, settings and fee catalog
-- Widens the list kinds V2 needs (ending reasons, contact sources, crew
-- skills), adds the V2 operating settings, and creates the two tables that
-- hold per-category questions and the named fee catalog. Adds the fields
-- that let an existing worker fee point at the catalog. Everything here is
-- additive: existing rows and the browser app are untouched.
-- Safe to re-run.
-- =====================================================================

-- ---------- list_items: wider kinds, ending group --------------------
alter table list_items drop constraint if exists list_items_kind_check;
alter table list_items add constraint list_items_kind_check check (kind in (
  'service_category','inquiry_source','zone','vehicle_type',
  'partnership_status','partnership_tier','conversation_outcome',
  'contact_role',
  'job_ending_reason','contact_source','skill'));

alter table list_items add column if not exists ending_group text
  check (ending_group is null or ending_group in ('Cancelled','Lost','Rejected'));
comment on column list_items.ending_group is 'For job_ending_reason rows: which final status the reason belongs to.';

-- ---------- settings: V2 operating figures --------------------------
-- Existing next_action_presets already covers the "next action" gaps, so
-- no new column is added for them.
alter table settings add column if not exists flat_company_fee numeric(12,2) not null default 5.00;
comment on column settings.flat_company_fee is 'Flat fee taken per job by the company. V2 money views read this; V1 job_financials still hard-codes 5.0.';
alter table settings add column if not exists dispatch_wait_seconds integer not null default 60;
comment on column settings.dispatch_wait_seconds is 'How long an offer waits for an answer before it passes to the next worker.';
alter table settings add column if not exists crew_cap integer not null default 10;
comment on column settings.crew_cap is 'Largest crew a single job may take.';
alter table settings add column if not exists default_refill_interval_days integer not null default 30;
comment on column settings.default_refill_interval_days is 'Default days between card refills at a placement.';
alter table settings add column if not exists quote_follow_up_hours integer not null default 24;
comment on column settings.quote_follow_up_hours is 'Hours after a quote is sent before a follow-up is due.';
alter table settings add column if not exists day_before_reminder_time time not null default '17:00';
comment on column settings.day_before_reminder_time is 'Local time the day-before reminder text is due.';
alter table settings add column if not exists rating_threshold numeric(4,2) not null default 8;
comment on column settings.rating_threshold is 'Rating below which a worker is no longer offered jobs first.';
alter table settings add column if not exists expiring_soon_days integer not null default 30;
comment on column settings.expiring_soon_days is 'A worker document expiring within this many days shows as "Expiring soon".';
alter table settings add column if not exists contact_reveal_minutes integer not null default 60;
comment on column settings.contact_reveal_minutes is 'Customer and site contact details show to the assigned crew this many minutes before arrival.';

-- ---------- message_templates: which checklist line a template serves --
alter table message_templates add column if not exists kind text;
comment on column message_templates.kind is 'The checklist line this template is for (e.g. day_before, on_the_way). Null for ad-hoc templates.';

-- ---------- category_questions ---------------------------------------
create table if not exists category_questions (
  id                  uuid primary key default gen_random_uuid(),
  service_category_id uuid not null references list_items(id) on delete cascade,
  label               text not null,
  answer_type         text not null check (answer_type in ('text','checkbox','number','choice')),
  choices             text[] not null default '{}',
  required            boolean not null default false,
  sort_order          integer not null default 0,
  archived            boolean not null default false,
  created_at          timestamptz not null default now()
);
comment on table category_questions is 'The questions each service category asks at intake. Answers are stored on jobs.category_answers.';
comment on column category_questions.choices is 'Allowed answers when answer_type is choice; empty otherwise.';
alter table category_questions enable row level security;
drop policy if exists category_questions_staff_all on category_questions;
create policy category_questions_staff_all on category_questions
  for all to authenticated using (is_staff()) with check (is_staff());

-- ---------- fee_catalog ----------------------------------------------
create table if not exists fee_catalog (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  default_amount         numeric(12,2) not null default 0,
  shape                  text not null default 'flat' check (shape in ('flat','per_hour','percent_of_payout')),
  lands_on               text not null default 'payout' check (lands_on in ('payout','invoice','both')),
  counts_for_commission  boolean not null default true,
  default_category_ids   uuid[] not null default '{}',
  sort_order             integer not null default 0,
  archived               boolean not null default false,
  created_at             timestamptz not null default now()
);
comment on table fee_catalog is 'Named fees the local admin maintains. They pre-load onto jobs. A job keeps the fee as it was applied, so later catalog edits never change past jobs.';
comment on column fee_catalog.shape is 'flat = fixed amount; per_hour = amount x hours; percent_of_payout = percent of the worker payout.';
comment on column fee_catalog.lands_on is 'Whether the fee is paid out to the worker, charged on the invoice, or both.';
alter table fee_catalog enable row level security;
drop policy if exists fee_catalog_staff_all on fee_catalog;
create policy fee_catalog_staff_all on fee_catalog
  for all to authenticated using (is_staff()) with check (is_staff());

-- ---------- job_worker_fees: link to catalog -------------------------
alter table job_worker_fees add column if not exists fee_catalog_id uuid references fee_catalog(id) on delete set null;
alter table job_worker_fees add column if not exists shape text check (shape is null or shape in ('flat','per_hour','percent_of_payout'));
alter table job_worker_fees add column if not exists lands_on text check (lands_on is null or lands_on in ('payout','invoice','both'));
comment on column job_worker_fees.fee_catalog_id is 'The catalog fee this came from. Null for ad-hoc fees typed on the job.';
comment on column job_worker_fees.shape is 'How the fee was calculated when applied (copied from the catalog).';
comment on column job_worker_fees.lands_on is 'Where the fee lands when applied (copied from the catalog).';
