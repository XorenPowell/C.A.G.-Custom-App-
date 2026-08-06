-- =====================================================================
-- C.A.G. Application — full schema
-- Paste this whole file into the Supabase SQL Editor and Run.
-- Safe to re-run: it drops and recreates everything.
-- =====================================================================

-- ---------- clean slate -----------------------------------------------
drop view   if exists job_financials      cascade;
drop view   if exists job_worker_pay      cascade;
drop table  if exists job_worker_fees     cascade;
drop table  if exists job_workers         cascade;
drop table  if exists jobs                cascade;
drop table  if exists partnerships        cascade;
drop table  if exists entity_availability cascade;
drop table  if exists entity_equipment    cascade;
drop table  if exists entity_fees         cascade;
drop table  if exists entity_rates        cascade;
drop table  if exists entity_references   cascade;
drop table  if exists entities            cascade;
drop table  if exists equipment_presets   cascade;
drop table  if exists message_templates   cascade;
drop table  if exists list_items          cascade;
drop table  if exists settings            cascade;
drop table  if exists google_credentials  cascade;
drop sequence if exists job_number_seq    cascade;
drop function if exists set_updated_at()  cascade;
drop function if exists touch_entity_availability() cascade;
drop function if exists next_job_id()     cascade;

create extension if not exists "pgcrypto";

-- ---------- shared helpers --------------------------------------------
create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =====================================================================
-- SETTINGS
-- =====================================================================

-- Scalar configuration. Exactly one row, guaranteed by the `singleton` check.
create table settings (
  id                        boolean primary key default true check (id),
  default_pos_fee_percent   numeric(6,3) not null default 5.0,
  monthly_jobs_goal         integer      not null default 300,
  daily_leads_goal          integer      not null default 5,
  daily_partnerships_goal   integer      not null default 10,
  updated_at                timestamptz  not null default now()
);
create trigger settings_updated_at before update on settings
  for each row execute function set_updated_at();

-- Every dropdown in the app draws from here. `kind` partitions the lists.
-- Nothing is ever hardcoded in a component.
create table list_items (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in (
                'service_category','lead_source','zone',
                'vehicle_type','partnership_status','partnership_tier')),
  name        text not null,
  description text,                       -- used by zones for the reference screen
  sort_order  integer not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index list_items_kind_idx on list_items (kind, archived, sort_order);
create unique index list_items_kind_name_idx on list_items (kind, lower(name));

create table message_templates (
  id            uuid primary key default gen_random_uuid(),
  template_name text not null,
  audience      text not null check (audience in ('Customer','Worker')),
  body          text not null default '',
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger message_templates_updated_at before update on message_templates
  for each row execute function set_updated_at();

-- Backs the item autocomplete on an entity's Equipment section. A lookup, not
-- a foreign key: equipment rows copy the text, so editing or deleting a preset
-- never disturbs equipment already recorded against an entity.
create table equipment_presets (
  id           uuid primary key default gen_random_uuid(),
  item_name    text not null,
  default_note text,
  category     text not null default 'Other',
  sort_order   integer not null default 0,
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index equipment_presets_name_idx on equipment_presets (lower(item_name));
create index equipment_presets_category_idx on equipment_presets (category, sort_order);
create trigger equipment_presets_updated_at before update on equipment_presets
  for each row execute function set_updated_at();

-- =====================================================================
-- ENTITIES  (one unit of labor: roster_size = 1 -> Individual, else Crew)
-- =====================================================================
create table entities (
  id                      uuid primary key default gen_random_uuid(),
  entity_name             text not null,
  roster_size             integer not null default 1 check (roster_size >= 1),
  worker_names            text[] not null default '{}',
  poc_name                text,
  poc_phone               text,
  status                  text not null default 'Active' check (status in ('Active','Inactive')),

  zone_id                 uuid references list_items(id) on delete set null,
  vehicle_type_ids        uuid[] not null default '{}',

  ic_agreement_link       text,
  photo_id_link           text,
  equipment_photos_link   text,

  availability_note       text,
  availability_updated_at timestamptz,

  reliability_notes       text,
  notes                   text,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger entities_updated_at before update on entities
  for each row execute function set_updated_at();
create index entities_status_idx on entities (status);
create index entities_zone_idx on entities (zone_id);
create index entities_vehicle_idx on entities using gin (vehicle_type_ids);
create index entities_worker_names_idx on entities using gin (worker_names);

-- Prior clients who hired this entity, for vetting.
create table entity_references (
  id                  uuid primary key default gen_random_uuid(),
  entity_id           uuid not null references entities(id) on delete cascade,
  reference_name      text,
  reference_phone     text,
  service_category_id uuid references list_items(id) on delete set null,
  verified            boolean not null default false,
  sort_order          integer not null default 0
);
create index entity_references_entity_idx on entity_references (entity_id);

-- One row per service category the entity can perform.
-- No row => cannot perform that service => excluded from the dispatch picker.
create table entity_rates (
  id                  uuid primary key default gen_random_uuid(),
  entity_id           uuid not null references entities(id) on delete cascade,
  service_category_id uuid not null references list_items(id) on delete cascade,
  regular_rate        numeric(12,2) not null default 0,
  travel_rate         numeric(12,2) not null default 0,
  other_rate          numeric(12,2) not null default 0,
  unique (entity_id, service_category_id)
);
create index entity_rates_entity_idx on entity_rates (entity_id);
create index entity_rates_category_idx on entity_rates (service_category_id);

-- Standing fees this entity charges; pre-loaded onto a job when dispatched.
create table entity_fees (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id) on delete cascade,
  fee_name    text,
  description text,
  amount      numeric(12,2) not null default 0,
  sort_order  integer not null default 0
);
create index entity_fees_entity_idx on entity_fees (entity_id);

-- Searchable across the whole roster, not just within a profile.
create table entity_equipment (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid not null references entities(id) on delete cascade,
  item_name  text,
  quantity   integer not null default 1,
  notes      text,
  sort_order integer not null default 0
);
create index entity_equipment_entity_idx on entity_equipment (entity_id);
create index entity_equipment_name_idx on entity_equipment (lower(item_name));

create table entity_availability (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid not null references entities(id) on delete cascade,
  date       date not null,
  start_time time,
  end_time   time
);
create index entity_availability_entity_idx on entity_availability (entity_id);
create index entity_availability_date_idx on entity_availability (date);

-- Any availability edit stamps the parent, which drives the >6-day red flag.
create function touch_entity_availability() returns trigger language plpgsql as $$
begin
  update entities
     set availability_updated_at = now()
   where id = coalesce(new.entity_id, old.entity_id);
  return coalesce(new, old);
end $$;

create trigger entity_availability_touch
  after insert or update or delete on entity_availability
  for each row execute function touch_entity_availability();

-- =====================================================================
-- PARTNERSHIPS
-- =====================================================================
create table partnerships (
  id                          uuid primary key default gen_random_uuid(),
  business_name               text not null,
  address                     text,
  zone_id                     uuid references list_items(id) on delete set null,
  status_id                   uuid references list_items(id) on delete set null,
  tier_id                     uuid references list_items(id) on delete set null,
  poc_name                    text,
  poc_phone                   text,
  poc_email                   text,
  secondary_poc_name          text,
  secondary_poc_phone         text,
  secondary_poc_email         text,
  last_visit                  date,
  cards_dropped_last_visit    integer not null default 0,
  total_cards_dropped         integer not null default 0,
  fliers_dropped_last_visit   integer not null default 0,
  total_fliers_dropped        integer not null default 0,

  -- Leads and real partnerships share this table. `date_signed` is the
  -- discriminator: null means it is still a lead and it stays out of every
  -- metric; set means it counts. When the lead was first written down is
  -- already captured by created_at.
  date_signed                 date,
  last_contact                date,          -- any outreach: call, email, visit
  follow_up_days              integer,       -- "follow up in N days" from last_contact

  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create trigger partnerships_updated_at before update on partnerships
  for each row execute function set_updated_at();
create index partnerships_status_idx on partnerships (status_id);
create index partnerships_tier_idx on partnerships (tier_id);
create index partnerships_zone_idx on partnerships (zone_id);
create index partnerships_date_signed_idx on partnerships (date_signed);
create index partnerships_last_contact_idx on partnerships (last_contact);

-- =====================================================================
-- JOBS
-- Every inquiry is a job immediately. Ones that never book exit via 'Lost'.
-- =====================================================================

-- JOB-0001..JOB-0011 already exist historically, so the sequence starts at 12.
create sequence job_number_seq start with 12 increment by 1;

create function next_job_id() returns text language sql as $$
  select 'JOB-' || lpad(nextval('job_number_seq')::text, 4, '0');
$$;

create table jobs (
  id                  uuid primary key default gen_random_uuid(),
  job_id              text not null unique default next_job_id(),

  customer_name       text,
  customer_phone      text,
  customer_type       text check (customer_type in ('Residential','Commercial')),

  service_category_id uuid references list_items(id) on delete set null,
  lead_source_id      uuid references list_items(id) on delete set null,
  partnership_id      uuid references partnerships(id) on delete set null,
  zone_id             uuid references list_items(id) on delete set null,
  status              text not null default 'Inquiry'
                      check (status in ('Inquiry','Quoted','Booked','Completed','Cancelled','Lost')),

  date_of_invoice     date,
  arrival_date        date,
  arrival_time        time,
  estimated_duration_minutes integer,
  addresses           text[] not null default '{}',   -- any number of stops

  total_invoice_paid  numeric(12,2) not null default 0,
  pos_fee_percent     numeric(6,3)  not null default 5.0,
  other_job_costs     numeric(12,2) not null default 0,

  -- Section 4 exception: dispatcher may type over the calculated payout.
  total_worker_payout_override numeric(12,2),

  invoice_ref         text,
  notes               text,
  google_calendar_event_id text,              -- hidden from the UI

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger jobs_updated_at before update on jobs
  for each row execute function set_updated_at();
create index jobs_status_idx on jobs (status);
create index jobs_arrival_idx on jobs (arrival_date);
create index jobs_invoice_date_idx on jobs (date_of_invoice);
create index jobs_category_idx on jobs (service_category_id);
create index jobs_lead_source_idx on jobs (lead_source_id);
create index jobs_partnership_idx on jobs (partnership_id);
create index jobs_zone_idx on jobs (zone_id);
create index jobs_phone_idx on jobs (regexp_replace(coalesce(customer_phone,''), '\D', '', 'g'));

-- Workers on a job: a genuine list, never fixed Worker 1/2/3 columns.
create table job_workers (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references jobs(id) on delete cascade,
  entity_id      uuid references entities(id) on delete set null,
  regular_hours  numeric(10,2) not null default 0,
  regular_rate   numeric(12,2) not null default 0,
  travel_hours   numeric(10,2) not null default 0,
  travel_rate    numeric(12,2) not null default 0,
  other_hours    numeric(10,2) not null default 0,
  other_rate     numeric(12,2) not null default 0,
  -- Section 4 exception: dispatcher may type over this worker's calculated pay.
  total_pay_override numeric(12,2),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);
create index job_workers_job_idx on job_workers (job_id);
create index job_workers_entity_idx on job_workers (entity_id);

create table job_worker_fees (
  id            uuid primary key default gen_random_uuid(),
  job_worker_id uuid not null references job_workers(id) on delete cascade,
  description   text,
  amount        numeric(12,2) not null default 0,
  sort_order    integer not null default 0
);
create index job_worker_fees_worker_idx on job_worker_fees (job_worker_id);

-- =====================================================================
-- GOOGLE CALENDAR CREDENTIALS
-- Single row. Service-role only — no RLS policy is granted to `authenticated`,
-- so the refresh token can never be read from the browser.
-- =====================================================================
create table google_credentials (
  id            boolean primary key default true check (id),
  refresh_token text,
  access_token  text,
  expires_at    timestamptz,
  calendar_id   text not null default 'primary',
  connected_email text,
  updated_at    timestamptz not null default now()
);

-- =====================================================================
-- DERIVED VALUES — computed on read, never stored (section 4)
-- =====================================================================

-- Per worker row.
create view job_worker_pay as
select
  w.id                as job_worker_id,
  w.job_id,
  w.entity_id,
  coalesce(f.fees_total, 0)                                as fees_total,
  (w.regular_hours * w.regular_rate)
    + (w.travel_hours * w.travel_rate)
    + (w.other_hours  * w.other_rate)
    + coalesce(f.fees_total, 0)                            as calculated_pay,
  coalesce(
    w.total_pay_override,
    (w.regular_hours * w.regular_rate)
      + (w.travel_hours * w.travel_rate)
      + (w.other_hours  * w.other_rate)
      + coalesce(f.fees_total, 0)
  )                                                        as effective_pay
from job_workers w
left join lateral (
  select sum(amount) as fees_total
  from job_worker_fees
  where job_worker_id = w.id
) f on true;

-- Per job. Downstream figures always use the effective (override-aware) payout.
create view job_financials as
select
  j.id as job_id,
  coalesce(p.payout, 0)                                     as calculated_worker_payout,
  coalesce(j.total_worker_payout_override, p.payout, 0)     as total_worker_payout,
  round(j.total_invoice_paid * j.pos_fee_percent / 100.0, 2) as pos_fee_amount,
  coalesce(j.total_worker_payout_override, p.payout, 0)
    + round(j.total_invoice_paid * j.pos_fee_percent / 100.0, 2)
    + j.other_job_costs                                     as total_job_costs,
  j.total_invoice_paid
    - ( coalesce(j.total_worker_payout_override, p.payout, 0)
        + round(j.total_invoice_paid * j.pos_fee_percent / 100.0, 2)
        + j.other_job_costs )                               as profit,
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

-- =====================================================================
-- ROW LEVEL SECURITY
-- Single-user internal tool: any signed-in session gets full access.
-- Anonymous access is denied everywhere.
-- =====================================================================
alter table settings            enable row level security;
alter table list_items          enable row level security;
alter table message_templates   enable row level security;
alter table equipment_presets   enable row level security;
alter table entities            enable row level security;
alter table entity_references   enable row level security;
alter table entity_rates        enable row level security;
alter table entity_fees         enable row level security;
alter table entity_equipment    enable row level security;
alter table entity_availability enable row level security;
alter table partnerships        enable row level security;
alter table jobs                enable row level security;
alter table job_workers         enable row level security;
alter table job_worker_fees     enable row level security;
alter table google_credentials  enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'settings','list_items','message_templates','equipment_presets','entities','entity_references',
    'entity_rates','entity_fees','entity_equipment','entity_availability',
    'partnerships','jobs','job_workers','job_worker_fees'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t);
  end loop;
end $$;
-- google_credentials intentionally gets NO policy: service role only.

-- Views inherit the RLS of their base tables.
alter view job_worker_pay  set (security_invoker = on);
alter view job_financials  set (security_invoker = on);
grant select on job_worker_pay, job_financials to authenticated;
