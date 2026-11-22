-- =====================================================================
-- 041 — money
-- Adds worker expenses (each needs a receipt), a payout record for each
-- crew member's pay on a job, corrections to a payout without editing the
-- original, the Square payment linked to each job (set by hand for now),
-- and each worker's 1099 status by year. Safe to re-run.
-- =====================================================================

-- ---------- job_expenses ----------------------------------------------
create table if not exists job_expenses (
  id            uuid primary key default gen_random_uuid(),
  job_worker_id uuid not null references job_workers(id) on delete cascade,
  description   text not null,
  amount        numeric(12,2) not null check (amount >= 0),
  -- A receipt is required; there is no expense without one.
  receipt_path  text not null,
  added_at      timestamptz not null default now()
);
comment on table job_expenses is 'A worker''s out-of-pocket cost on a job. Each one needs a receipt file in the receipts bucket.';
alter table job_expenses enable row level security;
drop policy if exists job_expenses_staff_all on job_expenses;
create policy job_expenses_staff_all on job_expenses
  for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists job_expenses_own on job_expenses;
create policy job_expenses_own on job_expenses
  for all to authenticated
  using (job_worker_id in (select my_job_worker_ids()))
  with check (job_worker_id in (select my_job_worker_ids()));

-- ---------- payouts ----------------------------------------------------
create table if not exists payouts (
  id              uuid primary key default gen_random_uuid(),
  job_worker_id   uuid not null unique references job_workers(id) on delete cascade,
  -- The amount calculated when the payout was marked sent. Stored so a later
  -- change to rates does not rewrite what was paid.
  computed_amount numeric(12,2),
  status          text not null default 'pending' check (status in ('pending','sent')),
  method          text,
  sent_on         date,
  reference       text,
  marked_by       uuid references profiles(id) on delete set null,
  marked_at       timestamptz,
  created_at      timestamptz not null default now()
);
comment on table payouts is 'Whether a crew member''s pay for one job has been sent. The original amount is never edited; corrections go in payout_corrections.';
alter table payouts enable row level security;
drop policy if exists payouts_staff_all on payouts;
create policy payouts_staff_all on payouts
  for all to authenticated using (is_staff()) with check (is_staff());

create table if not exists payout_corrections (
  id            uuid primary key default gen_random_uuid(),
  payout_id     uuid not null references payouts(id) on delete cascade,
  kind          text not null check (kind in ('not_sent','different_amount')),
  real_amount   numeric(12,2),
  note          text,
  corrected_by  uuid references profiles(id) on delete set null,
  corrected_at  timestamptz not null default now(),
  check (kind <> 'different_amount' or real_amount is not null)
);
comment on table payout_corrections is 'A later correction to a payout: it was never sent, or it went out at a different amount. Records the fix without touching the original payout.';
alter table payout_corrections enable row level security;
drop policy if exists payout_corrections_staff_all on payout_corrections;
create policy payout_corrections_staff_all on payout_corrections
  for all to authenticated using (is_staff()) with check (is_staff());

-- ---------- customer_payments -----------------------------------------
create table if not exists customer_payments (
  id                 uuid primary key default gen_random_uuid(),
  job_id             uuid not null references jobs(id) on delete cascade,
  square_link        text,
  status             text not null default 'unpaid'
                     check (status in ('unpaid','partly_paid','paid','refunded','cancelled')),
  amount_invoiced    numeric(12,2),
  amount_paid        numeric(12,2),
  tip                numeric(12,2),
  amount_refunded    numeric(12,2),
  due_on             date,
  set_by             uuid references profiles(id) on delete set null,
  set_at             timestamptz,
  -- Empty until the Square API is connected.
  square_invoice_id  text,
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now()
);
comment on table customer_payments is 'The Square invoice for a job and its status. Set by hand for now. Overdue is derived from due_on, never stored.';
comment on column customer_payments.tip is 'Tip from the customer. Whether it counts toward commission is an open decision (see the data map section 12).';
create index if not exists customer_payments_job_idx on customer_payments (job_id);
alter table customer_payments enable row level security;
drop policy if exists customer_payments_staff_all on customer_payments;
create policy customer_payments_staff_all on customer_payments
  for all to authenticated using (is_staff()) with check (is_staff());

-- ---------- worker_tax_years ------------------------------------------
create table if not exists worker_tax_years (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entities(id) on delete cascade,
  tax_year      integer not null,
  filed_on      date,
  document_path text,
  note          text,
  created_at    timestamptz not null default now(),
  unique (entity_id, tax_year)
);
comment on table worker_tax_years is 'Each worker''s 1099 status for each tax year: filed date and the document, in the documents bucket.';
alter table worker_tax_years enable row level security;
drop policy if exists worker_tax_years_staff_all on worker_tax_years;
create policy worker_tax_years_staff_all on worker_tax_years
  for all to authenticated using (is_local_admin()) with check (is_local_admin());
