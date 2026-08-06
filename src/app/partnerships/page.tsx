import Link from "next/link";
import TopBar from "@/components/TopBar";
import FilterBar, { FilterSelect, FilterText } from "@/components/FilterBar";
import {
  filterPartnerships,
  followUpLabel,
  followUpState,
  getPartnerships,
  getReferralCounts,
  isLead,
  PARTNERSHIP_SORTS,
} from "@/lib/partnerships";
import { active, getLists, lookup, nameMap } from "@/lib/data";
import { dateDisplay, money, phoneDisplay } from "@/lib/format";
import type { Partnership } from "@/lib/types";

const DUE_TONE: Record<string, string> = {
  overdue: "border-[var(--color-danger)] bg-red-50 text-[var(--color-danger)]",
  today: "border-[var(--color-warn)] text-[var(--color-warn)]",
  upcoming: "border-[var(--color-line)] text-[var(--color-muted)]",
  none: "border-[var(--color-line)] text-[var(--color-muted)]",
};

function FollowUp({ p }: { p: Partnership }) {
  const state = followUpState(p);
  if (state === "none") return <span className="muted">—</span>;
  return <span className={`badge ${DUE_TONE[state]}`}>{followUpLabel(p)}</span>;
}

function PipelineBadge({ p }: { p: Partnership }) {
  return isLead(p) ? (
    <span className="badge border-[var(--color-line)] text-[var(--color-muted)]">Lead</span>
  ) : (
    <span className="badge border-[var(--color-good)] text-[var(--color-good)]">Partner</span>
  );
}

export default async function PartnershipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [lists, all, referrals] = await Promise.all([
    getLists(),
    getPartnerships(),
    getReferralCounts(),
  ]);
  const names = nameMap(lists);

  const filters = {
    q: sp.q ?? "",
    pipeline: sp.pipeline ?? "",
    status: sp.status ?? "",
    tier: sp.tier ?? "",
    zone: sp.zone ?? "",
    due: sp.due ?? "",
    sort: sp.sort ?? "follow_up",
  };
  const rows = filterPartnerships(all, filters);
  const anyFilter = [
    filters.q,
    filters.pipeline,
    filters.status,
    filters.tier,
    filters.zone,
    filters.due,
  ].some(Boolean);

  // Counts are always of the whole book, so the header does not move as you filter.
  const leadCount = all.filter(isLead).length;
  const partnerCount = all.length - leadCount;
  const dueCount = all.filter((p) => {
    const s = followUpState(p);
    return s === "overdue" || s === "today";
  }).length;

  return (
    <>
      <TopBar
        title="Partnerships"
        action={
          <Link href="/partnerships/new" className="btn btn-sm btn-primary shrink-0">
            + New
          </Link>
        }
      />
      <main className="page">
        {/* Pipeline shortcuts — the common views without touching the filter form. */}
        <div className="mb-3 flex flex-wrap gap-1">
          <Link
            href="/partnerships"
            className={`btn btn-sm ${!filters.pipeline && !filters.due ? "btn-primary" : ""}`}
          >
            All ({all.length})
          </Link>
          <Link
            href="/partnerships?pipeline=lead"
            className={`btn btn-sm ${filters.pipeline === "lead" ? "btn-primary" : ""}`}
          >
            Leads ({leadCount})
          </Link>
          <Link
            href="/partnerships?pipeline=signed"
            className={`btn btn-sm ${filters.pipeline === "signed" ? "btn-primary" : ""}`}
          >
            Partners ({partnerCount})
          </Link>
          <Link
            href="/partnerships?due=due"
            className={`btn btn-sm ${filters.due === "due" ? "btn-primary" : ""}`}
          >
            Follow up now ({dueCount})
          </Link>
        </div>

        <FilterBar action="/partnerships" active={anyFilter}>
          <FilterText
            name="q"
            label="Search"
            value={filters.q}
            placeholder="Business, contact, address"
          />
          <FilterSelect
            name="pipeline"
            label="Stage"
            value={filters.pipeline}
            options={[
              { id: "lead", name: "Leads only" },
              { id: "signed", name: "Signed partners only" },
            ]}
          />
          <FilterSelect
            name="status"
            label="Status"
            value={filters.status}
            options={active(lists.partnership_status)}
          />
          <FilterSelect
            name="due"
            label="Follow-up"
            value={filters.due}
            options={[
              { id: "due", name: "Due today or overdue" },
              { id: "overdue", name: "Overdue only" },
            ]}
            allLabel="Any"
          />
          <FilterSelect
            name="tier"
            label="Tier"
            value={filters.tier}
            options={active(lists.partnership_tier)}
          />
          <FilterSelect name="zone" label="Zone" value={filters.zone} options={active(lists.zone)} />
          <FilterSelect
            name="sort"
            label="Sort by"
            value={filters.sort}
            options={PARTNERSHIP_SORTS.map((s) => ({ id: s.value, name: s.label }))}
            allLabel="Follow-up due"
          />
        </FilterBar>

        <p className="muted mb-2 text-sm">
          {rows.length} of {all.length}
        </p>

        {/* Mobile: cards */}
        <div className="flex flex-col gap-2 md:hidden">
          {rows.map((p) => {
            const ref = referrals.get(p.id);
            return (
              <Link
                key={p.id}
                href={`/partnerships/${p.id}`}
                className="card card-pad block"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold">{p.business_name}</span>
                  <PipelineBadge p={p} />
                </div>
                <div className="muted text-sm">
                  {lookup(names, p.status_id)}
                  {!isLead(p) && ` · ${lookup(names, p.tier_id)}`}
                </div>
                {p.poc_name && (
                  <div className="text-sm">
                    {p.poc_name}
                    {p.poc_phone ? ` · ${phoneDisplay(p.poc_phone)}` : ""}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <FollowUp p={p} />
                  <span className="muted">last contact {dateDisplay(p.last_contact)}</span>
                </div>
                {!isLead(p) && (
                  <div className="mono mt-1 text-sm">
                    {ref?.jobs ?? 0} referral{(ref?.jobs ?? 0) === 1 ? "" : "s"} ·{" "}
                    {money(ref?.revenue ?? 0)}
                  </div>
                )}
              </Link>
            );
          })}
          {rows.length === 0 && (
            <p className="muted card card-pad text-sm">No partnerships match these filters.</p>
          )}
        </div>

        {/* Desktop: table */}
        <div className="card hidden md:block">
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Contact</th>
                  <th>Last contact</th>
                  <th>Follow-up</th>
                  <th>Tier</th>
                  <th>Referrals</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const ref = referrals.get(p.id);
                  const lead = isLead(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/partnerships/${p.id}`} className="link font-semibold">
                          {p.business_name}
                        </Link>
                        {p.address && <div className="muted text-xs">{p.address}</div>}
                      </td>
                      <td>
                        <PipelineBadge p={p} />
                      </td>
                      <td>{lookup(names, p.status_id)}</td>
                      <td className="whitespace-nowrap">
                        {p.poc_name}
                        {p.poc_phone && (
                          <div className="muted text-xs">{phoneDisplay(p.poc_phone)}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap">{dateDisplay(p.last_contact)}</td>
                      <td className="whitespace-nowrap">
                        <FollowUp p={p} />
                      </td>
                      <td className="text-xs">{lead ? "—" : lookup(names, p.tier_id)}</td>
                      <td className="mono">{lead ? "—" : (ref?.jobs ?? 0)}</td>
                      <td className="mono">{lead ? "—" : money(ref?.revenue ?? 0)}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="muted">
                      No partnerships match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="muted mt-3 text-xs">
          A partnership counts as a lead until it has a signed date. Leads stay out of New
          Partnerships, the tier breakdown and every other dashboard figure.
        </p>
      </main>
    </>
  );
}
