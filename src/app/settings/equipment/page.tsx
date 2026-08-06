import TopBar from "@/components/TopBar";
import { getEquipmentPresets } from "@/lib/data";
import PresetEditor from "./PresetEditor";

export default async function EquipmentPresetsPage() {
  const presets = await getEquipmentPresets();
  return (
    <>
      <TopBar title="Equipment Presets" back="/settings" backLabel="Settings" />
      <main className="page max-w-3xl">
        <p className="muted mb-3 text-sm">
          Backs the item autocomplete on an entity&apos;s Equipment section. Picking a
          preset fills the note with its default text, which stays fully editable — a
          starting point, not a lock. Bundles let a crew&apos;s standard loadout be logged
          as one row instead of twenty.
        </p>
        <PresetEditor presets={presets} />
      </main>
    </>
  );
}
