-- =====================================================================
-- 027 — Partnership coordinates
--
-- A day's visits are walked in whatever order they were booked, which is
-- not the order they sit on the street. Sorting them needs coordinates,
-- and an address string is not one.
--
-- Geocoded once by scripts/geocode.mjs against the US Census Bureau
-- geocoder: free, no key, no rate limit worth worrying about, and — the
-- deciding point — no restriction on storing what it returns. Google's
-- Maps Platform terms cap how long a geocode may be cached, which rules
-- out keeping lat/lng in our own table.
--
-- geocoded_at records when, so a re-run can skip what is already done and
-- a changed address can be spotted later. Nullable throughout: a
-- partnership with no address, or one the geocoder could not place, keeps
-- working everywhere and simply does not take part in the sort.
--
-- Run once. Safe to re-run.
-- =====================================================================

alter table partnerships
  add column if not exists latitude    double precision,
  add column if not exists longitude   double precision,
  add column if not exists geocoded_at timestamptz;

-- Chicago sits near 41.88 N, 87.63 W. The bounds are deliberately loose —
-- they are here to catch a swapped lat/lng or a geocoder returning the
-- centre of the country, not to police the service area.
alter table partnerships drop constraint if exists partnerships_coords_plausible;
alter table partnerships add constraint partnerships_coords_plausible
  check (
    (latitude is null and longitude is null)
    or (latitude between 40.0 and 43.5 and longitude between -89.5 and -86.0)
  );

create index if not exists partnerships_geocoded_idx
  on partnerships (geocoded_at) where latitude is not null;
