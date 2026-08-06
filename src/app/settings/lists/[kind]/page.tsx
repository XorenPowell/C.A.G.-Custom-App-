import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import { getLists } from "@/lib/data";
import type { ListKind } from "@/lib/types";
import ListEditor from "./ListEditor";

const META: Record<
  ListKind,
  { title: string; withDescription: boolean; descriptionLabel: string }
> = {
  service_category: {
    title: "Service Categories",
    withDescription: false,
    descriptionLabel: "",
  },
  lead_source: { title: "Lead Sources", withDescription: false, descriptionLabel: "" },
  zone: {
    title: "Zones",
    withDescription: true,
    descriptionLabel: "Coverage description (shown on the Zone Reference screen)",
  },
  vehicle_type: { title: "Vehicle Types", withDescription: false, descriptionLabel: "" },
  partnership_status: {
    title: "Partnership Statuses",
    withDescription: false,
    descriptionLabel: "",
  },
  partnership_tier: {
    title: "Partnership Tiers",
    withDescription: true,
    descriptionLabel: "What this tier means (optional)",
  },
};

export default async function ListPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  const meta = META[kind as ListKind];
  if (!meta) notFound();

  const lists = await getLists();
  const items = lists[kind as ListKind];

  return (
    <>
      <TopBar title={meta.title} back="/settings" backLabel="Settings" />
      <main className="page max-w-3xl">
        <ListEditor
          kind={kind as ListKind}
          items={items}
          withDescription={meta.withDescription}
          descriptionLabel={meta.descriptionLabel}
        />
      </main>
    </>
  );
}
