import Link from "next/link";
import { notFound } from "next/navigation";
import ActivityTrail from "@/components/ActivityTrail";
import ContactsPanel from "@/components/ContactsPanel";
import LogContact from "@/components/LogContact";
import NextActionCard from "@/components/NextActionCard";
import PartnershipForm from "@/components/PartnershipForm";
import PlacementCard from "@/components/PlacementCard";
import StageSelect from "@/components/StageSelect";
import DeletePartnershipButton from "./DeletePartnershipButton";
import { Empty } from "@/components/Detail";
import { followUpLabel, followUpState, getPartnership, getPartnershipReferrals } from "@/lib/partnerships";
import { getPartnershipActivity } from "@/lib/activity";
import { getScheduledForPartnership } from "@/lib/scheduled";
import PlannedActions from "@/components/PlannedActions";
import { getCampaigns, getPlacements, restockLabel, restockState } from "@/lib/campaigns";
import { getContactsFor } from "@/lib/contacts";
import { active, getLists, lookup, nameMap } from "@/lib/data";
import { stageTone } from "@/lib/lists";
import { dateDisplay, money } from "@/lib/format";

export default async function PartnershipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [partnership, lists, referrals, activity, contacts, campaigns] = await Promise.all([
    getPartnership(id),
    getLists(),
    getPartnershipReferrals(id),
    getPartnershipActivity(id),
    getContactsFor(id),
    getCampaigns(),
  ]);
  const planned = await getScheduledForPartnership(id);
  if (!partnership) notFound();

  const campaign = campaigns[0] ?? null;
  const placements = campaign ? await getPlacements(campaign.id) : [];
  const placement = placements.find((p) => p.partnership_id === partnership.id) ?? null;

  const names = nameMap(lists);
  const revenue = referrals.reduce((s, r) => s + r.total_invoice_paid, 0);
  const completed = referrals.filter((r) => r.status === "Completed").length;
  const statusName = lookup(names, partnership.status_id);
  const due = followUpState(partnership);

  return (
    <main className="page max-w-6xl">
      {/* Header: identity on the left, the two things you came to do on the
          right. Wraps to stacked on a phone. */}
      <div className="mb-2">
        <Link href="/partnerships" className="btn btn-sm">
          ‹ Partnerships
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="h1 text-xl md:text-2xl">{partnership.business_name}</h1>
          <div className="muted text-sm">
            {[partnership.address, lookup(names, partnership.zone_id)]
              .filter((v) => v && v !== "—")
              .join(" · ")}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StageSelect
              partnershipId={partnership.id}
              currentId={partnership.status_id}
              stages={active(lists.partnership_status)}
              tone={stageTone(statusName)}
            />
            <span className="badge border-[var(--color-line)] text-[var(--color-muted)]">
              {lookup(names, partnership.tier_id)}
            </span>
            {placement && <span className="badge border-[#a98bd8] text-[#c4acec]">SAFC</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="#edit" className="btn">
            Edit
          </Link>
          <LogContact
            partnershipId={partnership.id}
            currentFollowUpAt={partnership.follow_up_at}
            currentFollowUpNote={partnership.follow_up_note}
          />
        </div>
      </div>

      {/* Next action and the stack sit side by side: both are "what do I do
          about this business", and both are edited in place. */}
      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <NextActionCard
          partnershipId={partnership.id}
          followUpAt={partnership.follow_up_at}
          followUpNote={partnership.follow_up_note}
          followUpKind={partnership.follow_up_kind}
          tone={due}
          dueLabel={followUpLabel(partnership)}
        >
          <p className="muted mt-2 text-xs">
            Last contact {dateDisplay(partnership.last_contact)}. Log contact records what
            was said and books the next call in one step.
          </p>
        </NextActionCard>

        {campaign && (
          <PlacementCard
            campaignId={campaign.id}
            partnershipId={partnership.id}
            placement={placement}
            dueLabel={placement ? restockLabel(placement) : ""}
            tone={placement ? restockState(placement) : "none"}
          />
        )}
      </div>

      <ContactsPanel
        partnershipId={partnership.id}
        contacts={contacts}
        roles={active(lists.contact_role)}
      />

      {/* History on the left, what it has produced on the right. */}
      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <section className="card">
          <div className="section-title">Activity log ({activity.length})</div>
          <div className="card-pad">
            {/* The plan sits above the history, in the same column, so the
                record reads forwards and backwards from now. */}
            <PlannedActions partnershipId={partnership.id} actions={planned} />
            <div className="mb-2 border-t border-[var(--color-line)] pt-2">
              <span className="label mb-0">History</span>
            </div>
            <ActivityTrail
              entries={activity}
              emptyHint="Nothing logged yet. Use Log contact and the history builds itself."
            />
          </div>
        </section>

        <section className="card">
          <div className="section-title">Referrals</div>
          <div className="card-pad">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="label">Jobs referred</div>
                <div className="font-heading text-2xl font-extrabold">{referrals.length}</div>
                <div className="text-xs text-[var(--text-faint)]">{completed} completed</div>
              </div>
              <div>
                <div className="label">Revenue</div>
                <div className="font-heading text-2xl font-extrabold">{money(revenue)}</div>
                <div className="text-xs text-[var(--text-faint)]">
                  last visit {dateDisplay(partnership.last_visit)}
                </div>
              </div>
            </div>

            {referrals.length === 0 ? (
              <Empty>
                No jobs credited yet. A job counts here once its inquiry source is
                Partnership Referral and this business is selected.
              </Empty>
            ) : (
              <div className="scroll-x mt-3">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Date</th>
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
      </div>

      <div id="edit">
        <PartnershipForm partnership={partnership} lists={lists} />
      </div>

      <DeletePartnershipButton id={partnership.id} name={partnership.business_name} />
    </main>
  );
}
