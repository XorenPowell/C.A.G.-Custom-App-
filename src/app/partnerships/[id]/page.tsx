import Link from "next/link";
import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import PartnershipForm from "@/components/PartnershipForm";
import DeletePartnershipButton from "./DeletePartnershipButton";
import { Empty, Stat, StatGrid } from "@/components/Detail";
import {
  followUpLabel,
  getPartnership,
  getPartnershipReferrals,
  isLead,
} from "@/lib/partnerships";
import { getLists } from "@/lib/data";
import { dateDisplay, money } from "@/lib/format";

export default async function PartnershipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [partnership, lists, referrals] = await Promise.all([
    getPartnership(id),
    getLists(),
    getPartnershipReferrals(id),
  ]);
  if (!partnership) notFound();

  const revenue = referrals.reduce((s, r) => s + r.total_invoice_paid, 0);
  const completed = referrals.filter((r) => r.status === "Completed").length;
  const lead = isLead(partnership);

  return (
    <>
      <TopBar
        title={partnership.business_name}
        back="/partnerships"
        backLabel="Partnerships"
      />
      <main className="page max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {lead ? (
            <span className="badge border-[var(--color-line)] text-[var(--color-muted)]">
              Lead
            </span>
          ) : (
            <span className="badge border-[var(--color-good)] text-[var(--color-good)]">
              Signed {dateDisplay(partnership.date_signed)}
            </span>
          )}
          <span className="muted text-sm">
            Last contact {dateDisplay(partnership.last_contact)} · follow-up{" "}
            {followUpLabel(partnership)}
          </span>
        </div>

        {lead ? (
          <p className="card card-pad mb-3 text-sm">
            This is still a lead, so it is excluded from New Partnerships, the tier
            breakdown and every other dashboard figure. Setting a signed date below
            promotes it.
          </p>
        ) : (
          /* Derived: counted from jobs, never stored on the partnership row. */
          <section className="card mb-3">
            <div className="section-title">Referral Performance</div>
            <div className="card-pad">
              <StatGrid>
                <Stat label="Jobs referred" value={String(referrals.length)} />
                <Stat label="Completed" value={String(completed)} />
                <Stat label="Revenue referred" value={money(revenue)} />
                <Stat label="Last visit" value={dateDisplay(partnership.last_visit)} />
              </StatGrid>
            </div>
          </section>
        )}

        {(!lead || referrals.length > 0) && (
        <section className="card mb-3">
          <div className="section-title">Referred Jobs ({referrals.length})</div>
          <div className="card-pad">
            {referrals.length === 0 ? (
              <Empty>
                No jobs credited yet. A job counts here once its lead source is set to
                Partnership Referral and this business is selected.
              </Empty>
            ) : (
              <div className="scroll-x">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link href={`/jobs/${r.id}`} className="link mono">
                            {r.job_id}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap">{dateDisplay(r.date)}</td>
                        <td>{r.customer_name || "—"}</td>
                        <td>{r.status}</td>
                        <td className="mono">{money(r.total_invoice_paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
        )}

        <PartnershipForm partnership={partnership} lists={lists} />

        <DeletePartnershipButton id={partnership.id} name={partnership.business_name} />
      </main>
    </>
  );
}
