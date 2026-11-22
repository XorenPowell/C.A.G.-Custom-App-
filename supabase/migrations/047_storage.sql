-- =====================================================================
-- 047 — storage buckets and their access rules
-- Four private buckets for files: job photos, expense receipts, worker
-- documents, and profile photos. Files are never public; each read goes
-- through a rule. Safe to re-run.
-- =====================================================================

insert into storage.buckets (id, name, public)
values
  ('job-photos',   'job-photos',   false),
  ('receipts',     'receipts',     false),
  ('documents',    'documents',    false),
  ('entity-photos','entity-photos',false)
on conflict (id) do update set public = false;

-- Staff can read and write every bucket.
drop policy if exists storage_staff_all on storage.objects;
create policy storage_staff_all on storage.objects
  for all to authenticated
  using (bucket_id in ('job-photos','receipts','documents','entity-photos') and is_staff())
  with check (bucket_id in ('job-photos','receipts','documents','entity-photos') and is_staff());

-- A worker may upload and read their own documents, but only under their
-- own entity's folder. Files are stored as <entity_id>/<file>.
drop policy if exists storage_worker_documents on storage.objects;
create policy storage_worker_documents on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = my_entity_id()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = my_entity_id()::text);

-- Folder conventions, so the rules above and the app agree:
--   receipts/<job_worker_id>/<file>   one folder per crew seat
--   job-photos/<job_id>/<file>        one folder per job
--   documents/<entity_id>/<file>      one folder per worker
--   entity-photos/<entity_id>/<file>

-- A worker may upload receipts for their own crew seats.
drop policy if exists storage_worker_receipts on storage.objects;
create policy storage_worker_receipts on storage.objects
  for all to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] in (
           select my_job_worker_ids()::text))
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] in (
           select my_job_worker_ids()::text));

-- A worker may upload and read photos on any job they are crewing.
drop policy if exists storage_worker_job_photos on storage.objects;
create policy storage_worker_job_photos on storage.objects
  for all to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] in (
           select my_job_ids()::text))
  with check (bucket_id = 'job-photos' and (storage.foldername(name))[1] in (
           select my_job_ids()::text));

-- Anyone signed in may read profile photos. Only staff write them (above).
drop policy if exists storage_entity_photos_read on storage.objects;
create policy storage_entity_photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'entity-photos');

-- Customers read photos of their own jobs.
drop policy if exists storage_customer_job_photos on storage.objects;
create policy storage_customer_job_photos on storage.objects
  for select to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] in (
           select j.id::text from jobs j where j.customer_profile_id = auth.uid()));
