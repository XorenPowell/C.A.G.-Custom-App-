"use client";

import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import SaveBar from "@/components/SaveBar";
import {
  deleteListItem,
  listItemUsage,
  saveServiceCategories,
  type CategoryDraft,
  type SubcategoryDraft,
} from "@/app/actions/settings";
import { childrenOf, topLevelOf } from "@/lib/lists";
import type { ListItem } from "@/lib/types";

/** service_category's own editor — categories and, nested under each, subcategories. */
export default function ServiceCategoryEditor({ items }: { items: ListItem[] }) {
  const [categories, setCategories] = useState<CategoryDraft[]>(
    topLevelOf(items).map((c) => ({
      id: c.id,
      name: c.name,
      archived: c.archived,
      subcategories: childrenOf(items, c.id).map((s) => ({
        id: s.id,
        name: s.name,
        details_template: s.details_template,
        archived: s.archived,
      })),
    })),
  );
  const [pending, start] = useGlobalTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function patchCategory(index: number, next: Partial<CategoryDraft>) {
    setCategories((prev) => prev.map((c, i) => (i === index ? { ...c, ...next } : c)));
    setStatus(null);
  }

  function patchSub(catIndex: number, subIndex: number, next: Partial<SubcategoryDraft>) {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIndex
          ? {
              ...c,
              subcategories: c.subcategories.map((s, j) =>
                j === subIndex ? { ...s, ...next } : s,
              ),
            }
          : c,
      ),
    );
    setStatus(null);
  }

  function addCategory() {
    setCategories((prev) => [...prev, { id: null, name: "", archived: false, subcategories: [] }]);
    setStatus(null);
  }

  function addSub(catIndex: number) {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIndex
          ? {
              ...c,
              subcategories: [
                ...c.subcategories,
                { id: null, name: "", details_template: null, archived: false },
              ],
            }
          : c,
      ),
    );
    setStatus(null);
  }

  function moveCategory(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= categories.length) return;
    setCategories((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setStatus(null);
  }

  function moveSub(catIndex: number, subIndex: number, delta: number) {
    setCategories((prev) =>
      prev.map((c, i) => {
        if (i !== catIndex) return c;
        const target = subIndex + delta;
        if (target < 0 || target >= c.subcategories.length) return c;
        const next = [...c.subcategories];
        [next[subIndex], next[target]] = [next[target], next[subIndex]];
        return { ...c, subcategories: next };
      }),
    );
    setStatus(null);
  }

  function removeCategory(index: number) {
    const cat = categories[index];
    if (!cat.id) {
      setCategories((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    start(async () => {
      setError(null);
      const usage = await listItemUsage(cat.id!, "service_category");
      const warning = usage.length
        ? `"${cat.name}" is used by ${usage.map((u) => `${u.count} ${u.label}`).join(", ")}.\n\n` +
          `Deleting it also deletes every subcategory under it, and clears it from those records ` +
          `(entity rate rows are removed outright).\n\nArchive instead if you just want it out of the dropdowns.\n\nDelete anyway?`
        : `Delete "${cat.name}" and all its subcategories?`;
      if (!window.confirm(warning)) return;

      const res = await deleteListItem(cat.id!);
      if (!res.ok) {
        setError(res.error ?? "Delete failed.");
        return;
      }
      setCategories((prev) => prev.filter((_, i) => i !== index));
      setStatus("Deleted.");
    });
  }

  function removeSub(catIndex: number, subIndex: number) {
    const sub = categories[catIndex].subcategories[subIndex];
    if (!sub.id) {
      setCategories((prev) =>
        prev.map((c, i) =>
          i === catIndex
            ? { ...c, subcategories: c.subcategories.filter((_, j) => j !== subIndex) }
            : c,
        ),
      );
      return;
    }
    start(async () => {
      setError(null);
      const usage = await listItemUsage(sub.id!, "service_category");
      const warning = usage.length
        ? `"${sub.name}" is used by ${usage.map((u) => `${u.count} ${u.label}`).join(", ")}.\n\n` +
          `Deleting clears it from those records (entity rate rows are removed outright).\n\n` +
          `Archive instead if you just want it out of the dropdowns.\n\nDelete anyway?`
        : `Delete "${sub.name}"?`;
      if (!window.confirm(warning)) return;

      const res = await deleteListItem(sub.id!);
      if (!res.ok) {
        setError(res.error ?? "Delete failed.");
        return;
      }
      setCategories((prev) =>
        prev.map((c, i) =>
          i === catIndex
            ? { ...c, subcategories: c.subcategories.filter((_, j) => j !== subIndex) }
            : c,
        ),
      );
      setStatus("Deleted.");
    });
  }

  function save() {
    start(async () => {
      setError(null);
      setStatus(null);
      const res = await saveServiceCategories(categories);
      if (res.ok) setStatus("Saved.");
      else setError(res.error ?? "Save failed.");
    });
  }

  return (
    <>
      <div className="mb-3 flex flex-col gap-3">
        {categories.map((cat, ci) => (
          <div
            key={cat.id ?? `new-${ci}`}
            className={`card card-pad ${cat.archived ? "opacity-60" : ""}`}
          >
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-1 pt-1">
                <button
                  type="button"
                  className="btn btn-sm min-h-7 px-1"
                  onClick={() => moveCategory(ci, -1)}
                  disabled={ci === 0}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-sm min-h-7 px-1"
                  onClick={() => moveCategory(ci, 1)}
                  disabled={ci === categories.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <input
                  className="input mb-2 font-semibold"
                  value={cat.name}
                  placeholder="Category name"
                  onChange={(e) => patchCategory(ci, { name: e.target.value })}
                />
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={cat.archived}
                      onChange={(e) => patchCategory(ci, { archived: e.target.checked })}
                      className="size-4 accent-[var(--color-accent)]"
                    />
                    Archived
                  </label>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => removeCategory(ci)}
                  >
                    Delete category
                  </button>
                </div>

                <div className="flex flex-col gap-2 border-l-2 border-[var(--color-line)] pl-3">
                  {cat.subcategories.map((sub, si) => (
                    <div
                      key={sub.id ?? `new-${ci}-${si}`}
                      className={`border border-[var(--color-line)] p-2 ${sub.archived ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col gap-1 pt-1">
                          <button
                            type="button"
                            className="btn btn-sm min-h-6 px-1"
                            onClick={() => moveSub(ci, si, -1)}
                            disabled={si === 0}
                            aria-label="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm min-h-6 px-1"
                            onClick={() => moveSub(ci, si, 1)}
                            disabled={si === cat.subcategories.length - 1}
                            aria-label="Move down"
                          >
                            ↓
                          </button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <input
                            className="input mb-2"
                            value={sub.name}
                            placeholder="Subcategory name"
                            onChange={(e) => patchSub(ci, si, { name: e.target.value })}
                          />
                          <textarea
                            className="textarea mb-2 min-h-14"
                            value={sub.details_template ?? ""}
                            placeholder="Details pre-fill (optional) — loaded into a job's Details when this subcategory is picked and Details is still empty."
                            onChange={(e) =>
                              patchSub(ci, si, {
                                details_template: e.target.value === "" ? null : e.target.value,
                              })
                            }
                          />
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-1.5 text-sm">
                              <input
                                type="checkbox"
                                checked={sub.archived}
                                onChange={(e) =>
                                  patchSub(ci, si, { archived: e.target.checked })
                                }
                                className="size-4 accent-[var(--color-accent)]"
                              />
                              Archived
                            </label>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => removeSub(ci, si)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {cat.subcategories.length === 0 && (
                    <p className="muted text-xs">
                      No subcategories yet — nothing here is bookable until one exists.
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm self-start"
                    onClick={() => addSub(ci)}
                  >
                    + Add subcategory
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {categories.length === 0 && (
          <p className="muted card card-pad text-sm">No categories yet.</p>
        )}
      </div>

      <button type="button" className="btn" onClick={addCategory}>
        + Add category
      </button>

      <p className="muted mt-4 text-xs">
        Jobs and roster rates are priced per subcategory — a category with no subcategories
        can&rsquo;t be booked. Archived entries stay attached to existing records but no longer
        appear in dropdowns.
      </p>

      <SaveBar onSave={save} pending={pending} status={status} error={error} />
    </>
  );
}
