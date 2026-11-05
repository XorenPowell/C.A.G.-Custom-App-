import Link from "next/link";
import TopBar from "@/components/TopBar";
import FilterBar, { FilterCheckbox, FilterSelect, FilterText } from "@/components/FilterBar";
import {
  filterPartnerships,
  followUpLabel,
  followUpState,
  getPartnerships,
  getReferralCounts,
  PARTNERSHIP_SORTS,
} from "@/lib/partnerships";
import { active, getLists, lookup, nameMap } from "@/lib/data";
import { getCampaigns, getPlacements, restockLabel, restockState } from "@/lib/campaigns";
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
  const [lists, all, referrals, campaigns] = await Promise.all([
    getLists(),
    getPartnerships(),
    getReferralCounts(),
    getCampaigns(),
  ]);

  // The campaign is shown where the work happens, not only on its own screen.
  const campaign = campaigns[0] ?? null;
  const placements = campaign ? await getPlacements(campaign.id) : [];
  const placementByPartnership = new Map(placements.map((p) => [p.partnership_id, p]));
  const names = nameMap(lists);

  const rejectedId = partnershipStageId(lists, "Rejected");
  // Checked by default. Once the filter form has been submitted at all
  // (excludeRejectedSubmitted present), the checkbox's own presence is the
  // real answer — including an explicit uncheck.
  const excludeRejected =
    sp.excludeRejectedSubmitted === "1" ? sp.excludeRejected === "1" : true;

  // Zone is an ordinary filter now. It used to be driven by the zone-maturity
  // card, which forced a zone to always be selected and so quietly hid every
  // partnership outside it.
  const zoneId = sp.zone || "";

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
    zone: zoneId,
    due: sp.due ?? "",
    view: sp.view ?? "",
    sort: sp.sort ?? "follow_up",
    excludeStatusId: excludeRejected ? rejectedId : null,
  };
  const rows = filterPartnerships(all, filters);
  const anyFilter = [
    filters.q,
    filters.status,
    filters.tier,
    filters.zone,
    filters.due,
    filters.view,
    !excludeRejected,
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
  const noActionCount = all.filter((p) => !p.follow_up_at).length;
  const neverCount = all.filter((p) => !p.last_contact).length;

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

        {/* Saved views. Scrolls sideways rather than wrapping, so the list
            itself stays above the fold on a phone. */}
        <div className="mb-3 -mx-3 flex gap-1 overflow-x-auto px-3 md:mx-0 md:px-0 [&>*]:shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href={buildHref({ status: "", due: "", view: "" })}
            className={`btn btn-sm ${!filters.status && !filters.due && !filters.view ? "btn-primary" : ""}`}
          >
            All ({all.length})
          </Link>
          <Link
            href={buildHref({ due: "due", status: "", view: "" })}
            className={`btn btn-sm ${filters.due === "due" ? "btn-primary" : ""}`}
          >
            Follow up now ({dueCount})
          </Link>
          <Link
            href={buildHref({ view: "none", status: "", due: "" })}
            className={`btn btn-sm ${filters.view === "none" ? "btn-primary" : ""}`}
          >
            No next action ({noActionCount})
          </Link>
          <Link
            href={buildHref({ view: "never", status: "", due: "" })}
            className={`btn btn-sm ${filters.view === "never" ? "btn-primary" : ""}`}
          >
            Never contacted ({neverCount})
          </Link>
          {visitedId && (
            <Link
              href={buildHref({ status: visitedId, due: "", view: "" })}
              className={`btn btn-sm ${filters.status === visitedId ? "btn-primary" : ""}`}
            >
              Visited ({visitedCount})
            </Link>
          )}
          {developingId && (
            <Link
              href={buildHref({ status: developingId, due: "", view: "" })}
              className={`btn btn-sm ${filters.status === developingId ? "btn-primary" : ""}`}
            >
              Developing ({developingCount})
            </Link>
          )}
          {matureId && (
            <Link
              href={buildHref({ status: matureId, due: "", view: "" })}
              className={`btn btn-sm ${filters.status === matureId ? "btn-primary" : ""}`}
            >
              Mature ({matureCount})
            </Link>
          )}
        </div>

        <FilterBar action="/partnerships" active={anyFilter}>
          {/* The saved-view row submits through the querystring, so the form
              has to carry the current view forward on a plain GET submit. */}
          <input type="hidden" name="view" value={filters.view} />
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
            name="zone"
            label="Zone"
            value={filters.zone}
            options={active(lists.zone)}
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
                  {placementByPartnership.has(p.id) && (
                    <span className="badge border-[var(--color-line)] text-[var(--color-muted)]">
                      SAFC {restockLabel(placementByPartnership.get(p.id)!)}
                    </span>
                  )}
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
                  <th>SAFC</th>
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
                      <td className="whitespace-nowrap">
                        {(() => {
                          const pl = placementByPartnership.get(p.id);
                          if (!pl) return <span className="muted text-xs">—</span>;
                          const st = restockState(pl);
                          return (
                            <span
                              className={`badge ${
                                st === "overdue"
                                  ? "border-[var(--color-danger)] text-[var(--color-danger)]"
                                  : st === "today"
                                    ? "border-[var(--color-warn)] text-[var(--color-warn)]"
                                    : "border-[var(--color-line)] text-[var(--color-muted)]"
                              }`}
                            >
                              {restockLabel(pl)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="text-xs">{lookup(names, p.tier_id)}</td>
                      <td className="mono">{ref?.jobs ?? 0}</td>
                      <td className="mono">{money(ref?.revenue ?? 0)}</td>
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
          Status tracks where a partnership stands: Visited → Developing → Mature. Every
          partnership counts toward the dashboard, at whatever stage it's at.
        </p>
      </main>
    </>
  );
}
