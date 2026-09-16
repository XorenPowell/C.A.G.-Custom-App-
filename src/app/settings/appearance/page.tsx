import TopBar from "@/components/TopBar";
import { getSettings } from "@/lib/data";
import AppearanceEditor from "./AppearanceEditor";

export default async function AppearancePage() {
  const settings = await getSettings();
  return (
    <>
      <TopBar title="Appearance" back="/settings" backLabel="Settings" />
      <main className="page max-w-2xl">
        <AppearanceEditor overrides={settings.theme_overrides ?? {}} />
      </main>
    </>
  );
}
