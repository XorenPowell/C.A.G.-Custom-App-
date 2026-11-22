-- =====================================================================
-- 037 — agreements and customer accounts
-- Stores each agreement's wording by version, so it is always known exactly
-- what a person signed. Records each signature. Adds the one small table of
-- facts that only a customer account has. Safe to re-run.
-- =====================================================================

create table if not exists agreement_texts (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('customer','ic')),
  version        text not null,
  body           text not null,
  effective_from date not null,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (kind, version)
);
comment on table agreement_texts is 'The full wording of each agreement, versioned. Every signature points at the exact version signed.';
comment on column agreement_texts.kind is 'customer = the customer agreement; ic = the independent-contractor agreement for workers.';
alter table agreement_texts enable row level security;
drop policy if exists agreement_texts_read on agreement_texts;
create policy agreement_texts_read on agreement_texts
  for select to authenticated using (true);
drop policy if exists agreement_texts_admin_write on agreement_texts;
create policy agreement_texts_admin_write on agreement_texts
  for all to authenticated using (is_local_admin()) with check (is_local_admin());

create table if not exists signed_agreements (
  id                 uuid primary key default gen_random_uuid(),
  agreement_text_id  uuid not null references agreement_texts(id),
  profile_id         uuid not null references profiles(id) on delete cascade,
  job_id             uuid references jobs(id) on delete set null,
  signed_name        text not null,
  signed_at          timestamptz not null default now(),
  unique (profile_id, agreement_text_id)
);
comment on table signed_agreements is 'Who signed which agreement version, and when. One row per person per version.';
comment on column signed_agreements.job_id is 'The job the agreement was signed on. For a customer, their first job.';
comment on column signed_agreements.signed_name is 'The name the signer typed when signing.';
alter table signed_agreements enable row level security;
drop policy if exists signed_agreements_own_read on signed_agreements;
create policy signed_agreements_own_read on signed_agreements
  for select to authenticated using (profile_id = auth.uid() or is_staff());
drop policy if exists signed_agreements_own_insert on signed_agreements;
create policy signed_agreements_own_insert on signed_agreements
  for insert to authenticated with check (profile_id = auth.uid() or is_staff());
drop policy if exists signed_agreements_admin_write on signed_agreements;
create policy signed_agreements_admin_write on signed_agreements
  for update to authenticated using (is_local_admin()) with check (is_local_admin());

create table if not exists customer_details (
  profile_id       uuid primary key references profiles(id) on delete cascade,
  default_address  text,
  customer_type    text check (customer_type is null or customer_type in ('Residential','Commercial')),
  -- Staff-only: the customer must never read this column.
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table customer_details is 'Facts that only a customer account has. A customer with no account is just the payer details on their jobs.';
comment on column customer_details.notes is 'Internal notes about this customer. Staff only.';
drop trigger if exists customer_details_updated_at on customer_details;
create trigger customer_details_updated_at before update on customer_details
  for each row execute function set_updated_at();
alter table customer_details enable row level security;
drop policy if exists customer_details_staff_all on customer_details;
create policy customer_details_staff_all on customer_details
  for all to authenticated using (is_staff()) with check (is_staff());
-- No policy for customers here on purpose: row-level security cannot hide a
-- single column, so a customer's own row would expose `notes`. Customers read
-- their details through a view that leaves `notes` out (added in 045).
