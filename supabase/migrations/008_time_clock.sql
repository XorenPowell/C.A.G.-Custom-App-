-- =====================================================================
-- 008 — Time clock
--
-- Adds a simple clock-in/clock-out log for tracking hours worked, with an
-- optional note on what got done during each period.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

create table if not exists time_entries (
  id              uuid primary key default gen_random_uuid(),
  clocked_in_at   timestamptz not null default now(),
  clocked_out_at  timestamptz,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists time_entries_clocked_in_idx
  on time_entries (clocked_in_at desc);
create index if not exists time_entries_active_idx
  on time_entries (clocked_out_at) where clocked_out_at is null;

alter table time_entries enable row level security;
drop policy if exists time_entries_authenticated_all on time_entries;
create policy time_entries_authenticated_all on time_entries
  for all to authenticated using (true) with check (true);
