import TopBar from "@/components/TopBar";
import JobForm from "@/components/JobForm";
import { getLists, getSettings, partnershipReferralId } from "@/lib/data";
import { getEntitiesFull } from "@/lib/entities";
import { getPartnerships } from "@/lib/partnerships";

export default async function NewJobPage() {
  const [lists, entities, partnerships, settings] = await Promise.all([
    getLists(),
    getEntitiesFull(),
    getPartnerships(),
    getSettings(),
  ]);

  return (
    <>
      <TopBar title="New Job" back="/jobs" backLabel="Jobs" />
      <main className="page max-w-3xl">
        <p className="muted mb-3 text-sm">
          Every inquiry becomes a job immediately. Ones that never book get closed out as
          Lost.
        </p>
        <JobForm
          job={null}
          lists={lists}
          entities={entities}
          partnerships={partnerships.map((p) => ({
            id: p.id,
            business_name: p.business_name,
          }))}
          settings={settings}
          partnershipReferralId={partnershipReferralId(lists)}
        />
      </main>
    </>
  );
}
