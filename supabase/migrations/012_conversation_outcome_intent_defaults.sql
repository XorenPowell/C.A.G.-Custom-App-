-- =====================================================================
-- 012 — Default intent level per conversation outcome
--
-- Some outcomes (Visitor, say) should always set intent to the same
-- value without the dispatcher having to drag the slider every time.
-- Adds an optional default_intent_level to list_items, settable in
-- Settings for conversation_outcome entries; the new-conversation and
-- conversation-edit screens apply it when that outcome is picked. Also
-- widens intent_level to allow 0 — a real value here (not a prospect at
-- all), not "unset".
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table list_items add column if not exists default_intent_level integer;

alter table list_items drop constraint if exists list_items_default_intent_level_check;
alter table list_items add constraint list_items_default_intent_level_check
  check (default_intent_level is null or default_intent_level between 0 and 10);

alter table face_to_face_conversations drop constraint if exists face_to_face_conversations_intent_level_check;
alter table face_to_face_conversations add constraint face_to_face_conversations_intent_level_check
  check (intent_level between 0 and 10);
