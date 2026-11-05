/**
 * Signs in against staging and fetches every route, checking each actually
 * renders. A typecheck proves the code compiles; this proves the pages run.
 *
 *   node scripts/smoke.mjs [baseUrl]
 */
import { readFileSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3100";
const env = Object.fromEntries(
  readFileSync(".env.staging", "utf8").split(/\r?\n/)
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));

if (!env.SMOKE_EMAIL || !env.SMOKE_PASSWORD) {
  console.error("FAIL  set SMOKE_EMAIL and SMOKE_PASSWORD in .env.staging");
  process.exit(1);
}

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const REF = new globalThis.URL(URL_).hostname.split(".")[0];

/* --- sign in and build the cookie @supabase/ssr expects ---------------- */
const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "content-type": "application/json" },
  // Read from .env.staging, never committed: the repo is public and staging
  // holds a copy of real business data.
  body: JSON.stringify({ email: env.SMOKE_EMAIL, password: env.SMOKE_PASSWORD }),
});
if (!res.ok) {
  console.error("FAIL  could not sign in:", res.status, (await res.text()).slice(0, 200));
  process.exit(1);
}
const session = await res.json();

const payload = "base64-" + Buffer.from(JSON.stringify({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_at: session.expires_at,
  expires_in: session.expires_in,
  token_type: "bearer",
  user: session.user,
})).toString("base64");

// Long values are split across numbered cookies, same as the browser client.
const CHUNK = 3180;
const cookies = [];
if (payload.length <= CHUNK) cookies.push(`sb-${REF}-auth-token=${payload}`);
else for (let i = 0, n = 0; i < payload.length; i += CHUNK, n++)
  cookies.push(`sb-${REF}-auth-token.${n}=${payload.slice(i, i + CHUNK)}`);
const COOKIE = cookies.join("; ");

/* --- the routes -------------------------------------------------------- */
const ids = {};
{
  const r = await fetch(`${URL_}/rest/v1/partnerships?select=id&limit=1`,
    { headers: { apikey: ANON, authorization: `Bearer ${session.access_token}` } });
  ids.partnership = (await r.json())[0]?.id;
  const j = await fetch(`${URL_}/rest/v1/jobs?select=id&limit=1`,
    { headers: { apikey: ANON, authorization: `Bearer ${session.access_token}` } });
  ids.job = (await j.json())[0]?.id;
  const e = await fetch(`${URL_}/rest/v1/entities?select=id&limit=1`,
    { headers: { apikey: ANON, authorization: `Bearer ${session.access_token}` } });
  ids.entity = (await e.json())[0]?.id;
}

const ROUTES = [
  "/", "/jobs", "/jobs/new", `/jobs/${ids.job}`,
  "/partnerships", "/partnerships/new", `/partnerships/${ids.partnership}`,
  "/contacts", "/campaigns", "/visits",
  "/roster", "/roster/new", `/roster/${ids.entity}`, `/roster/${ids.entity}/edit`,
  "/reports", "/time-clock", "/face-to-face",
  "/settings", "/settings/values", "/settings/templates", "/settings/equipment",
  "/settings/zones", "/settings/appearance", "/settings/face-to-face", "/settings/calendar",
  "/settings/lists/service_category", "/settings/lists/contact_role",
  "/settings/lists/partnership_status", "/settings/lists/partnership_tier",
];

let fails = 0, skipped = 0;
for (const path of ROUTES) {
  if (path.includes("undefined")) { skipped++; console.log(`SKIP  ${path}`); continue; }
  try {
    const r = await fetch(BASE + path, { headers: { cookie: COOKIE }, redirect: "manual" });
    const body = r.status === 200 ? await r.text() : "";
    const loggedOut = r.status === 307 && (r.headers.get("location") || "").includes("/login");
    const serverError = body.includes("Application error") ||
                        body.includes("Internal Server Error") ||
                        body.includes("digest\":");
    if (loggedOut)        { fails++; console.log(`FAIL  ${path.padEnd(42)} bounced to /login (auth cookie rejected)`); }
    else if (r.status !== 200) { fails++; console.log(`FAIL  ${path.padEnd(42)} HTTP ${r.status}`); }
    else if (serverError) { fails++; console.log(`FAIL  ${path.padEnd(42)} rendered an error page`); }
    else console.log(`ok    ${path.padEnd(42)} ${(body.length / 1024).toFixed(0)}kb`);
  } catch (e) {
    fails++; console.log(`FAIL  ${path.padEnd(42)} ${e.message}`);
  }
}

console.log(`\n${ROUTES.length - skipped - fails}/${ROUTES.length - skipped} routes rendered${skipped ? `, ${skipped} skipped` : ""}.`);
process.exitCode = fails ? 1 : 0;
