-- =====================================================================
-- 023 — What kind of contact is booked
--
-- The next action was a timestamp with no type, so the card could only
-- ever say "Call back on". For a partnership a visit is at least as
-- likely as a call — dropping cards, restocking, catching the manager —
-- and the work queue could not tell you whether to pick up the phone or
-- get in the car.
--
-- Additive. Existing rows default to 'call', which is what the UI already
-- implied they were.
--
-- Run once. Safe to re-run.
-- =====================================================================

alter table partnerships
  add column if not exists follow_up_kind text not null default 'call';

alter table jobs
  add column if not exists follow_up_kind text not null default 'call';

-- Deliberately narrower than activity.kind: 'note' is not something you
-- schedule, and 'restock' is driven by a campaign placement's own cadence
-- rather than booked by hand.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'partnerships_follow_up_kind_check'
  ) then
    alter table partnerships add constraint partnerships_follow_up_kind_check
      check (follow_up_kind in ('call', 'visit', 'text', 'email'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'jobs_follow_up_kind_check'
  ) then
    alter table jobs add constraint jobs_follow_up_kind_check
      check (follow_up_kind in ('call', 'visit', 'text', 'email'));
  end if;
end $$;
