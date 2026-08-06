import TopBar from "@/components/TopBar";
import { getTemplates } from "@/lib/data";
import TemplatesEditor from "./TemplatesEditor";

export default async function TemplatesPage() {
  const templates = await getTemplates();
  return (
    <>
      <TopBar title="Message Templates" back="/settings" backLabel="Settings" />
      <main className="page max-w-3xl">
        <TemplatesEditor templates={templates} />
      </main>
    </>
  );
}
