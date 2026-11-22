-- =====================================================================
-- 034 — profiles and roles
-- Adds one `profiles` row per login, carrying its role (customer, worker,
-- dispatcher, local_admin). Every existing auth user is backfilled as
-- local_admin, so the owner keeps full access in the browser app. The
-- three helper functions are what the staff-only policies in 035 will use.
-- Safe to re-run.
-- =====================================================================

create table if not exists profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  role                 text not null default 'customer'
                       check (role in ('customer','worker','dispatcher','local_admin')),
  -- Deactivated accounts keep their rows but lose access (see is_staff below).
  status               text not null default 'active'
                       check (status in ('active','deactivated')),
  full_name            text not null,
  phone                text,
  email                text,
  -- Push / email choices, free-form until the notification UI settles.
  notification_prefs   jsonb not null default '{}'::jsonb,
  -- True for accounts an admin created, until the person picks a password.
  must_change_password boolean not null default false,
  -- Who created this account. Null means the person signed themselves up.
  created_by           uuid references profiles(id) on delete set null,
  login_link_created_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table profiles is 'One row per login. Holds only what every account has; role-specific data lives in its own tables (entities for workers, customer_details for customers).';
comment on column profiles.role is 'The single role this account has. Decides which screens and rows it can reach.';
comment on column profiles.status is 'active or deactivated. A deactivated account loses staff access but keeps its history.';
comment on column profiles.must_change_password is 'True for admin-created accounts until the person sets their own password.';
comment on column profiles.created_by is 'The admin who created the account; null when the person signed up themselves.';

create index if not exists profiles_email_idx on profiles (lower(email));
create index if not exists profiles_phone_idx on profiles (regexp_replace(coalesce(phone,''), '\D', '', 'g'));

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Helper functions. Security definer so policies can call them without
-- recursing through profiles' own row-level security.
-- ---------------------------------------------------------------------
create or replace function my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and status = 'active';
$$;
comment on function my_role() is 'The signed-in account''s role, or null if the account is missing or deactivated.';

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('dispatcher','local_admin'), false);
$$;
comment on function is_staff() is 'True when the signed-in account is an active dispatcher or local admin. Staff can read the base tables.';

create or replace function is_local_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() = 'local_admin', false);
$$;
comment on function is_local_admin() is 'True when the signed-in account is an active local admin.';

-- ---------------------------------------------------------------------
-- Backfill: every login that exists today becomes a local_admin. This is
-- the owner, the only account the browser app uses.
-- ---------------------------------------------------------------------
insert into profiles (id, role, full_name, email)
select u.id,
       'local_admin',
       coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email, 'Owner'),
       u.email
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Row-level security on profiles. Everyone can read their own row; staff
-- can read all rows; only a local admin can change or create rows here.
-- Users changing their own name or phone go through a server action, so
-- the role column stays out of their reach.
-- ---------------------------------------------------------------------
alter table profiles enable row level security;

drop policy if exists profiles_read_own_or_staff on profiles;
create policy profiles_read_own_or_staff on profiles
  for select to authenticated
  using (id = auth.uid() or is_staff());

drop policy if exists profiles_admin_write on profiles;
create policy profiles_admin_write on profiles
  for all to authenticated
  using (is_local_admin())
  with check (is_local_admin());
