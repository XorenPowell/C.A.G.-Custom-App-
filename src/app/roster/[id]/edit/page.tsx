import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import EntityForm from "@/components/EntityForm";
import { getLists } from "@/lib/data";
import { getEntity } from "@/lib/entities";
import DeleteEntityButton from "./DeleteEntityButton";

export default async function EditEntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [entity, lists] = await Promise.all([getEntity(id), getLists()]);
  if (!entity) notFound();

  return (
    <>
      <TopBar title={`Edit — ${entity.entity_name}`} back={`/roster/${id}`} backLabel="Back" />
      <main className="page max-w-3xl">
        <EntityForm entity={entity} lists={lists} />
        <div className="mt-6 border-t border-[var(--color-line)] pt-4">
          <DeleteEntityButton id={entity.id} name={entity.entity_name} />
        </div>
      </main>
    </>
  );
}
