import Link from "next/link";
import TopBar from "@/components/TopBar";
import FilterBar, { FilterSelect, FilterText } from "@/components/FilterBar";
import { filterPartnerships, getPartnerships, getReferralCounts } from "@/lib/partnerships";
import { active, getLists, lookup, nameMap } from "@/lib/data";
import { dateDisplay, money, phoneDisplay } from "@/lib/format";

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
    status: sp.status ?? "",
    tier: sp.tier ?? "",
    zone: sp.zone ?? "",
  };
  const rows = filterPartnerships(all, filters);
  const anyFilter = Object.values(filters).some(Boolean);

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
        <FilterBar action="/partnerships" active={anyFilter}>
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
            name="tier"
            label="Tier"
            value={filters.tier}
            options={active(lists.partnership_tier)}
          />
          <FilterSelect name="zone" label="Zone" value={filters.zone} options={active(lists.zone)} />
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
                <div className="font-bold">{p.business_name}</div>
                <div className="muted text-sm">
                  {lookup(names, p.status_id)} · {lookup(names, p.tier_id)}
                </div>
                <div className="muted text-sm">{lookup(names, p.zone_id)}</div>
                {p.poc_name && (
                  <div className="text-sm">
                    {p.poc_name}
                    {p.poc_phone ? ` · ${phoneDisplay(p.poc_phone)}` : ""}
                  </div>
                )}
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
                  <th>Tier</th>
                  <th>Zone</th>
                  <th>Contact</th>
                  <th>Last visit</th>
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
                      <td>{lookup(names, p.status_id)}</td>
                      <td className="text-xs">{lookup(names, p.tier_id)}</td>
                      <td>{lookup(names, p.zone_id)}</td>
                      <td className="whitespace-nowrap">
                        {p.poc_name}
                        {p.poc_phone && (
                          <div className="muted text-xs">{phoneDisplay(p.poc_phone)}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap">{dateDisplay(p.last_visit)}</td>
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
      </main>
    </>
  );
}
