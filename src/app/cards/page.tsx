import TopBar from "@/components/TopBar";
import { getCardLedger } from "@/lib/cards";
import CardsLedger from "./CardsLedger";

export default async function CardsPage() {
  const ledger = await getCardLedger();

  return (
    <>
      <TopBar title="Cards" back={null} />
      <main className="page max-w-4xl">
        <CardsLedger ledger={ledger} />
      </main>
    </>
  );
}
