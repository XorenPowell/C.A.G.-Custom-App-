"use client";

import { useMemo, useState, useTransition } from "react";
import SaveBar from "@/components/SaveBar";
import { deletePreset, savePresets, type PresetDraft } from "@/app/actions/equipment-presets";
import type { EquipmentPreset } from "@/lib/types";

/**
 * Library editor. A few hundred rows, so it filters rather than paging, and
 * only the rows actually edited get sent to the server on save.
 */
export default function PresetEditor({ presets }: { presets: EquipmentPreset[] }) {
  const [rows, setRows] = useState<(PresetDraft & { key: string })[]>(
    presets.map((p) => ({
      key: p.id,
      id: p.id,
      item_name: p.item_name,
      default_note: p.default_note,
      category: p.category,
      archived: p.archived,
    })),
  );
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.category))].sort(),
    [rows],
  );

  function patch(key: string, next: Partial<PresetDraft>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...next } : r)));
    setDirty((prev) => new Set(prev).add(key));
    setStatus(null);
  }

  function add() {
    const key = `new-${Date.now()}`;
    setRows((prev) => [
      {
        key,
        id: null,
        item_name: "",
        default_note: "",
        category: category || "Other",
        archived: false,
      },
      ...prev,
    ]);
    setDirty((prev) => new Set(prev).add(key));
    setStatus(null);
  }

  function removeRow(key: string) {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    if (!row.id) {
      setRows((prev) => prev.filter((r) => r.key !== key));
      return;
    }
    if (!window.confirm(`Delete "${row.item_name}" from the library?`)) return;

    start(async () => {
      const res = await deletePreset(row.id!);
      if (!res.ok) {
        setError(res.error ?? "Delete failed.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.key !== key));
      setStatus("Deleted.");
    });
  }

  function save() {
    start(async () => {
      setError(null);
      setStatus(null);
      const changed = rows.filter((r) => dirty.has(r.key));
      if (changed.length === 0) {
        setStatus("Nothing to save.");
        return;
      }
      const res = await savePresets(changed.map(({ key: _key, ...d }) => d));
      if (res.ok) {
        setDirty(new Set());
        setStatus(`Saved ${changed.length} item${changed.length === 1 ? "" : "s"}.`);
      } else {
        setError(res.error ?? "Save failed.");
      }
    });
  }

  const visible = rows.filter((r) => {
    if (category && r.category !== category) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return (
      r.item_name.toLowerCase().includes(needle) ||
      (r.default_note ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <>
      <div className="card card-pad mb-3">
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="preset-q">
              Search
            </label>
            <input
              id="preset-q"
              className="input"
              value={q}
              placeholder="Item name or note text"
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="preset-cat">
              Category
            </label>
            <select
              id="preset-cat"
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-sm" onClick={add}>
            + Add preset
          </button>
          <span className="muted text-sm">
            {visible.length} of {rows.length} shown
            {dirty.size > 0 && ` · ${dirty.size} unsaved`}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {visible.map((r) => (
          <div
            key={r.key}
            className={`card card-pad ${r.archived ? "opacity-60" : ""} ${
              dirty.has(r.key) ? "border-[var(--color-accent)]" : ""
            }`}
          >
            <div className="mb-2 flex flex-col gap-2 sm:flex-row">
              <input
                className="input sm:flex-1"
                placeholder="Item name"
                value={r.item_name}
                onChange={(e) => patch(r.key, { item_name: e.target.value })}
              />
              <input
                className="input sm:w-56"
                placeholder="Category"
                list="preset-categories"
                value={r.category}
                onChange={(e) => patch(r.key, { category: e.target.value })}
              />
            </div>

            <textarea
              className="textarea mb-2 min-h-16"
              placeholder="Default note — fills the equipment note when this preset is picked"
              value={r.default_note ?? ""}
              onChange={(e) => patch(r.key, { default_note: e.target.value })}
            />

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={r.archived}
                  onChange={(e) => patch(r.key, { archived: e.target.checked })}
                  className="size-4 accent-[var(--color-accent)]"
                />
                Archived
              </label>
              <button
                type="button"
                className="btn btn-sm btn-danger ml-auto"
                onClick={() => removeRow(r.key)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {visible.length === 0 && (
          <p className="muted card card-pad text-sm">Nothing matches that search.</p>
        )}
      </div>

      <datalist id="preset-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <p className="muted mt-4 text-xs">
        Archived presets stop appearing in the entity autocomplete but leave already-saved
        equipment untouched — an equipment row copies the text, it does not point at the
        preset.
      </p>

      <SaveBar onSave={save} pending={pending} status={status} error={error} />
    </>
  );
}
