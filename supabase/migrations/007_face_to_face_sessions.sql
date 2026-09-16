-- =====================================================================
-- 007 — Work Face to Face sessions
--
-- Conversations now happen inside a session (an afternoon of door-knocking,
-- etc.) rather than standalone. Adds the sessions table, links conversations
-- to it, and adds the daily conversation goal setting.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

create table if not exists face_to_face_sessions (
  id                 uuid primary key default gen_random_uuid(),
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  conversation_goal  integer not null default 5,
  committed_hours    numeric(5,2) not null default 1,
  zone_id            uuid references list_items(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index if not exists face_to_face_sessions_started_idx
  on face_to_face_sessions (started_at desc);
create index if not exists face_to_face_sessions_active_idx
  on face_to_face_sessions (ended_at) where ended_at is null;

alter table face_to_face_sessions enable row level security;
drop policy if exists face_to_face_sessions_authenticated_all on face_to_face_sessions;
create policy face_to_face_sessions_authenticated_all on face_to_face_sessions
  for all to authenticated using (true) with check (true);

-- Nullable: the handful of conversations logged before sessions existed
-- keep working, unattached to any session.
alter table face_to_face_conversations
  add column if not exists session_id uuid references face_to_face_sessions(id) on delete cascade;
create index if not exists face_to_face_conversations_session_idx
  on face_to_face_conversations (session_id);

alter table settings add column if not exists face_to_face_daily_goal integer not null default 10;
