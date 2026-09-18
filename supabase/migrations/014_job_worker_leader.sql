-- =====================================================================
-- 014 — Job worker leader
--
-- Whose phone number represents the job when a template resolves
-- {{poc_name}}/{{poc_phone}} without one specific texted recipient (e.g. a
-- customer-facing message naming which worker is coming). A checkbox on
-- each assigned worker in the job form; at most one per job, enforced by
-- a partial unique index. Falls back to the first assigned worker when no
-- leader is set, so existing jobs keep behaving exactly as before.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- =====================================================================

alter table job_workers add column if not exists is_leader boolean not null default false;

drop index if exists job_workers_leader_idx;
create unique index job_workers_leader_idx on job_workers (job_id) where is_leader;
