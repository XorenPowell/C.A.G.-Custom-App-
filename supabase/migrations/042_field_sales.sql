-- =====================================================================
-- 042 — field sales
-- Most of field sales already exists in production under live names:
-- `activity` (the activity trail), `contacts`, `campaign_placements` (card
-- stacks left at a partnership) and `card_receipts` (cards received and
-- physical counts). This adds only the gaps: who logged each activity, a
-- refill history for placements, a stage_change activity kind, the visit-day
-- route, and the profile links on time and outreach records. Safe to re-run.
-- =====================================================================

-- ---------- activity ---------------------------------------------------
alter table activity add column if not exists created_by uuid references profiles(id) on delete set null;
comment on column activity.created_by is 'The staff account that logged this activity.';

-- Every existing kind (call, email, note, text, visit) is kept. stage_change
-- is added for pipeline moves recorded in the trail.
alter table activity drop constraint if exists activity_kind_check;
alter table activity add constraint activity_kind_check check (kind in
  ('call','text','email','visit','note','stage_change'));
comment on table activity is 'The activity trail for a partnership or a job: every call, text, email, visit, note and stage move. Renamed to "activities" in the spec; kept under its live name.';

-- ---------- card_receipts ---------------------------------------------
-- kind = 'receipt' rows are cards collected from the printer (quantity).
-- kind = 'count' rows are physical stock counts (counted_total).
alter table card_receipts drop constraint if exists card_receipts_kind_check;
alter table card_receipts add constraint card_receipts_kind_check check (kind in ('receipt','count'));
alter table card_receipts add column if not exists counted_by uuid references profiles(id) on delete set null;
comment on column card_receipts.counted_by is 'The staff account that did a physical count.';
comment on table card_receipts is 'Card stock movements: receipts from the printer (kind = receipt) and physical stock counts (kind = count). Card stock is derived from these in v2_card_ledger.';

-- ---------- placement_refills ------------------------------------------
create table if not exists placement_refills (
  id                uuid primary key default gen_random_uuid(),
  placement_id      uuid not null references campaign_placements(id) on delete cascade,
  activity_id       uuid references activity(id) on delete set null,
  cards_added       integer not null check (cards_added >= 0),
  cards_still_there integer check (cards_still_there is null or cards_still_there >= 0),
  refilled_on       date not null default current_date,
  created_at        timestamptz not null default now()
);
comment on table placement_refills is 'Each time cards are added to a placement. Gives the refill history that campaign_placements.last_restock_on only summarises.';
comment on column placement_refills.cards_still_there is 'What was left on the stand when it was refilled, if counted.';
create index if not exists placement_refills_placement_idx on placement_refills (placement_id, refilled_on);
alter table placement_refills enable row level security;
drop policy if exists placement_refills_staff_all on placement_refills;
create policy placement_refills_staff_all on placement_refills
  for all to authenticated using (is_staff()) with check (is_staff());

-- ---------- visit_days and visit_stops ---------------------------------
create table if not exists visit_days (
  id            uuid primary key default gen_random_uuid(),
  visit_date    date not null unique,
  start_address text,
  route_sorted  boolean not null default false,
  created_at    timestamptz not null default now()
);
comment on table visit_days is 'A day of walking partnerships. One row per date.';
alter table visit_days enable row level security;
drop policy if exists visit_days_staff_all on visit_days;
create policy visit_days_staff_all on visit_days
  for all to authenticated using (is_staff()) with check (is_staff());

create table if not exists visit_stops (
  id            uuid primary key default gen_random_uuid(),
  visit_day_id  uuid not null references visit_days(id) on delete cascade,
  partnership_id uuid not null references partnerships(id) on delete cascade,
  due_time      time,
  position      integer not null,
  created_at    timestamptz not null default now(),
  unique (visit_day_id, position)
);
comment on table visit_stops is 'The partnerships on a visit day, in route order. due_time is an optional time to be there.';
alter table visit_stops enable row level security;
drop policy if exists visit_stops_staff_all on visit_stops;
create policy visit_stops_staff_all on visit_stops
  for all to authenticated using (is_staff()) with check (is_staff());

-- ---------- profile links on time and outreach ------------------------
alter table time_entries add column if not exists profile_id uuid references profiles(id) on delete set null;
comment on column time_entries.profile_id is 'The staff account that clocked in. Null on entries made before V2.';
alter table face_to_face_sessions add column if not exists profile_id uuid references profiles(id) on delete set null;
comment on column face_to_face_sessions.profile_id is 'The staff account that ran the session. Null on sessions made before V2.';
