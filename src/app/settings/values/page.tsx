import TopBar from "@/components/TopBar";
import { getSettings } from "@/lib/data";
import ValuesEditor from "./ValuesEditor";

export default async function ValuesPage() {
  const settings = await getSettings();
  return (
    <>
      <TopBar title="Values & Goals" back="/settings" backLabel="Settings" />
      <main className="page max-w-2xl">
        <ValuesEditor settings={settings} />
      </main>
    </>
  );
}
