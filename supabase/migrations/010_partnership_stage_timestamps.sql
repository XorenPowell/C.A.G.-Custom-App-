-- =====================================================================
-- 010 — Partnership stage timestamps
--
-- Status (Visited/Developing/Mature) had no timestamp attached, so the
-- dashboard could only show a live snapshot count, not "how many reached
-- Developing/Mature this week/month." Adds developing_at / mature_at,
-- stamped once the first time a partnership's status ever enters that
-- stage, and a trigger to keep stamping them going forward. Never
-- overwritten afterward, so a partnership that moves on to the next stage
-- still counts toward the period it originally reached the earlier one.
--
-- Existing partnerships already at Developing/Mature (from migration 009)
-- have no real history to recover, so they're backfilled to their current
-- updated_at as a stand-in for "when," not their true transition date.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table partnerships add column if not exists developing_at timestamptz;
alter table partnerships add column if not exists mature_at timestamptz;

update partnerships p
set developing_at = p.updated_at
where p.developing_at is null
  and p.status_id = (
    select id from list_items where kind = 'partnership_status' and lower(name) = 'developing'
  );

update partnerships p
set mature_at = p.updated_at
where p.mature_at is null
  and p.status_id = (
    select id from list_items where kind = 'partnership_status' and lower(name) = 'mature'
  );

create or replace function stamp_partnership_stage() returns trigger language plpgsql as $$
declare
  stage_name text;
begin
  if tg_op = 'INSERT' or new.status_id is distinct from old.status_id then
    select lower(name) into stage_name from list_items where id = new.status_id;
    if stage_name = 'developing' and new.developing_at is null then
      new.developing_at = now();
    elsif stage_name = 'mature' and new.mature_at is null then
      new.mature_at = now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists partnerships_stage_stamp on partnerships;
create trigger partnerships_stage_stamp before insert or update on partnerships
  for each row execute function stamp_partnership_stage();
