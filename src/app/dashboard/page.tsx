import TopBar from "@/components/TopBar";
import BarChart from "@/components/BarChart";
import { Stat, StatGrid } from "@/components/Detail";
import { getDashboard } from "@/lib/dashboard";
import { getLists, getSettings, nameMap } from "@/lib/data";
import { RANGE_PRESETS, rangeLabel, resolveRange, type RangePreset } from "@/lib/dates";
import { money, num, percent } from "@/lib/format";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const preset = (RANGE_PRESETS as readonly string[]).includes(sp.preset ?? "")
    ? (sp.preset as RangePreset)
    : "This Month";
  const range = resolveRange(preset, sp.start, sp.end);

  const [lists, settings] = await Promise.all([getLists(), getSettings()]);
  const data = await getDashboard(range, nameMap(lists));

  const monthPct = settings.monthly_jobs_goal
    ? (data.jobsThisMonth / settings.monthly_jobs_goal) * 100
    : 0;

  return (
    <>
      <TopBar title="Dashboard" />
      <main className="page">
        {/* ---------- range selector: drives every figure below ---------- */}
        <form method="get" action="/dashboard" className="card card-pad mb-3">
          <div className="mb-2 flex flex-wrap gap-1">
            {RANGE_PRESETS.filter((p) => p !== "Custom").map((p) => (
              <button
                key={p}
                type="submit"
                name="preset"
                value={p}
                className={`btn btn-sm ${preset === p ? "btn-primary" : ""}`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
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
            <button
              type="submit"
              name="preset"
              value="Custom"
              className={`btn btn-sm ${preset === "Custom" ? "btn-primary" : ""}`}
            >
              Apply custom range
            </button>
          </div>
          <p className="muted mt-2 text-xs">Showing {rangeLabel(range)}.</p>
        </form>

        {/* ---------- goals ---------- */}
        <Panel title="Goals">
          <StatGrid>
            <Stat
              label="Leads today"
              value={`${data.leadsToday} / ${settings.daily_leads_goal}`}
              emphasis={data.leadsToday >= settings.daily_leads_goal ? "good" : null}
              sub="jobs created today"
            />
            <Stat
              label="Partnerships today"
              value={`${data.partnershipsToday} / ${settings.daily_partnerships_goal}`}
              emphasis={
                data.partnershipsToday >= settings.daily_partnerships_goal ? "good" : null
              }
              sub="added today"
            />
            <Stat
              label="Jobs this month"
              value={`${data.jobsThisMonth} / ${settings.monthly_jobs_goal}`}
              emphasis={monthPct >= 100 ? "good" : null}
              sub={`${percent(monthPct, 0)} complete`}
            />
          </StatGrid>
          <p className="muted mt-2 text-xs">
            Goals always read today and the current month — the range selector does not
            apply to them.
          </p>
        </Panel>

        {/* ---------- volume ---------- */}
        <Panel title="Volume">
          <StatGrid>
            <Stat label="Jobs completed" value={num(data.jobsCompleted, 0)} />
            <Stat label="Jobs booked" value={num(data.jobsBooked, 0)} />
            <Stat label="Jobs cancelled" value={num(data.jobsCancelled, 0)} />
          </StatGrid>
        </Panel>

        {/* ---------- revenue & profit ---------- */}
        <Panel title="Revenue & Profit">
          <StatGrid>
            <Stat label="Total revenue" value={money(data.totalRevenue)} />
            <Stat
              label="Total profit"
              value={money(data.totalProfit)}
              emphasis={data.totalProfit < 0 ? "bad" : "good"}
            />
            <Stat label="Avg profit / job" value={money(data.avgProfitPerJob)} />
          </StatGrid>
          <div className="mt-3">
            <h3 className="label">Revenue by service category</h3>
            <BarChart data={data.revenueByCategory} valueFormat={money} />
          </div>
        </Panel>

        {/* ---------- the two charts ---------- */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Panel title="Completed Jobs by Category">
            <BarChart data={data.completedByCategory} valueFormat={(n) => num(n, 0)} />
          </Panel>
          <Panel title="Leads by Source">
            <BarChart data={data.leadsBySource} valueFormat={(n) => num(n, 0)} />
          </Panel>
        </div>

        {/* ---------- demand generation ---------- */}
        <Panel title="Demand Generation">
          <StatGrid>
            <Stat
              label="Leads generated"
              value={num(data.leadsGenerated, 0)}
              sub="all jobs created in range"
            />
            <Stat
              label="Conversion rate"
              value={percent(data.conversionRate)}
              sub="completed ÷ leads"
            />
          </StatGrid>
        </Panel>

        {/* ---------- partnerships ---------- */}
        <Panel title="Partnerships">
          <StatGrid>
            <Stat label="New partnerships" value={num(data.newPartnerships, 0)} />
            <Stat label="Referrals produced" value={num(data.referralsProduced, 0)} />
            <Stat
              label="Cards dropped"
              value={num(data.cardsDropped, 0)}
              sub="running total"
            />
            <Stat
              label="Fliers dropped"
              value={num(data.fliersDropped, 0)}
              sub="running total"
            />
          </StatGrid>
          <div className="mt-3">
            <h3 className="label">Partnerships by tier</h3>
            <BarChart data={data.partnershipsByTier} valueFormat={(n) => num(n, 0)} />
          </div>
        </Panel>

        {/* ---------- customer behaviour ---------- */}
        <Panel title="Customer Behavior">
          <StatGrid>
            <Stat label="Repeat customer rate" value={percent(data.repeatCustomerRate)} />
          </StatGrid>
        </Panel>

        <p className="muted mt-4 text-xs">
          Volume, revenue and profit are scoped by invoice date (falling back to arrival
          date, then created date). Leads, conversion and referrals are scoped by the date
          the job was created. New partnerships use their date added. Cards and fliers are
          lifetime running totals across every partnership.
        </p>
      </main>
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card mb-3">
      <div className="section-title">{title}</div>
      <div className="card-pad">{children}</div>
    </section>
  );
}
