import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import { getLists } from "@/lib/data";
import type { ListKind } from "@/lib/types";
import ListEditor from "./ListEditor";
import ServiceCategoryEditor from "./ServiceCategoryEditor";

const META: Partial<
  Record<
    ListKind,
    {
      title: string;
      withDescription: boolean;
      descriptionLabel: string;
      withIntentLevel?: boolean;
    }
  >
> = {
  inquiry_source: { title: "Inquiry Sources", withDescription: false, descriptionLabel: "" },
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
  conversation_outcome: {
    title: "Conversation Outcomes",
    withDescription: false,
    descriptionLabel: "",
    withIntentLevel: true,
  },
};

export default async function ListPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;

  if (kind === "service_category") {
    const lists = await getLists();
    return (
      <>
        <TopBar title="Service Categories" back="/settings" backLabel="Settings" />
        <main className="page max-w-3xl">
          <ServiceCategoryEditor items={lists.service_category} />
        </main>
      </>
    );
  }

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
          withIntentLevel={meta.withIntentLevel ?? false}
        />
      </main>
    </>
  );
}
