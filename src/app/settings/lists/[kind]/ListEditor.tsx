"use client";

import { useState, useTransition } from "react";
import SaveBar from "@/components/SaveBar";
import {
  deleteListItem,
  listItemUsage,
  saveList,
  type ListItemDraft,
} from "@/app/actions/settings";
import type { ListItem, ListKind } from "@/lib/types";

export default function ListEditor({
  kind,
  items,
  withDescription,
  descriptionLabel,
}: {
  kind: ListKind;
  items: ListItem[];
  withDescription: boolean;
  descriptionLabel: string;
}) {
  const [rows, setRows] = useState<ListItemDraft[]>(
    items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      sort_order: i.sort_order,
      archived: i.archived,
    })),
  );
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function patch(index: number, next: Partial<ListItemDraft>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...next } : r)));
    setStatus(null);
  }

  function add() {
    setRows((prev) => [
      ...prev,
      { id: null, name: "", description: null, sort_order: 0, archived: false },
    ]);
    setStatus(null);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    setRows((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setStatus(null);
  }

  function removeRow(index: number) {
    const row = rows[index];
    if (!row.id) {
      setRows((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    start(async () => {
      setError(null);
      const usage = await listItemUsage(row.id!, kind);
      const warning = usage.length
        ? `"${row.name}" is used by ${usage.map((u) => `${u.count} ${u.label}`).join(", ")}.\n\n` +
          `Deleting clears it from those records (entity rate rows are removed outright).\n\n` +
          `Archive instead if you just want it out of the dropdowns.\n\nDelete anyway?`
        : `Delete "${row.name}"?`;

      if (!window.confirm(warning)) return;

      const res = await deleteListItem(row.id!);
      if (!res.ok) {
        setError(res.error ?? "Delete failed.");
        return;
      }
      setRows((prev) => prev.filter((_, i) => i !== index));
      setStatus("Deleted.");
    });
  }

  function save() {
    start(async () => {
      setError(null);
      setStatus(null);
      const res = await saveList(kind, rows);
      if (res.ok) setStatus("Saved.");
      else setError(res.error ?? "Save failed.");
    });
  }

  return (
    <>
      <div className="mb-3 flex flex-col gap-2">
        {rows.map((row, index) => (
          <div
            key={row.id ?? `new-${index}`}
            className={`card card-pad ${row.archived ? "opacity-60" : ""}`}
          >
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-1 pt-1">
                <button
                  type="button"
                  className="btn btn-sm min-h-7 px-1"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-sm min-h-7 px-1"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <input
                  className="input mb-2"
                  value={row.name}
                  placeholder="Name"
                  onChange={(e) => patch(index, { name: e.target.value })}
                />
                {withDescription && (
                  <textarea
                    className="textarea mb-2 min-h-16"
                    value={row.description ?? ""}
                    placeholder={descriptionLabel}
                    onChange={(e) => patch(index, { description: e.target.value })}
                  />
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={row.archived}
                      onChange={(e) => patch(index, { archived: e.target.checked })}
                      className="size-4 accent-[var(--color-accent)]"
                    />
                    Archived
                  </label>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => removeRow(index)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="muted card card-pad text-sm">No entries yet.</p>
        )}
      </div>

      <button type="button" className="btn" onClick={add}>
        + Add entry
      </button>

      <p className="muted mt-4 text-xs">
        Archived entries stay attached to existing records but no longer appear in
        dropdowns. Order here is the order shown everywhere in the app.
      </p>

      <SaveBar onSave={save} pending={pending} status={status} error={error} />
    </>
  );
}
