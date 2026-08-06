"use client";

import { useMemo, useRef, useState } from "react";
import type { EquipmentPreset } from "@/lib/types";

/**
 * Searchable item field backed by the preset library.
 *
 * Free text is always allowed — the presets are a shortcut, not a constraint.
 * Picking one fills the note with its default text, but only when the note is
 * empty or still holds a previous preset's untouched default, so a note the
 * dispatcher actually wrote is never overwritten.
 */
export default function EquipmentItemInput({
  value,
  onChange,
  presets,
  onPickPreset,
  placeholder = "Item — type to search presets",
}: {
  value: string;
  onChange: (value: string) => void;
  presets: EquipmentPreset[];
  /** Fired only when a preset is chosen, with its default note (may be null). */
  onPickPreset: (preset: EquipmentPreset) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const available = useMemo(() => presets.filter((p) => !p.archived), [presets]);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return available.slice(0, 40);

    // Names that start with the query rank above ones that merely contain it,
    // so typing "dol" puts "Dolly" first rather than "Appliance dolly".
    const starts: EquipmentPreset[] = [];
    const contains: EquipmentPreset[] = [];
    for (const p of available) {
      const name = p.item_name.toLowerCase();
      if (name.startsWith(q)) starts.push(p);
      else if (name.includes(q)) contains.push(p);
      else if (p.default_note?.toLowerCase().includes(q)) contains.push(p);
    }
    return [...starts, ...contains].slice(0, 40);
  }, [value, available]);

  const exact = useMemo(
    () =>
      available.find(
        (p) => p.item_name.toLowerCase() === value.trim().toLowerCase(),
      ) ?? null,
    [value, available],
  );

  function choose(preset: EquipmentPreset) {
    onChange(preset.item_name);
    onPickPreset(preset);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (matches[highlight]) {
        e.preventDefault();
        choose(matches[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // Let a click on an option land before the list unmounts.
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
      />

      {exact?.default_note && !open && (
        <p className="muted mt-0.5 text-xs">
          Preset — note filled from the library, edit it freely.
        </p>
      )}

      {open && matches.length > 0 && (
        <ul
          className="absolute z-30 mt-0.5 max-h-64 w-full overflow-y-auto border border-[var(--color-line)] bg-white shadow-lg"
          onMouseDown={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
          }}
        >
          {matches.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(p)}
                className={`block w-full px-2 py-2 text-left ${
                  i === highlight ? "bg-[var(--color-sunken)]" : ""
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{p.item_name}</span>
                  <span className="muted shrink-0 text-xs">{p.category}</span>
                </span>
                {p.default_note && (
                  <span className="muted line-clamp-2 block text-xs">{p.default_note}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && matches.length === 0 && value.trim() !== "" && (
        <div className="absolute z-30 mt-0.5 w-full border border-[var(--color-line)] bg-white px-2 py-2 text-xs text-[var(--color-muted)]">
          No preset matches — it will be saved as typed.
        </div>
      )}
    </div>
  );
}
