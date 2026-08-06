import Link from "next/link";
import TopBar from "@/components/TopBar";
import { active, getLists } from "@/lib/data";

/** Read-only reference: what each zone actually covers (spec 3.4). */
export default async function ZoneReferencePage() {
  const lists = await getLists();
  const zones = active(lists.zone);

  return (
    <>
      <TopBar title="Zone Reference" back="/settings" backLabel="Settings" />
      <main className="page max-w-3xl">
        {zones.length === 0 ? (
          <p className="muted card card-pad text-sm">No zones defined yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {zones.map((z) => (
              <div key={z.id} className="card card-pad">
                <h2 className="h2">{z.name}</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {z.description || (
                    <span className="muted italic">No description set.</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}

        <Link href="/settings/lists/zone" className="btn mt-4">
          Edit zones
        </Link>
      </main>
    </>
  );
}
