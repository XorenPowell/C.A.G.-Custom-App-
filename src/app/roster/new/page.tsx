import TopBar from "@/components/TopBar";
import EntityForm from "@/components/EntityForm";
import { getEquipmentPresets, getLists } from "@/lib/data";

export default async function NewEntityPage() {
  const [lists, presets] = await Promise.all([getLists(), getEquipmentPresets()]);
  return (
    <>
      <TopBar title="New Entity" back="/roster" backLabel="Roster" />
      <main className="page max-w-3xl">
        <EntityForm entity={null} lists={lists} presets={presets} />
      </main>
    </>
  );
}
