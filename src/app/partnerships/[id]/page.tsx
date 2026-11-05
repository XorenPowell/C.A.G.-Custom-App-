import Link from "next/link";
import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import PartnershipForm from "@/components/PartnershipForm";
import ActivityTrail from "@/components/ActivityTrail";
import ContactsPanel from "@/components/ContactsPanel";
import LogContact from "@/components/LogContact";
import StageSelect from "@/components/StageSelect";
import DeletePartnershipButton from "./DeletePartnershipButton";
import { Empty, Stat, StatGrid } from "@/components/Detail";
import {
  followUpLabel,
  followUpState,
  followUpTime,
  getPartnership,
  getPartnershipReferrals,
} from "@/lib/partnerships";
import { getPartnershipActivity } from "@/lib/activity";
import { getContactsFor } from "@/lib/contacts";
import { active, getLists, lookup, nameMap } from "@/lib/data";
import { stageTone } from "@/lib/lists";
import { dateDisplay, dateLongDisplay, money } from "@/lib/format";

const DUE_TONE: Record<string, string> = {
  overdue: "border-[var(--color-danger)] text-[var(--color-danger)]",
  today: "border-[var(--color-warn)] text-[var(--color-warn)]",
  upcoming: "border-[var(--color-line)] text-[var(--color-muted)]",
  none: "border-[var(--color-danger)] text-[var(--color-danger)]",
};

export default async function PartnershipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [partnership, lists, referrals, activity, contacts] = await Promise.all([
    getPartnership(id),
    getLists(),
    getPartnershipReferrals(id),
    getPartnershipActivity(id),
    getContactsFor(id),
  ]);
  if (!partnership) notFound();

  const names = nameMap(lists);
  const revenue = referrals.reduce((s, r) => s + r.total_invoice_paid, 0);
  const completed = referrals.filter((r) => r.status === "Completed").length;
  const statusName = lookup(names, partnership.status_id);
  const due = followUpState(partnership);

  return (
    <>
      <TopBar
        title={partnership.business_name}
        back="/partnerships"
        backLabel="Partnerships"
      />
      <main className="page max-w-3xl">
        {/* Stage is a dropdown, not a label: it moves often, and burying it
            inside the Edit form made a routine change a three-step job. */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StageSelect
            partnershipId={partnership.id}
            currentId={partnership.status_id}
            stages={active(lists.partnership_status)}
            tone={stageTone(statusName)}
          />
          <span className="badge border-[var(--color-line)] text-[var(--color-muted)]">
            {lookup(names, partnership.tier_id)}
          </span>
          <span className="badge border-[var(--color-line)] text-[var(--color-muted)]">
            {lookup(names, partnership.zone_id)}
          </span>
        </div>

        {/* The next action comes before the record itself. Across 117
            partnerships, "what do I do about this one" is the live question. */}
        <section
          className={`card mb-3 ${due === "none" ? "border-[var(--color-danger)]" : "border-[var(--color-accent)]"}`}
        >
          <div className="section-title flex items-center justify-between">
            <span>Next action</span>
            <span className={`badge ${DUE_TONE[due]}`}>
              {due === "none" ? "nothing booked" : followUpLabel(partnership)}
            </span>
          </div>
          <div className="card-pad">
            {partnership.follow_up_at ? (
              <>
                <p className="text-sm">
                  <strong>{dateLongDisplay(partnership.follow_up_at.slice(0, 10))}</strong>
                  {followUpTime(partnership) ? ` at ${followUpTime(partnership)}` : ""}
                </p>
                {partnership.follow_up_note && (
                  <p className="muted mt-1 text-sm">{partnership.follow_up_note}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--color-danger)]">
                No callback booked. This partnership appears in no follow-up list and will
                not come back to you on its own.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {partnership.poc_phone && (
                <a
                  className="btn btn-sm"
                  href={`tel:${partnership.poc_phone.replace(/\D/g, "")}`}
                >
                  Call {partnership.poc_name || "POC"}
                </a>
              )}
              <span className="muted text-sm">
                Last contact {dateDisplay(partnership.last_contact)}
              </span>
            </div>
          </div>
        </section>

        <div className="mb-3 flex flex-wrap gap-2">
          <LogContact
            partnershipId={partnership.id}
            currentFollowUpAt={partnership.follow_up_at}
            currentFollowUpNote={partnership.follow_up_note}
          />
        </div>

        <ContactsPanel
          partnershipId={partnership.id}
          contacts={contacts}
          roles={active(lists.contact_role)}
        />

        <section className="card mb-3">
          <div className="section-title">Activity ({activity.length})</div>
          <div className="card-pad">
            <ActivityTrail
              entries={activity}
              emptyHint="Nothing logged yet. Use Log contact above and the history builds itself."
            />
          </div>
        </section>

        {/* Derived: counted from jobs, never stored on the partnership row. */}
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

        <section className="card mb-3">
          <div className="section-title">Referred Jobs ({referrals.length})</div>
          <div className="card-pad">
            {referrals.length === 0 ? (
              <Empty>
                No jobs credited yet. A job counts here once its inquiry source is set to
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

        <PartnershipForm partnership={partnership} lists={lists} />

        <DeletePartnershipButton id={partnership.id} name={partnership.business_name} />
      </main>
    </>
  );
}
