-- =====================================================================
-- 024 — Many planned actions per record
--
-- A record could hold exactly one booked callback, so planning a sequence
-- — call Tuesday, drop cards Friday, follow up in a month — meant
-- overwriting the plan each time you made it.
--
-- `follow_up_at` is NOT replaced. It becomes a trigger-maintained mirror
-- of the earliest pending action, so the work queue, the lists and the
-- cards keep reading one plain column and know nothing about this table.
--
-- Requires 023. Run once. Safe to re-run.
-- =====================================================================

create table if not exists scheduled_actions (
  id             uuid primary key default gen_random_uuid(),
  partnership_id uuid references partnerships(id) on delete cascade,
  job_id         uuid references jobs(id) on delete cascade,
  kind           text not null default 'call'
                 check (kind in ('call', 'visit', 'text', 'email')),
  due_at         timestamptz not null,
  note           text,
  created_at     timestamptz not null default now(),
  -- Same rule as `activity`: exactly one parent, enforced not assumed.
  constraint scheduled_actions_one_parent
    check (num_nonnulls(partnership_id, job_id) = 1)
);

create index if not exists scheduled_actions_partnership_idx
  on scheduled_actions (partnership_id, due_at);
create index if not exists scheduled_actions_job_idx
  on scheduled_actions (job_id, due_at);

-- ---------------------------------------------------------------------
-- Keep follow_up_at pointing at the earliest plan
--
-- Everything that reads a "next action" reads the parent row, so adding,
-- moving or deleting a plan has to leave that column correct. Doing it in
-- a trigger means no caller can forget.
-- ---------------------------------------------------------------------
create or replace function sync_next_scheduled_action() returns trigger
language plpgsql as $$
declare
  pid uuid;
  jid uuid;
  nxt record;
begin
  pid := coalesce(new.partnership_id, old.partnership_id);
  jid := coalesce(new.job_id, old.job_id);

  if pid is not null then
    select due_at, kind, note into nxt
      from scheduled_actions
     where partnership_id = pid
     order by due_at
     limit 1;

    update partnerships
       set follow_up_at   = nxt.due_at,                 -- null when none remain
           follow_up_kind = coalesce(nxt.kind, 'call'),
           follow_up_note = nxt.note
     where id = pid;
  end if;

  if jid is not null then
    select due_at, kind, note into nxt
      from scheduled_actions
     where job_id = jid
     order by due_at
     limit 1;

    update jobs
       set follow_up_at   = nxt.due_at,
           follow_up_kind = coalesce(nxt.kind, 'call'),
           follow_up_note = nxt.note
     where id = jid;
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists scheduled_actions_sync on scheduled_actions;
create trigger scheduled_actions_sync
  after insert or update or delete on scheduled_actions
  for each row execute function sync_next_scheduled_action();

-- ---------------------------------------------------------------------
-- Carry the single existing callback across, so nothing booked is lost.
-- ---------------------------------------------------------------------
insert into scheduled_actions (partnership_id, kind, due_at, note)
select p.id, coalesce(p.follow_up_kind, 'call'), p.follow_up_at, p.follow_up_note
  from partnerships p
 where p.follow_up_at is not null
   and not exists (
     select 1 from scheduled_actions sa where sa.partnership_id = p.id
   );

insert into scheduled_actions (job_id, kind, due_at, note)
select j.id, coalesce(j.follow_up_kind, 'call'), j.follow_up_at, j.follow_up_note
  from jobs j
 where j.follow_up_at is not null
   and not exists (
     select 1 from scheduled_actions sa where sa.job_id = j.id
   );

-- ---------------------------------------------------------------------
-- RLS — same single-user rule as every other table
-- ---------------------------------------------------------------------
alter table scheduled_actions enable row level security;

drop policy if exists scheduled_actions_authenticated_all on scheduled_actions;
create policy scheduled_actions_authenticated_all on scheduled_actions
  for all to authenticated using (true) with check (true);
