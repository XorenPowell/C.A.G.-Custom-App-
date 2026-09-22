import Link from "next/link";
import TopBar from "@/components/TopBar";
import FilterBar, { FilterCheckbox, FilterSelect, FilterText } from "@/components/FilterBar";
import ZoneMaturityCard from "@/components/ZoneMaturityCard";
import {
  filterPartnerships,
  followUpLabel,
  followUpState,
  getPartnerships,
  getReferralCounts,
  maturityTone,
  PARTNERSHIP_SORTS,
} from "@/lib/partnerships";
import { active, getLists, getSettings, lookup, nameMap } from "@/lib/data";
import { partnershipStageId, stageTone } from "@/lib/lists";
import { dateDisplay, money, phoneDisplay } from "@/lib/format";
import type { Partnership } from "@/lib/types";

const DUE_TONE: Record<string, string> = {
  overdue: "border-[var(--color-danger)] bg-[var(--panel-raised)] text-[var(--color-danger)]",
  today: "border-[var(--color-warn)] text-[var(--color-warn)]",
  upcoming: "border-[var(--color-line)] text-[var(--color-muted)]",
  none: "border-[var(--color-line)] text-[var(--color-muted)]",
};

const STAGE_TONE: Record<string, string> = {
  good: "border-[var(--color-good)] text-[var(--color-good)]",
  warn: "border-[var(--color-warn)] text-[var(--color-warn)]",
  muted: "border-[var(--color-line)] text-[var(--color-muted)]",
};

function FollowUp({ p }: { p: Partnership }) {
  const state = followUpState(p);
  if (state === "none") return <span className="muted">—</span>;
  return <span className={`badge ${DUE_TONE[state]}`}>{followUpLabel(p)}</span>;
}

function StageBadge({ name }: { name: string }) {
  return <span className={`badge ${STAGE_TONE[stageTone(name)]}`}>{name || "—"}</span>;
}

export default async function PartnershipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [lists, all, referrals, settings] = await Promise.all([
    getLists(),
    getPartnerships(),
    getReferralCounts(),
    getSettings(),
  ]);
  const names = nameMap(lists);

  const rejectedId = partnershipStageId(lists, "Rejected");
  const excludeRejected = sp.excludeRejected === "1";

  // The zone-maturity card is the one Zone control on this screen — picking
  // a zone there also filters the list below. Defaults to the first zone
  // when none is picked yet, so the card always has something to show.
  const activeZones = active(lists.zone);
  const zoneId = sp.zone || activeZones[0]?.id || null;

  function buildHref(next: Record<string, string>) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...next })) {
      if (v) params.set(k, v);
    }
    return `/partnerships?${params.toString()}`;
  }

  const filters = {
    q: sp.q ?? "",
    status: sp.status ?? "",
    tier: sp.tier ?? "",
    zone: zoneId ?? "",
    due: sp.due ?? "",
    sort: sp.sort ?? "follow_up",
    excludeStatusId: excludeRejected ? rejectedId : null,
  };
  const rows = filterPartnerships(all, filters);
  const anyFilter = [
    filters.q,
    filters.status,
    filters.tier,
    filters.due,
    excludeRejected,
  ].some(Boolean);

  // Counts are always of the whole book, so the header does not move as you filter.
  const visitedId = partnershipStageId(lists, "Visited");
  const developingId = partnershipStageId(lists, "Developing");
  const matureId = partnershipStageId(lists, "Mature");
  const visitedCount = all.filter((p) => p.status_id === visitedId).length;
  const developingCount = all.filter((p) => p.status_id === developingId).length;
  const matureCount = all.filter((p) => p.status_id === matureId).length;
  const dueCount = all.filter((p) => {
    const s = followUpState(p);
    return s === "overdue" || s === "today";
  }).length;

  const zoneMatureCount = zoneId
    ? all.filter((p) => p.zone_id === zoneId && p.status_id === matureId).length
    : 0;
  const maturityTarget = settings.mature_partnership_goal_per_zone || 30;
  const maturityPercent = Math.round((zoneMatureCount / maturityTarget) * 100);

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
        <ZoneMaturityCard
          zones={activeZones.map((z) => ({ id: z.id, name: z.name }))}
          selectedZoneId={zoneId}
          currentParams={sp}
          percent={maturityPercent}
          tone={maturityTone(maturityPercent)}
        />

        {/* Stage shortcuts — the common views without touching the filter form. */}
        <div className="mb-3 flex flex-wrap gap-1">
          <Link
            href={buildHref({ status: "", due: "" })}
            className={`btn btn-sm ${!filters.status && !filters.due ? "btn-primary" : ""}`}
          >
            All ({all.length})
          </Link>
          {visitedId && (
            <Link
              href={buildHref({ status: visitedId, due: "" })}
              className={`btn btn-sm ${filters.status === visitedId ? "btn-primary" : ""}`}
            >
              Visited ({visitedCount})
            </Link>
          )}
          {developingId && (
            <Link
              href={buildHref({ status: developingId, due: "" })}
              className={`btn btn-sm ${filters.status === developingId ? "btn-primary" : ""}`}
            >
              Developing ({developingCount})
            </Link>
          )}
          {matureId && (
            <Link
              href={buildHref({ status: matureId, due: "" })}
              className={`btn btn-sm ${filters.status === matureId ? "btn-primary" : ""}`}
            >
              Mature ({matureCount})
            </Link>
          )}
          <Link
            href={buildHref({ due: "due", status: "" })}
            className={`btn btn-sm ${filters.due === "due" ? "btn-primary" : ""}`}
          >
            Follow up now ({dueCount})
          </Link>
        </div>

        <FilterBar action="/partnerships" active={anyFilter}>
          {/* Zone lives in the maturity card above, not this form — but the
              form's plain GET submit still needs to carry it forward. */}
          <input type="hidden" name="zone" value={zoneId ?? ""} />
          <FilterText
            name="q"
            label="Search"
            value={filters.q}
            placeholder="Business, contact, address"
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
          <FilterCheckbox name="excludeRejected" label="Exclude rejected" checked={excludeRejected} />
          <FilterSelect
            name="sort"
            label="Sort by"
            value={filters.sort}
            options={PARTNERSHIP_SORTS.map((s) => ({ id: s.value, name: s.label }))}
            hideBlankOption
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
                  <StageBadge name={lookup(names, p.status_id)} />
                </div>
                <div className="muted text-sm">{lookup(names, p.tier_id)}</div>
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
                <div className="mono mt-1 text-sm">
                  {ref?.jobs ?? 0} referral{(ref?.jobs ?? 0) === 1 ? "" : "s"} ·{" "}
                  {money(ref?.revenue ?? 0)}
                </div>
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
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/partnerships/${p.id}`} className="link font-semibold">
                          {p.business_name}
                        </Link>
                        {p.address && <div className="muted text-xs">{p.address}</div>}
                      </td>
                      <td>
                        <StageBadge name={lookup(names, p.status_id)} />
                      </td>
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
                      <td className="text-xs">{lookup(names, p.tier_id)}</td>
                      <td className="mono">{ref?.jobs ?? 0}</td>
                      <td className="mono">{money(ref?.revenue ?? 0)}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted">
                      No partnerships match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="muted mt-3 text-xs">
          Status tracks where a partnership stands: Visited → Developing → Mature. Every
          partnership counts toward the dashboard, at whatever stage it's at.
        </p>
      </main>
    </>
  );
}
