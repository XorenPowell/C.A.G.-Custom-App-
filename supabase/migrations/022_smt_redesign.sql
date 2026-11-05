-- =====================================================================
-- 022 — SMT redesign
--
-- Deliberately additive. Nothing is dropped and nothing is renamed, so the
-- current app keeps running untouched against a database that has had this
-- applied. Old columns are backfilled into their replacements and retired in
-- a later migration, once the new UI has been live long enough to trust.
--
-- Run once. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Partnership callbacks
--
-- follow_up_days was a relative offset from last_contact, so the due date
-- silently moved every time contact was logged, and a callback could not be
-- booked for a partnership that had never been contacted. Replaced by an
-- explicit timestamp, matching how jobs already work.
-- ---------------------------------------------------------------------
alter table partnerships add column if not exists follow_up_at   timestamptz;
alter table partnerships add column if not exists follow_up_note text;

-- Carry the old offsets over so no scheduled callback is lost. 9am Chicago is
-- a deliberate choice: an offset had no time of day, and a callback that
-- lands at midnight reads as overdue the moment it is created.
update partnerships
   set follow_up_at = ((last_contact + (follow_up_days || ' days')::interval)::date
                       + time '09:00') at time zone 'America/Chicago'
 where follow_up_at is null
   and last_contact is not null
   and follow_up_days is not null;

create index if not exists partnerships_follow_up_at_idx on partnerships (follow_up_at);

-- ---------------------------------------------------------------------
-- 2. Job callbacks
--
-- jobs.follow_up_at already exists (020). What was missing is why — a deposit
-- chase and a pre-arrival confirmation are different calls.
-- ---------------------------------------------------------------------
alter table jobs add column if not exists follow_up_note text;

-- ---------------------------------------------------------------------
-- 3. Contact roles join the editable lists
-- ---------------------------------------------------------------------
alter table list_items drop constraint if exists list_items_kind_check;
alter table list_items add constraint list_items_kind_check check (kind in (
  'service_category','inquiry_source','zone',
  'vehicle_type','partnership_status','partnership_tier',
  'conversation_outcome','contact_role'
));

insert into list_items (kind, name, sort_order) values
  ('contact_role','Property Manager',        10),
  ('contact_role','Realtor',                 20),
  ('contact_role','Storage Facility Manager',30),
  ('contact_role','Leasing Agent',           40),
  ('contact_role','Office Manager',          50),
  ('contact_role','Front Desk',              60),
  ('contact_role','Owner',                   70),
  ('contact_role','Maintenance / Super',     80)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 4. Contacts become a record of their own
--
-- A partnership held exactly two unlabelled contacts, so a stack of business
-- cards spanning property managers, realtors and storage managers could not
-- be segmented at all. partnership_id is nullable on purpose: a card can be
-- captured before anyone decides which business it belongs to.
-- ---------------------------------------------------------------------
create table if not exists contacts (
  id              uuid primary key default gen_random_uuid(),
  partnership_id  uuid references partnerships(id) on delete cascade,
  name            text not null,
  role_id         uuid references list_items(id) on delete set null,
  title           text,
  email           text,
  phone           text,
  source          text,                 -- Business card / Entered manually / Imported
  notes           text,
  -- Compliance lives in the data, not just the send screen. An opt-out must
  -- survive every future export, filter and template.
  email_opt_out   boolean not null default false,
  last_emailed_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists contacts_partnership_idx on contacts (partnership_id);
create index if not exists contacts_role_idx on contacts (role_id);
create index if not exists contacts_email_idx on contacts (lower(email));

drop trigger if exists contacts_updated_at on contacts;
create trigger contacts_updated_at before update on contacts
  for each row execute function set_updated_at();

-- Lift the existing primary/secondary contacts across. The partnerships
-- columns are left in place and still populated by the old app; a later
-- migration retires them once nothing reads them.
--
-- Only rows with a phone or an email come across: a name with no way to
-- reach the person is not a contact, and that name still lives on
-- partnerships.poc_name regardless.
--
-- The name is coalesced inside the insert, not patched up afterwards: some
-- partnerships hold a phone number with no contact name against it, and
-- contacts.name is not null. Blank strings are normalised to null first, so
-- an empty poc_name does not sneak past as a nameless contact.
insert into contacts (partnership_id, name, email, phone, source, created_at)
select p.id,
       coalesce(nullif(trim(p.poc_name), ''), 'Unnamed contact'),
       nullif(trim(p.poc_email), ''),
       nullif(trim(p.poc_phone), ''),
       'Migrated from partnership',
       p.created_at
  from partnerships p
 where coalesce(nullif(trim(p.poc_email), ''),
                nullif(trim(p.poc_phone), '')) is not null
   and not exists (
         select 1 from contacts c
          where c.partnership_id = p.id
            and c.name  is not distinct from coalesce(nullif(trim(p.poc_name), ''), 'Unnamed contact')
            and c.phone is not distinct from nullif(trim(p.poc_phone), ''));

insert into contacts (partnership_id, name, email, phone, source, created_at)
select p.id,
       coalesce(nullif(trim(p.secondary_poc_name), ''), 'Unnamed contact'),
       nullif(trim(p.secondary_poc_email), ''),
       nullif(trim(p.secondary_poc_phone), ''),
       'Migrated from partnership',
       p.created_at
  from partnerships p
 where coalesce(nullif(trim(p.secondary_poc_email), ''),
                nullif(trim(p.secondary_poc_phone), '')) is not null
   and not exists (
         select 1 from contacts c
          where c.partnership_id = p.id
            and c.name  is not distinct from coalesce(nullif(trim(p.secondary_poc_name), ''), 'Unnamed contact')
            and c.phone is not distinct from nullif(trim(p.secondary_poc_phone), ''));

-- ---------------------------------------------------------------------
-- 5. Campaigns, and the Stack At Front placements
--
-- Modelled as a campaign rather than an is_safc flag so a second play does
-- not need a schema change. A placement carries a restock cadence, because
-- knowing a stack exists is useless next to knowing which stacks are empty.
-- ---------------------------------------------------------------------
create table if not exists campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  short_name  text,
  description text,
  target      integer not null default 0,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists campaigns_updated_at on campaigns;
create trigger campaigns_updated_at before update on campaigns
  for each row execute function set_updated_at();

insert into campaigns (name, short_name, description, target, sort_order)
values ('Stack At Front Campaign','SAFC',
        'Business cards placed at the front counter of a partner business, kept stocked.',
        100, 10)
on conflict (name) do nothing;

create table if not exists campaign_placements (
  id                    uuid primary key default gen_random_uuid(),
  campaign_id           uuid not null references campaigns(id) on delete cascade,
  partnership_id        uuid not null references partnerships(id) on delete cascade,
  location              text,                       -- "Front counter", "Lobby rack"
  placed_on             date not null default current_date,
  last_restock_on       date,
  restock_interval_days integer not null default 14,
  cards_left            integer,
  -- Ending a placement sets this rather than deleting the row, so the
  -- campaign keeps an honest history of what was tried and where.
  removed_on            date,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (campaign_id, partnership_id)
);

create index if not exists campaign_placements_campaign_idx on campaign_placements (campaign_id, removed_on);
create index if not exists campaign_placements_partnership_idx on campaign_placements (partnership_id);

drop trigger if exists campaign_placements_updated_at on campaign_placements;
create trigger campaign_placements_updated_at before update on campaign_placements
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 6. One activity log for partnerships and jobs
--
-- Today contact history is a single overwritable last_contact date, so the
-- previous five calls are gone. Exactly one parent per row, enforced rather
-- than assumed, which keeps real foreign keys on both sides.
-- ---------------------------------------------------------------------
create table if not exists activity (
  id             uuid primary key default gen_random_uuid(),
  partnership_id uuid references partnerships(id) on delete cascade,
  job_id         uuid references jobs(id) on delete cascade,
  contact_id     uuid references contacts(id) on delete set null,
  kind           text not null check (kind in ('call','text','email','visit','restock','note')),
  outcome        text,
  note           text,
  occurred_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  constraint activity_exactly_one_parent check (num_nonnulls(partnership_id, job_id) = 1)
);

create index if not exists activity_partnership_idx on activity (partnership_id, occurred_at desc);
create index if not exists activity_job_idx on activity (job_id, occurred_at desc);

-- Logging contact is the only way last_contact should ever move, so the
-- column is maintained here instead of by hand in the form.
create or replace function touch_partnership_last_contact() returns trigger language plpgsql as $$
begin
  if new.partnership_id is not null and new.kind in ('call','text','email','visit','restock') then
    update partnerships
       set last_contact = greatest(
             coalesce(last_contact, (new.occurred_at at time zone 'America/Chicago')::date),
             (new.occurred_at at time zone 'America/Chicago')::date)
     where id = new.partnership_id;
  end if;
  return new;
end $$;

drop trigger if exists activity_touch_last_contact on activity;
create trigger activity_touch_last_contact after insert on activity
  for each row execute function touch_partnership_last_contact();

-- Seed the log with what little history exists, so no partnership opens on an
-- empty timeline when it demonstrably has been contacted.
insert into activity (partnership_id, kind, outcome, occurred_at)
select p.id, 'note', 'Last contact recorded before the activity log existed',
       (p.last_contact + time '12:00') at time zone 'America/Chicago'
  from partnerships p
 where p.last_contact is not null
   and not exists (select 1 from activity a where a.partnership_id = p.id);

-- ---------------------------------------------------------------------
-- 7. Row level security — same single-user rule as every other table
-- ---------------------------------------------------------------------
alter table contacts            enable row level security;
alter table campaigns           enable row level security;
alter table campaign_placements enable row level security;
alter table activity            enable row level security;

do $$
declare t text;
begin
  foreach t in array array['contacts','campaigns','campaign_placements','activity'] loop
    execute format('drop policy if exists %I on %I', t || '_authenticated_all', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Note on the maturity meter
--
-- settings.mature_partnership_goal_per_zone is intentionally left in place.
-- The meter is removed from the UI in this release; the column is dropped in
-- a later migration, so this one stays fully reversible.
-- ---------------------------------------------------------------------
