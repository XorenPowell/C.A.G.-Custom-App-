-- =====================================================================
-- 046 — role row-level security: safety check
-- Each migration that creates a table sets its own row-level security
-- policies (staff-only by default, own-row where a worker or customer needs
-- one). Customers and workers read through the views in 045, not the base
-- tables. This migration adds no new access. It reports any public table that
-- still has row-level security switched off, so a gap cannot pass silently.
-- Safe to re-run.
-- =====================================================================

do $$
declare
  t record;
  missing text[] := '{}';
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and not c.relrowsecurity
  loop
    missing := missing || t.relname::text;
  end loop;

  if array_length(missing, 1) is null then
    raise notice '046: every public table has row-level security on.';
  else
    raise warning '046: these public tables have row-level security OFF: %', array_to_string(missing, ', ');
  end if;
end $$;
