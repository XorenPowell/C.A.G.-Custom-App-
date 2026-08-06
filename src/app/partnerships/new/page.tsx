import TopBar from "@/components/TopBar";
import PartnershipForm from "@/components/PartnershipForm";
import { getLists } from "@/lib/data";

export default async function NewPartnershipPage() {
  const lists = await getLists();
  return (
    <>
      <TopBar title="New Partnership" back="/partnerships" backLabel="Partnerships" />
      <main className="page max-w-3xl">
        <PartnershipForm partnership={null} lists={lists} />
      </main>
    </>
  );
}
