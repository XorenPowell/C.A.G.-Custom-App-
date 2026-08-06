import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import JobForm from "@/components/JobForm";
import CommsActions from "@/components/CommsActions";
import DeleteJobButton from "./DeleteJobButton";
import { getJob, getJobFinancialsOne } from "@/lib/jobs";
import { getEntitiesFull } from "@/lib/entities";
import { getPartnerships } from "@/lib/partnerships";
import { getLists, getSettings, getTemplates, lookup, nameMap, partnershipReferralId } from "@/lib/data";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [job, lists, entities, partnerships, settings, templates, financials] =
    await Promise.all([
      getJob(id),
      getLists(),
      getEntitiesFull(),
      getPartnerships(),
      getSettings(),
      getTemplates(),
      getJobFinancialsOne(id),
    ]);

  if (!job) notFound();

  const names = nameMap(lists);
  const assigned = job.job_workers
    .map((w) => entities.find((e) => e.id === w.entity_id))
    .filter(Boolean)
    .map((e) => ({
      entity_name: e!.entity_name,
      poc_name: e!.poc_name,
      poc_phone: e!.poc_phone,
    }));

  return (
    <>
      <TopBar title={job.job_id} back="/jobs" backLabel="Jobs" />
      <main className="page max-w-3xl">
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

        {/* Communication actions resolve templates against the saved record. */}
        <section className="card mb-3">
          <div className="section-title">Communication</div>
          <div className="card-pad">
            <CommsActions
              job={{
                job_id: job.job_id,
                customer_name: job.customer_name,
                customer_phone: job.customer_phone,
                arrival_date: job.arrival_date,
                arrival_time: job.arrival_time,
                estimated_duration_minutes: job.estimated_duration_minutes,
                addresses: job.addresses,
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
