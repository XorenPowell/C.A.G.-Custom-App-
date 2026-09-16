import Link from "next/link";
import { getDashboard } from "@/lib/dashboard";
import { getBookedToday } from "@/lib/home";
import { getLists, getSettings, lookup, nameMap } from "@/lib/data";
import {
  RANGE_PRESETS,
  payPeriodRange,
  rangeLabel,
  resolveRange,
  type RangePreset,
} from "@/lib/dates";
import { money, timeDisplay } from "@/lib/format";

const NAV_ITEMS: { href: string; label: string; badge?: string }[] = [
  { href: "/jobs", label: "Jobs" },
  { href: "/roster", label: "Roster" },
  { href: "/partnerships", label: "Partnerships" },
  { href: "/face-to-face", label: "Work Face to Face", badge: "New" },
  { href: "/settings", label: "Settings" },
  { href: "/time-clock", label: "Clock In / Clock Out" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  // "Today" is the natural landing default here — unlike the detailed report,
  // which defaults to "This Month" for a monthly business overview.
  const preset = (RANGE_PRESETS as readonly string[]).includes(sp.preset ?? "")
    ? (sp.preset as RangePreset)
    : "Today";
  const range = resolveRange(preset, sp.start, sp.end);

  const [lists, settings] = await Promise.all([getLists(), getSettings()]);
  const names = nameMap(lists);

  const [data, bookedToday] = await Promise.all([
    getDashboard(range, names),
    getBookedToday(),
  ]);

  // Next payout is a fixed weekly cycle, not the selected range — the most
  // recent occurrence of the configured start day through today, inclusive.
  const payPeriod = payPeriodRange(settings.pay_period_start_day ?? 5);
  const payoutData = await getDashboard(payPeriod, names);

  return (
    <>
      {/* ---------- hero ---------- */}
      <section
        className="relative overflow-hidden px-4 pb-8 pt-6 text-white"
        style={{ background: "linear-gradient(155deg, var(--hero-a), var(--hero-b), var(--hero-c))" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(10,11,13,0) 40%, rgba(10,11,13,0.55) 100%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center justify-between text-sm text-white/70">
            <span className="font-heading font-bold tracking-wide">C.A.G.</span>
            <span>{rangeLabel(range)}</span>
          </div>

          <h1 className="font-heading mt-3 text-[30px] font-medium leading-tight">
            Welcome, Xoren
          </h1>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[var(--radius-card)] border border-white/10 bg-white/[0.07] p-3">
              <div className="text-xs text-white/70">Total Jobs Completed</div>
              <div className="font-heading mt-1 text-2xl font-semibold">
                {data.jobsCompleted}
              </div>
            </div>
            <div className="rounded-[var(--radius-card)] border border-white/10 bg-white/[0.07] p-3">
              <div className="text-xs text-white/70">Commission</div>
              <div className="font-heading mt-1 text-2xl font-semibold text-[var(--money)]">
                {money(data.totalCommission)}
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm text-white/80">
            Next payout: <span className="font-heading font-semibold text-white">{money(payoutData.totalCommission)}</span>
          </p>
        </div>
      </section>

      {/* ---------- range selector ---------- */}
      <section className="mx-auto max-w-6xl px-4 pt-4">
        <form method="get" action="/">
          <div className="flex flex-wrap gap-2">
            {RANGE_PRESETS.filter((p) => p !== "Custom").map((p) => (
              <button
                key={p}
                type="submit"
                name="preset"
                value={p}
                className={`pill ${preset === p ? "pill-active" : ""}`}
              >
                {p}
              </button>
            ))}
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-[var(--color-muted)] underline underline-offset-2">
              Custom range
            </summary>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="field mb-0">
                <label className="label" htmlFor="start">
                  From
                </label>
                <input
                  id="start"
                  name="start"
                  type="date"
                  defaultValue={sp.start ?? ""}
                  className="input"
                />
              </div>
              <div className="field mb-0">
                <label className="label" htmlFor="end">
                  To
                </label>
                <input
                  id="end"
                  name="end"
                  type="date"
                  defaultValue={sp.end ?? ""}
                  className="input"
                />
              </div>
              <button type="submit" name="preset" value="Custom" className="btn btn-sm">
                Apply custom range
              </button>
            </div>
          </details>
        </form>
      </section>

      {/* ---------- booked today: full-bleed, always today, ignores the range above ---------- */}
      <section className="mt-4 border-y border-[var(--border)] bg-[var(--panel)] py-4">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--live)] opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-[var(--live)]" />
            </span>
            <h2 className="font-heading flex-1 text-sm font-semibold uppercase tracking-wide">
              Booked Today
            </h2>
            <span className="badge border-[var(--pill-border)] bg-[var(--pill-bg)] text-[var(--text)]">
              {bookedToday.length}
            </span>
          </div>

          {bookedToday.length === 0 ? (
            <p className="muted text-sm">No jobs booked for today yet.</p>
          ) : (
            <div className="scroll-x flex gap-3 pb-1">
              {bookedToday.map((t) => (
                <Link
                  key={t.id}
                  href={`/jobs/${t.id}`}
                  className="flex w-64 shrink-0 flex-col justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel-raised)] p-3"
                >
                  <div>
                    <div className="font-heading text-lg font-semibold">
                      {t.arrival_time ? timeDisplay(t.arrival_time) : "No time set"}
                    </div>
                    <div className="mt-0.5 text-sm text-[var(--text-muted)]">
                      {lookup(names, t.service_category_id)}
                    </div>
                    <div className="mt-1 truncate text-sm text-[var(--text-faint)]">
                      {t.address || "No address"}
                    </div>
                  </div>
                  <div className="mt-2 flex h-10 items-center border-t border-dashed border-[var(--ticket-divider)] text-sm font-medium">
                    {t.entityNames.length ? t.entityNames.join(", ") : "Unassigned"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- navigation ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-4">
        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="card flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--panel-raised)]"
            >
              <span className="flex items-center gap-2">
                <span className="font-semibold">{item.label}</span>
                {item.badge && (
                  <span className="badge border-[var(--pill-active-border)] bg-[var(--pill-active-bg)] text-[var(--color-accent)]">
                    {item.badge}
                  </span>
                )}
              </span>
              <span aria-hidden className="text-[var(--color-muted)]">
                ›
              </span>
            </Link>
          ))}
        </nav>

        <Link
          href="/reports"
          className="mt-3 inline-block text-sm text-[var(--color-muted)] underline underline-offset-2"
        >
          Full report →
        </Link>
      </section>
    </>
  );
}
