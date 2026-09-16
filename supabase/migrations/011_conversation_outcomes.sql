-- =====================================================================
-- 011 — Conversation outcomes replace the contact-info form
--
-- Contact details were useless in practice — an interested prospect just
-- becomes a job directly. What matters is the outcome of the conversation
-- itself, so face_to_face_conversations is rebuilt down to just that:
-- an outcome (Settings-driven, like every other dropdown) at a moment in
-- time. Existing conversation data is dropped — the user has confirmed
-- that's fine, there isn't much of it and it's easy to redo.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

drop table if exists face_to_face_conversations cascade;

alter table list_items drop constraint if exists list_items_kind_check;
alter table list_items add constraint list_items_kind_check check (kind in (
  'service_category','inquiry_source','zone',
  'vehicle_type','partnership_status','partnership_tier',
  'conversation_outcome'
));

create table face_to_face_conversations (
  id           uuid primary key default gen_random_uuid(),
  occurred_at  timestamptz not null default now(),
  session_id   uuid references face_to_face_sessions(id) on delete cascade,
  outcome_id   uuid references list_items(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index face_to_face_conversations_occurred_idx on face_to_face_conversations (occurred_at desc);
create index face_to_face_conversations_session_idx on face_to_face_conversations (session_id);
create index face_to_face_conversations_outcome_idx on face_to_face_conversations (outcome_id);

alter table face_to_face_conversations enable row level security;
drop policy if exists face_to_face_conversations_authenticated_all on face_to_face_conversations;
create policy face_to_face_conversations_authenticated_all on face_to_face_conversations
  for all to authenticated using (true) with check (true);

insert into list_items (kind, name, sort_order)
select 'conversation_outcome', v.name, v.sort_order
from (values
  ('Visitor', 10),                 -- doesn't live here
  ('Interested for Myself', 20),
  ('Hold for Someone Else', 30)    -- passing it to a friend/family member
) as v(name, sort_order)
where not exists (
  select 1 from list_items where kind = 'conversation_outcome' and lower(name) = lower(v.name)
);
