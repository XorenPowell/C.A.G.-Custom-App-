-- =====================================================================
-- 035 — staff-only row-level security
-- V1 let any signed-in user read and write every table. Once customer and
-- worker accounts exist, that is a leak. This replaces each
-- `<table>_authenticated_all` policy with one that only lets active staff
-- (dispatcher or local admin) through. The browser app keeps working,
-- because its only account is the local admin backfilled in 034.
--
-- Must run AFTER 034 (it calls is_staff()). Safe to re-run.
-- =====================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'activity','campaign_placements','campaigns','card_receipts','contacts',
    'entities','entity_availability','entity_equipment','entity_fees',
    'entity_rates','entity_references','equipment_presets',
    'face_to_face_conversations','face_to_face_sessions',
    'job_arrival_windows','job_costs','job_worker_fees','job_workers',
    'jobs','list_items','message_templates','partnerships',
    'scheduled_actions','settings','time_entries'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_authenticated_all', t);
    execute format('drop policy if exists %I on %I', t || '_staff_all', t);
    execute format(
      'create policy %I on %I for all to authenticated using (is_staff()) with check (is_staff())',
      t || '_staff_all', t);
  end loop;
end $$;

-- google_credentials keeps its original state: no policy, service role only.
