-- =====================================================================
-- 006 — Work Face to Face: in-person conversation log
--
-- Standalone outreach tracking — a new table only, nothing else in the app
-- reads it yet (dashboard, reports, etc. are untouched).
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

create table if not exists face_to_face_conversations (
  id                  uuid primary key default gen_random_uuid(),
  occurred_at         timestamptz not null default now(),

  contact_name        text,
  contact_phone       text,
  contact_email       text,
  inquiry_for         text check (inquiry_for in ('Themselves','A Friend')),

  service_category_id uuid references list_items(id) on delete set null,
  zone_id             uuid references list_items(id) on delete set null,

  cards_given         integer not null default 0,
  intent_level        integer not null default 5 check (intent_level between 1 and 10),

  notes               text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists face_to_face_conversations_updated_at on face_to_face_conversations;
create trigger face_to_face_conversations_updated_at before update on face_to_face_conversations
  for each row execute function set_updated_at();

create index if not exists face_to_face_conversations_occurred_idx
  on face_to_face_conversations (occurred_at desc);
create index if not exists face_to_face_conversations_category_idx
  on face_to_face_conversations (service_category_id);
create index if not exists face_to_face_conversations_zone_idx
  on face_to_face_conversations (zone_id);

alter table face_to_face_conversations enable row level security;

drop policy if exists face_to_face_conversations_authenticated_all on face_to_face_conversations;
create policy face_to_face_conversations_authenticated_all on face_to_face_conversations
  for all to authenticated using (true) with check (true);
