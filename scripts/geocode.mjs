/**
 * One-off: turn partnership addresses into coordinates.
 *
 *   node scripts/geocode.mjs                      # dry run against .env.local
 *   node scripts/geocode.mjs .env.live-readonly   # dry run against live
 *   node scripts/geocode.mjs .env.local --write   # persist
 *
 * US Census Bureau geocoder: free, no key, and no restriction on storing
 * what it returns. Google's Maps Platform terms cap how long a geocode may
 * be cached, which rules out keeping lat/lng in our own table.
 *
 * Dry run by default, and it always prints which Supabase project it is
 * talking to before doing anything, because the difference between live
 * and staging is one character in a URL.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const write = args.includes("--write");
const envFile = args.find((a) => !a.startsWith("--")) ?? ".env.local";

for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error(`No Supabase credentials in ${envFile}.`);
  process.exit(1);
}

const db = createClient(url, key);
console.log(`env     ${envFile}`);
console.log(`project ${url}`);
console.log(`mode    ${write ? "WRITE" : "dry run"}\n`);

const BENCHMARK = "Public_AR_Current";
const ENDPOINT = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

/**
 * The book stores street addresses with no city, because every one of them
 * is in Chicago. The geocoder needs the full line, so it is completed here
 * rather than rewritten in the database.
 */
function fullAddress(raw) {
  const a = raw.trim().replace(/\s+/g, " ");
  if (/\b(IL|Illinois)\b/i.test(a)) return a;
  if (/chicago/i.test(a)) return `${a}, IL`;
  return `${a}, Chicago, IL`;
}

async function geocode(address) {
  const qs = new URLSearchParams({
    address: fullAddress(address),
    benchmark: BENCHMARK,
    format: "json",
  });
  const res = await fetch(`${ENDPOINT}?${qs}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const match = body?.result?.addressMatches?.[0];
  if (!match?.coordinates) return null;
  // Census returns x as longitude and y as latitude. Swapping these is the
  // classic way to end up with every stop in the Indian Ocean.
  return {
    latitude: Number(match.coordinates.y),
    longitude: Number(match.coordinates.x),
    matched: match.matchedAddress,
  };
}

const { data, error } = await db
  .from("partnerships")
  .select("id, business_name, address, latitude")
  .not("address", "is", null)
  .is("latitude", null);
if (error) {
  console.error(error.message);
  process.exit(1);
}

const todo = data.filter((p) => p.address && p.address.trim() !== "");
console.log(`${todo.length} partnerships to place\n`);

let placed = 0;
let missed = 0;
const failures = [];

for (const p of todo) {
  let hit = null;
  try {
    hit = await geocode(p.address);
  } catch (e) {
    failures.push(`${p.business_name}: ${e.message}`);
  }

  if (!hit) {
    missed++;
    failures.push(`${p.business_name} — ${p.address}`);
    process.stdout.write("·");
  } else {
    placed++;
    process.stdout.write("+");
    if (write) {
      const { error: upErr } = await db
        .from("partnerships")
        .update({
          latitude: hit.latitude,
          longitude: hit.longitude,
          geocoded_at: new Date().toISOString(),
        })
        .eq("id", p.id);
      if (upErr) failures.push(`${p.business_name}: save failed — ${upErr.message}`);
    }
  }
  // The Census service is free and unmetered but not infinite; one request
  // at a time with a breath between is plenty for a hundred addresses.
  await new Promise((r) => setTimeout(r, 120));
}

console.log(`\n\nplaced ${placed}   not found ${missed}`);
if (!write && placed > 0) console.log("Dry run — nothing saved. Re-run with --write.");
if (failures.length > 0) {
  console.log(`\nNot placed (${failures.length}):`);
  for (const f of failures) console.log("  " + f);
  console.log("\nThese keep working everywhere; they just sit out the visit sort.");
}
