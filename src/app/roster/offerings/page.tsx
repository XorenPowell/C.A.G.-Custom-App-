import Link from "next/link";
import TopBar from "@/components/TopBar";
import { getEntitiesFull } from "@/lib/entities";
import { getLists } from "@/lib/data";
import { childrenOf, topLevelOf } from "@/lib/lists";
import { money } from "@/lib/format";
import type { EntityFull } from "@/lib/types";

/** True when the entity has a verified reference anywhere under this category. */
function verifiedInCategory(entity: EntityFull, categoryId: string): boolean {
  return entity.entity_references.some((r) => r.service_category_id === categoryId && r.verified);
}

/** Active entities priced for this subcategory with a verified reference in its category. */
function coveringEntities(entities: EntityFull[], subcategoryId: string, categoryId: string) {
  return entities.filter(
    (e) =>
      e.status === "Active" &&
      e.entity_rates.some((r) => r.service_category_id === subcategoryId) &&
      verifiedInCategory(e, categoryId),
  );
}

export default async function OfferingsPage() {
  const [lists, entities] = await Promise.all([getLists(), getEntitiesFull()]);
  const categories = topLevelOf(lists.service_category).filter((c) => !c.archived);

  return (
    <>
      <TopBar title="Offerings" back="/roster" backLabel="Roster" />
      <main className="page max-w-3xl">
        <p className="muted mb-4 text-sm">
          What the roster can currently offer. A subcategory is offerable once an Active
          entity has a rate for it and a verified reference anywhere under its category.
        </p>

        {categories.map((category) => {
          const subcategories = childrenOf(lists.service_category, category.id).filter(
            (s) => !s.archived,
          );
          return (
            <div key={category.id} className="card card-pad mb-3">
              <h2 className="h2 mb-2">{category.name}</h2>
              {subcategories.length === 0 && (
                <p className="muted text-sm">No subcategories yet.</p>
              )}
              <div className="flex flex-col gap-2">
                {subcategories.map((sub) => {
                  const covering = coveringEntities(entities, sub.id, category.id);
                  const offerable = covering.length > 0;
                  return (
                    <div
                      key={sub.id}
                      className={`border p-2 ${
                        offerable ? "border-[var(--color-good)]" : "border-[var(--color-line)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{sub.name}</span>
                        <span
                          className={`badge ${
                            offerable
                              ? "border-[var(--color-good)] text-[var(--color-good)]"
                              : "border-[var(--color-line)] text-[var(--color-muted)]"
                          }`}
                        >
                          {offerable ? "Offerable" : "Not yet"}
                        </span>
                      </div>
                      {offerable && (
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {covering.map((e) => {
                            const rate = e.entity_rates.find(
                              (r) => r.service_category_id === sub.id,
                            )!;
                            return (
                              <li
                                key={e.id}
                                className="flex items-center justify-between gap-2 text-sm"
                              >
                                <Link href={`/roster/${e.id}`} className="link">
                                  {e.entity_name}
                                </Link>
                                <span className="mono muted text-xs">
                                  {rate.regular_rate > 0 && `reg ${money(rate.regular_rate)}`}
                                  {rate.flat_rate > 0 ? ` · flat ${money(rate.flat_rate)}` : ""}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {categories.length === 0 && (
          <p className="muted card card-pad text-sm">
            No service categories defined yet — add some in Settings.
          </p>
        )}
      </main>
    </>
  );
}
