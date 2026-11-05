import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import JobForm from "@/components/JobForm";
import CommsActions from "@/components/CommsActions";
import ActivityTrail from "@/components/ActivityTrail";
import LogContact from "@/components/LogContact";
import DeleteJobButton from "./DeleteJobButton";
import { getJob, getJobFinancialsOne } from "@/lib/jobs";
import { getJobActivity } from "@/lib/activity";
import { followUpLabel, followUpState, followUpTime } from "@/lib/follow-up";
import { isJobOpen } from "@/lib/types";
import { getEntitiesFull } from "@/lib/entities";
import { getPartnerships } from "@/lib/partnerships";
import { getLists, getSettings, getTemplates, lookup, nameMap, partnershipReferralId } from "@/lib/data";
import { effectiveWorkerPay, netWorkerPay } from "@/lib/calc";
import { dateLongDisplay, instantDisplay } from "@/lib/format";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [job, lists, entities, partnerships, settings, templates, financials, activity] =
    await Promise.all([
      getJob(id),
      getLists(),
      getEntitiesFull(),
      getPartnerships(),
      getSettings(),
      getTemplates(),
      getJobFinancialsOne(id),
      getJobActivity(id),
    ]);

  if (!job) notFound();

  const names = nameMap(lists);
  const jobDue = followUpState(job);
  // A finished job with nothing booked is the correct end state, not a
  // problem to flag in red.
  const jobOpen = isJobOpen(job.status);
  const assigned = job.job_workers
    .map((w) => {
      const e = entities.find((entity) => entity.id === w.entity_id);
      if (!e) return null;
      return {
        entity_name: e.entity_name,
        poc_name: e.poc_name,
        poc_phone: e.poc_phone,
        is_leader: w.is_leader,
        // {{pay}} tells a worker what they'll actually receive — net of the
        // transfer fee, not the gross amount billed on the invoice.
        pay: netWorkerPay(
          effectiveWorkerPay({
            regular_hours: w.regular_hours,
            regular_rate: w.regular_rate,
            travel_hours: w.travel_hours,
            travel_rate: w.travel_rate,
            other_hours: w.other_hours,
            other_rate: w.other_rate,
            total_pay_override: w.total_pay_override,
            fees: w.job_worker_fees,
          }),
          settings.transfer_fee_percent,
        ),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <>
      <TopBar title={job.job_id} back="/jobs" backLabel="Jobs" />
      <main className="page max-w-3xl">
        <p className="mb-2 text-sm font-semibold">
          Lead created:{" "}
          <span className="text-[var(--color-accent)]">{instantDisplay(job.created_at)}</span>
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="badge border-[var(--color-line)]">{job.status}</span>
          {financials?.repeat_customer && (
            <span className="badge border-[var(--color-accent)] text-[var(--color-accent)]">
              Repeat customer
            </span>
          )}
          {financials?.week_of && (
            <span className="muted text-xs">
              week of {financials.week_of} · {financials.month}
            </span>
          )}
        </div>

        {/* Jobs leak the same way partnerships do: a deposit paid, then two
            weeks of silence before the work starts. Same next-action rule. */}
        <section
          className={`card mb-3 ${
            jobDue === "none"
              ? jobOpen
                ? "border-[var(--color-danger)]"
                : ""
              : "border-[var(--color-accent)]"
          }`}
        >
          <div className="section-title flex items-center justify-between">
            <span>Next action</span>
            <span
              className={`badge ${
                jobDue === "overdue"
                  ? "border-[var(--color-danger)] text-[var(--color-danger)]"
                  : jobDue === "today"
                    ? "border-[var(--color-warn)] text-[var(--color-warn)]"
                    : jobDue === "none" && jobOpen
                      ? "border-[var(--color-danger)] text-[var(--color-danger)]"
                      : "border-[var(--color-line)] text-[var(--color-muted)]"
              }`}
            >
              {jobDue === "none" ? (jobOpen ? "nothing booked" : job.status) : followUpLabel(job)}
            </span>
          </div>
          <div className="card-pad">
            {job.follow_up_at ? (
              <>
                <p className="text-sm">
                  <strong>{dateLongDisplay(job.follow_up_at.slice(0, 10))}</strong>
                  {followUpTime(job) ? ` at ${followUpTime(job)}` : ""}
                </p>
                {job.follow_up_note && (
                  <p className="muted mt-1 text-sm">{job.follow_up_note}</p>
                )}
              </>
            ) : jobOpen ? (
              <p className="text-sm text-[var(--color-danger)]">
                No callback booked. Nothing will bring this job back to you.
              </p>
            ) : (
              <p className="muted text-sm">
                This job is {job.status.toLowerCase()}, so no follow-up is expected. Book
                one anyway if you want to chase a review or check in later — it will show
                up in your calls like any other.
              </p>
            )}
            <div className="mt-3">
              <LogContact
                jobId={job.id}
                currentFollowUpAt={job.follow_up_at}
                currentFollowUpNote={job.follow_up_note}
                compact
              />
            </div>
          </div>
        </section>

        <section className="card mb-3">
          <div className="section-title">Activity ({activity.length})</div>
          <div className="card-pad">
            <ActivityTrail
              entries={activity}
              emptyHint="Nothing logged yet. Log contact records what was said and books the next call."
            />
          </div>
        </section>

        {/* Communication actions resolve templates against the saved record. */}
        <section className="card mb-3">
          <div className="section-title">Communication</div>
          <div className="card-pad">
            <CommsActions
              job={{
                job_id: job.job_id,
                customer_name: job.customer_name,
                customer_phone: job.customer_phone,
                arrival_windows: job.job_arrival_windows.map((w) => ({
                  date: w.date,
                  start_time: w.start_time,
                  end_time: w.end_time,
                })),
                confirmed_arrival_date: job.confirmed_arrival_date,
                confirmed_arrival_time: job.confirmed_arrival_time,
                estimated_duration_minutes: job.estimated_duration_minutes,
                addresses: job.addresses,
                details: job.details,
                notes: job.notes,
              }}
              serviceCategory={lookup(names, job.service_category_id)}
              zone={lookup(names, job.zone_id)}
              entities={assigned}
              templates={templates}
            />
            <p className="muted mt-2 text-xs">
              Templates resolve against the saved job — save first if you have just
              changed the time or address.
            </p>
          </div>
        </section>

        <JobForm
          job={job}
          lists={lists}
          entities={entities}
          partnerships={partnerships.map((p) => ({
            id: p.id,
            business_name: p.business_name,
          }))}
          settings={settings}
          partnershipReferralId={partnershipReferralId(lists)}
        />

        <DeleteJobButton id={job.id} jobId={job.job_id} />
      </main>
    </>
  );
}
