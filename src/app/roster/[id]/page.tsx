import Link from "next/link";
import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import StaleFlag from "@/components/StaleFlag";
import { DocLink, Empty, Row, Stat, StatGrid } from "@/components/Detail";
import { entityStats, getEntity, getEntityJobHistory } from "@/lib/entities";
import { getLists, lookup, nameMap } from "@/lib/data";
import {
  dateDisplay,
  entityType,
  money,
  phoneDisplay,
  phoneLinkTarget,
} from "@/lib/format";
import AvailabilityEditor from "./AvailabilityEditor";

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [entity, lists, history] = await Promise.all([
    getEntity(id),
    getLists(),
    getEntityJobHistory(id),
  ]);
  if (!entity) notFound();

  const names = nameMap(lists);
  const stats = entityStats(history);

  return (
    <>
      <TopBar
        title={entity.entity_name}
        back="/roster"
        backLabel="Roster"
        action={
          <Link href={`/roster/${id}/edit`} className="btn btn-sm shrink-0">
            Edit
          </Link>
        }
      />
      <main className="page max-w-4xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`badge ${
              entity.status === "Active"
                ? "border-[var(--color-good)] text-[var(--color-good)]"
                : "border-[var(--color-line)] text-[var(--color-muted)]"
            }`}
          >
            {entity.status}
          </span>
          <span className="badge border-[var(--color-line)]">
            {entityType(entity.roster_size)} · {entity.roster_size}
          </span>
          <StaleFlag updatedAt={entity.availability_updated_at} />
        </div>

        {/* ---------- derived totals: computed from jobs, never stored ------- */}
        <section className="card mb-3">
          <div className="section-title">Totals</div>
          <div className="card-pad">
            <StatGrid>
              <Stat label="Jobs worked" value={String(stats.jobsWorked)} />
              <Stat label="Earned all time" value={money(stats.totalEarned)} />
              <Stat label="Earned this month" value={money(stats.earnedThisMonth)} />
              <Stat label="Last job" value={dateDisplay(stats.lastJobDate)} />
            </StatGrid>
            <p className="muted mt-2 text-xs">
              Totals count Completed jobs only, using each job&apos;s effective worker pay.
            </p>
          </div>
        </section>

        {/* ---------- availability ------------------------------------------ */}
        <section className="card mb-3">
          <div className="section-title">Availability</div>
          <div className="card-pad">
            <AvailabilityEditor
              entityId={entity.id}
              blocks={entity.entity_availability}
              note={entity.availability_note}
              updatedAt={entity.availability_updated_at}
            />
          </div>
        </section>

        {/* ---------- profile ------------------------------------------------ */}
        <section className="card mb-3">
          <div className="section-title">Profile</div>
          <div className="card-pad">
            <Row label="POC">
              {entity.poc_name || "—"}
              {entity.poc_phone && (
                <>
                  {" · "}
                  <a className="link" href={`tel:${phoneLinkTarget(entity.poc_phone)}`}>
                    {phoneDisplay(entity.poc_phone)}
                  </a>
                </>
              )}
            </Row>
            <Row label="Workers">
              {entity.worker_names.length ? entity.worker_names.join(", ") : "—"}
            </Row>
            <Row label="Zone">{lookup(names, entity.zone_id)}</Row>
            <Row label="Vehicles">
              {entity.vehicle_type_ids.length
                ? entity.vehicle_type_ids.map((v) => lookup(names, v)).join(", ")
                : "—"}
            </Row>
            <Row label="Documents">
              <div className="flex flex-col gap-1">
                <DocLink href={entity.ic_agreement_link} label="IC agreement" />
                <DocLink href={entity.photo_id_link} label="Photo ID" />
                <DocLink href={entity.equipment_photos_link} label="Equipment photos" />
              </div>
            </Row>
            <Row label="Reliability">
              <span className="whitespace-pre-wrap">{entity.reliability_notes || "—"}</span>
            </Row>
            <Row label="Notes">
              <span className="whitespace-pre-wrap">{entity.notes || "—"}</span>
            </Row>
          </div>
        </section>

        {/* ---------- rates -------------------------------------------------- */}
        <section className="card mb-3">
          <div className="section-title">Rates</div>
          <div className="card-pad">
            {entity.entity_rates.length === 0 ? (
              <Empty>
                No rates set — this entity will not appear in the dispatch picker for any
                service.
              </Empty>
            ) : (
              <div className="scroll-x">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Regular</th>
                      <th>Travel</th>
                      <th>Other</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entity.entity_rates.map((r) => (
                      <tr key={r.id}>
                        <td>{lookup(names, r.service_category_id)}</td>
                        <td className="mono">{money(r.regular_rate)}</td>
                        <td className="mono">{money(r.travel_rate)}</td>
                        <td className="mono">{money(r.other_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ---------- fees & equipment --------------------------------------- */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <section className="card mb-3">
            <div className="section-title">Standing Fees</div>
            <div className="card-pad">
              {entity.entity_fees.length === 0 ? (
                <Empty>None.</Empty>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {entity.entity_fees.map((f) => (
                    <li key={f.id} className="flex justify-between gap-2">
                      <span>
                        {f.fee_name}
                        {f.description && (
                          <span className="muted"> — {f.description}</span>
                        )}
                      </span>
                      <span className="mono shrink-0">{money(f.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="card mb-3">
            <div className="section-title">Equipment</div>
            <div className="card-pad">
              {entity.entity_equipment.length === 0 ? (
                <Empty>None.</Empty>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {entity.entity_equipment.map((e) => (
                    <li key={e.id} className="flex justify-between gap-2">
                      <span>
                        {e.item_name}
                        {e.notes && <span className="muted"> — {e.notes}</span>}
                      </span>
                      <span className="mono shrink-0">×{e.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* ---------- references --------------------------------------------- */}
        <section className="card mb-3">
          <div className="section-title">References</div>
          <div className="card-pad">
            {entity.entity_references.length === 0 ? (
              <Empty>None.</Empty>
            ) : (
              <div className="scroll-x">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Service</th>
                      <th>Verified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entity.entity_references.map((r) => (
                      <tr key={r.id}>
                        <td>{r.reference_name || "—"}</td>
                        <td>
                          {r.reference_phone ? (
                            <a
                              className="link"
                              href={`tel:${phoneLinkTarget(r.reference_phone)}`}
                            >
                              {phoneDisplay(r.reference_phone)}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{lookup(names, r.service_category_id)}</td>
                        <td>
                          {r.verified ? (
                            <span className="badge border-[var(--color-good)] text-[var(--color-good)]">
                              Verified
                            </span>
                          ) : (
                            <span className="muted">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ---------- job history -------------------------------------------- */}
        <section className="card mb-3">
          <div className="section-title">Job History ({history.length})</div>
          <div className="card-pad">
            {history.length === 0 ? (
              <Empty>No jobs yet.</Empty>
            ) : (
              <div className="scroll-x">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Service</th>
                      <th>Status</th>
                      <th>Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>
                          <Link href={`/jobs/${h.id}`} className="link mono">
                            {h.job_id}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap">{dateDisplay(h.date)}</td>
                        <td>{h.customer_name || "—"}</td>
                        <td>{lookup(names, h.service_category_id)}</td>
                        <td>{h.status}</td>
                        <td className="mono">{money(h.pay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
