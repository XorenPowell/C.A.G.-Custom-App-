import Link from "next/link";
import TopBar from "@/components/TopBar";
import FilterBar, { FilterSelect, FilterText } from "@/components/FilterBar";
import StaleFlag from "@/components/StaleFlag";
import { filterEntities, getEntitiesFull } from "@/lib/entities";
import { active, getLists, lookup, nameMap } from "@/lib/data";
import { entityType, phoneDisplay, phoneLinkTarget } from "@/lib/format";
import { ENTITY_STATUSES } from "@/lib/types";

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [lists, all] = await Promise.all([getLists(), getEntitiesFull()]);
  const names = nameMap(lists);

  const filters = {
    q: sp.q ?? "",
    status: sp.status ?? "",
    zone: sp.zone ?? "",
    category: sp.category ?? "",
    vehicle: sp.vehicle ?? "",
    avail: sp.avail ?? "",
  };
  const rows = filterEntities(all, filters);
  const anyFilter = Object.values(filters).some(Boolean);

  return (
    <>
      <TopBar
        title="Roster"
        action={
          <Link href="/roster/new" className="btn btn-sm btn-primary shrink-0">
            + New
          </Link>
        }
      />
      <main className="page">
        <FilterBar action="/roster" active={anyFilter}>
          <FilterText
            name="q"
            label="Search"
            value={filters.q}
            placeholder="Name, worker, equipment…"
          />
          <FilterSelect
            name="status"
            label="Status"
            value={filters.status}
            options={ENTITY_STATUSES.map((s) => ({ id: s, name: s }))}
          />
          <FilterSelect name="zone" label="Zone" value={filters.zone} options={active(lists.zone)} />
          <FilterSelect
            name="category"
            label="Can perform"
            value={filters.category}
            options={active(lists.service_category)}
          />
          <FilterSelect
            name="vehicle"
            label="Vehicle"
            value={filters.vehicle}
            options={active(lists.vehicle_type)}
          />
          <FilterText name="avail" label="Available on" value={filters.avail} type="date" />
        </FilterBar>

        <p className="muted mb-2 text-sm">
          {rows.length} of {all.length} {all.length === 1 ? "entity" : "entities"}
        </p>

        {/* Mobile: cards */}
        <div className="flex flex-col gap-2 md:hidden">
          {rows.map((e) => (
            <Link key={e.id} href={`/roster/${e.id}`} className="card card-pad block">
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold">{e.entity_name}</span>
                <span
                  className={`badge ${
                    e.status === "Active"
                      ? "border-[var(--color-good)] text-[var(--color-good)]"
                      : "border-[var(--color-line)] text-[var(--color-muted)]"
                  }`}
                >
                  {e.status}
                </span>
              </div>
              <div className="muted mt-0.5 text-sm">
                {entityType(e.roster_size)} · {e.roster_size} · {lookup(names, e.zone_id)}
              </div>
              {e.poc_phone && (
                <div className="mt-0.5 text-sm">{phoneDisplay(e.poc_phone)}</div>
              )}
              <div className="mt-1 flex flex-wrap gap-1">
                {e.entity_rates.map((r) => (
                  <span key={r.id} className="badge border-[var(--color-line)]">
                    {lookup(names, r.service_category_id)}
                  </span>
                ))}
              </div>
              <div className="mt-1">
                <StaleFlag updatedAt={e.availability_updated_at} />
              </div>
            </Link>
          ))}
          {rows.length === 0 && (
            <p className="muted card card-pad text-sm">No entities match these filters.</p>
          )}
        </div>

        {/* Desktop: table */}
        <div className="card hidden md:block">
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Type</th>
                  <th>Zone</th>
                  <th>Services</th>
                  <th>POC</th>
                  <th>Status</th>
                  <th>Availability</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/roster/${e.id}`} className="link font-semibold">
                        {e.entity_name}
                      </Link>
                      {e.worker_names.length > 0 && (
                        <div className="muted text-xs">{e.worker_names.join(", ")}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {entityType(e.roster_size)} ({e.roster_size})
                    </td>
                    <td>{lookup(names, e.zone_id)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {e.entity_rates.map((r) => (
                          <span key={r.id} className="badge border-[var(--color-line)]">
                            {lookup(names, r.service_category_id)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      {e.poc_name}
                      {e.poc_phone && (
                        <div>
                          <a className="link" href={`tel:${phoneLinkTarget(e.poc_phone)}`}>
                            {phoneDisplay(e.poc_phone)}
                          </a>
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          e.status === "Active"
                            ? "border-[var(--color-good)] text-[var(--color-good)]"
                            : "border-[var(--color-line)] text-[var(--color-muted)]"
                        }`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td>
                      <StaleFlag updatedAt={e.availability_updated_at} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      No entities match these filters.
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
