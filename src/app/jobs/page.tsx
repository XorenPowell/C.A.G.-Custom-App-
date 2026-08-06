import Link from "next/link";
import TopBar from "@/components/TopBar";
import FilterBar, { FilterSelect, FilterText } from "@/components/FilterBar";
import { getJobList, SORT_FIELDS } from "@/lib/jobs";
import { getEntitiesFull } from "@/lib/entities";
import { getPartnerships } from "@/lib/partnerships";
import { active, getLists, lookup, nameMap } from "@/lib/data";
import { dateDisplay, money, phoneDisplay, timeDisplay } from "@/lib/format";
import { JOB_STATUSES } from "@/lib/types";

const STATUS_TONE: Record<string, string> = {
  Inquiry: "border-[var(--color-line)] text-[var(--color-muted)]",
  Quoted: "border-[var(--color-accent)] text-[var(--color-accent)]",
  Booked: "border-[var(--color-warn)] text-[var(--color-warn)]",
  Completed: "border-[var(--color-good)] text-[var(--color-good)]",
  Cancelled: "border-[var(--color-danger)] text-[var(--color-danger)]",
  Lost: "border-[var(--color-danger)] text-[var(--color-danger)]",
};

function buildHref(sp: Record<string, string | undefined>, next: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...next })) {
    if (v) params.set(k, v);
  }
  return `/jobs?${params.toString()}`;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [lists, result, entities, partnerships] = await Promise.all([
    getLists(),
    getJobList(sp),
    getEntitiesFull(),
    getPartnerships(),
  ]);
  const names = nameMap(lists);

  const sort = sp.sort ?? "date_of_invoice";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const anyFilter = [
    sp.q,
    sp.status,
    sp.from,
    sp.to,
    sp.category,
    sp.source,
    sp.zone,
    sp.entity,
    sp.partnership,
  ].some(Boolean);

  function SortHeader({ field, label }: { field: string; label: string }) {
    const isActive = sort === field;
    const nextDir = isActive && dir === "desc" ? "asc" : "desc";
    return (
      <th>
        <Link
          href={buildHref(sp, { sort: field, dir: nextDir, page: "1" })}
          className="hover:underline"
        >
          {label}
          {isActive ? (dir === "asc" ? " ▲" : " ▼") : ""}
        </Link>
      </th>
    );
  }

  return (
    <>
      <TopBar
        title="Jobs"
        action={
          <Link href="/jobs/new" className="btn btn-sm btn-primary shrink-0">
            + New
          </Link>
        }
      />
      <main className="page">
        <FilterBar action="/jobs" active={anyFilter}>
          <FilterText
            name="q"
            label="Search"
            value={sp.q ?? ""}
            placeholder="Customer, phone, job ID"
          />
          <FilterSelect
            name="status"
            label="Status"
            value={sp.status ?? ""}
            options={JOB_STATUSES.map((s) => ({ id: s, name: s }))}
          />
          <FilterText name="from" label="Invoiced from" value={sp.from ?? ""} type="date" />
          <FilterText name="to" label="Invoiced to" value={sp.to ?? ""} type="date" />
          <FilterSelect
            name="category"
            label="Service"
            value={sp.category ?? ""}
            options={active(lists.service_category)}
          />
          <FilterSelect
            name="source"
            label="Lead source"
            value={sp.source ?? ""}
            options={active(lists.lead_source)}
          />
          <FilterSelect name="zone" label="Zone" value={sp.zone ?? ""} options={active(lists.zone)} />
          <FilterSelect
            name="entity"
            label="Entity"
            value={sp.entity ?? ""}
            options={entities.map((e) => ({ id: e.id, name: e.entity_name }))}
          />
          <FilterSelect
            name="partnership"
            label="Partnership"
            value={sp.partnership ?? ""}
            options={partnerships.map((p) => ({ id: p.id, name: p.business_name }))}
          />
          <FilterSelect
            name="sort"
            label="Sort by"
            value={sort}
            options={SORT_FIELDS.map((s) => ({ id: s.value, name: s.label }))}
            allLabel="Invoice date"
          />
          <FilterSelect
            name="dir"
            label="Direction"
            value={dir}
            options={[
              { id: "desc", name: "Descending" },
              { id: "asc", name: "Ascending" },
            ]}
            allLabel="Descending"
          />
        </FilterBar>

        <p className="muted mb-2 text-sm">
          {result.total} job{result.total === 1 ? "" : "s"}
          {result.pageCount > 1 && ` · page ${result.page} of ${result.pageCount}`}
        </p>

        {/* Mobile: cards */}
        <div className="flex flex-col gap-2 md:hidden">
          {result.rows.map((j) => {
            const fin = result.financials.get(j.id);
            return (
              <Link key={j.id} href={`/jobs/${j.id}`} className="card card-pad block">
                <div className="flex items-start justify-between gap-2">
                  <span className="mono font-bold">{j.job_id}</span>
                  <span className={`badge ${STATUS_TONE[j.status] ?? ""}`}>{j.status}</span>
                </div>
                <div className="font-semibold">{j.customer_name || "—"}</div>
                <div className="muted text-sm">
                  {lookup(names, j.service_category_id)} · {lookup(names, j.zone_id)}
                </div>
                <div className="text-sm">
                  {j.arrival_date ? (
                    <>
                      {dateDisplay(j.arrival_date)}
                      {j.arrival_time ? ` @ ${timeDisplay(j.arrival_time)}` : ""}
                    </>
                  ) : (
                    <span className="muted">no arrival set</span>
                  )}
                </div>
                <div className="mono mt-1 flex justify-between text-sm">
                  <span>{money(j.total_invoice_paid)}</span>
                  {fin && (
                    <span
                      className={
                        fin.profit < 0
                          ? "text-[var(--color-danger)]"
                          : "text-[var(--color-good)]"
                      }
                    >
                      {money(fin.profit)}
                    </span>
                  )}
                </div>
                {(result.entityNames.get(j.id)?.length ?? 0) > 0 && (
                  <div className="muted mt-0.5 text-xs">
                    {result.entityNames.get(j.id)!.join(", ")}
                  </div>
                )}
              </Link>
            );
          })}
          {result.rows.length === 0 && (
            <p className="muted card card-pad text-sm">No jobs match these filters.</p>
          )}
        </div>

        {/* Desktop: table */}
        <div className="card hidden md:block">
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <SortHeader field="job_id" label="Job" />
                  <SortHeader field="date_of_invoice" label="Invoiced" />
                  <SortHeader field="arrival_date" label="Arrival" />
                  <SortHeader field="customer_name" label="Customer" />
                  <th>Service</th>
                  <th>Source</th>
                  <th>Workers</th>
                  <SortHeader field="status" label="Status" />
                  <SortHeader field="total_invoice_paid" label="Invoice" />
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((j) => {
                  const fin = result.financials.get(j.id);
                  return (
                    <tr key={j.id}>
                      <td>
                        <Link href={`/jobs/${j.id}`} className="link mono font-semibold">
                          {j.job_id}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">{dateDisplay(j.date_of_invoice)}</td>
                      <td className="whitespace-nowrap">
                        {dateDisplay(j.arrival_date)}
                        {j.arrival_time && (
                          <div className="muted text-xs">{timeDisplay(j.arrival_time)}</div>
                        )}
                      </td>
                      <td>
                        {j.customer_name || "—"}
                        {j.customer_phone && (
                          <div className="muted text-xs">{phoneDisplay(j.customer_phone)}</div>
                        )}
                      </td>
                      <td>{lookup(names, j.service_category_id)}</td>
                      <td>{lookup(names, j.lead_source_id)}</td>
                      <td className="text-xs">
                        {result.entityNames.get(j.id)?.join(", ") || "—"}
                      </td>
                      <td>
                        <span className={`badge ${STATUS_TONE[j.status] ?? ""}`}>{j.status}</span>
                      </td>
                      <td className="mono">{money(j.total_invoice_paid)}</td>
                      <td
                        className={`mono ${
                          fin && fin.profit < 0 ? "text-[var(--color-danger)]" : ""
                        }`}
                      >
                        {fin ? money(fin.profit) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {result.rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="muted">
                      No jobs match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {result.pageCount > 1 && (
          <div className="mt-3 flex items-center gap-2">
            {result.page > 1 && (
              <Link href={buildHref(sp, { page: String(result.page - 1) })} className="btn btn-sm">
                ‹ Previous
              </Link>
            )}
            <span className="muted text-sm">
              Page {result.page} of {result.pageCount}
            </span>
            {result.page < result.pageCount && (
              <Link href={buildHref(sp, { page: String(result.page + 1) })} className="btn btn-sm">
                Next ›
              </Link>
            )}
          </div>
        )}
      </main>
    </>
  );
}
