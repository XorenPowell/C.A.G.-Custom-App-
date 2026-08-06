import TopBar from "@/components/TopBar";
import EntityForm from "@/components/EntityForm";
import { getLists } from "@/lib/data";

export default async function NewEntityPage() {
  const lists = await getLists();
  return (
    <>
      <TopBar title="New Entity" back="/roster" backLabel="Roster" />
      <main className="page max-w-3xl">
        <EntityForm entity={null} lists={lists} />
      </main>
    </>
  );
}
