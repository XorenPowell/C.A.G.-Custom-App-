"use client";

import { useMemo, useState } from "react";
import StaleFlag from "@/components/StaleFlag";
import { canPerform, coversDate, matchesText } from "@/lib/entity-filters";
import { entityType, phoneDisplay } from "@/lib/format";
import { money } from "@/lib/format";
import type { EntityFull } from "@/lib/types";

/**
 * Dispatch picker (spec 5.6). Opens pre-filtered to entities that are Active,
 * priced for this job's service category, in this job's zone, and available on
 * the arrival date. The filters can be switched off to show the whole roster.
 */
export default function DispatchPicker({
  entities,
  serviceCategoryId,
  zoneId,
  arrivalDate,
  alreadyPicked,
  names,
  onPick,
  onClose,
}: {
  entities: EntityFull[];
  serviceCategoryId: string | null;
  zoneId: string | null;
  arrivalDate: string | null;
  alreadyPicked: string[];
  names: Record<string, string>;
  onPick: (entity: EntityFull) => void;
  onClose: () => void;
}) {
  const [strict, setStrict] = useState(true);
  const [q, setQ] = useState("");

  const { matching, reasons } = useMemo(() => {
    const reasons = new Map<string, string[]>();

    const matching = entities.filter((e) => {
      const why: string[] = [];
      if (e.status !== "Active") why.push("inactive");
      if (serviceCategoryId && !canPerform(e, serviceCategoryId)) why.push("no rate for service");
      if (zoneId && e.zone_id !== zoneId) why.push("different zone");
      if (arrivalDate && !coversDate(e, arrivalDate)) why.push("not available that day");
      reasons.set(e.id, why);

      if (q && !matchesText(e, q)) return false;
      return strict ? why.length === 0 : true;
    });

    return { matching, reasons };
  }, [entities, serviceCategoryId, zoneId, arrivalDate, strict, q]);

  const criteria = [
    "Active",
    serviceCategoryId ? `priced for ${names[serviceCategoryId] ?? "this service"}` : null,
    zoneId ? `in ${names[zoneId] ?? "this zone"}` : null,
    arrivalDate ? `available ${arrivalDate}` : null,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center">
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col border border-[var(--color-line)] bg-white">
        <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-3 py-2">
          <h2 className="h2 flex-1">Add worker</h2>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="border-b border-[var(--color-line)] px-3 py-2">
          <input
            className="input mb-2"
            placeholder="Search name, worker, equipment…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={strict}
              onChange={(e) => setStrict(e.target.checked)}
              className="size-4 accent-[var(--color-accent)]"
            />
            Only show eligible entities
          </label>
          <p className="muted mt-1 text-xs">
            {strict
              ? `Filtered to: ${criteria.join(", ")}.`
              : "Showing the whole roster — ineligibility is flagged per row."}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {matching.length === 0 && (
            <p className="muted p-3 text-sm">
              No entities match. Untick &ldquo;only show eligible&rdquo; to pick anyone.
            </p>
          )}

          {matching.map((e) => {
            const why = reasons.get(e.id) ?? [];
            const picked = alreadyPicked.includes(e.id);
            const rate = serviceCategoryId
              ? e.entity_rates.find((r) => r.service_category_id === serviceCategoryId)
              : null;

            return (
              <button
                key={e.id}
                type="button"
                disabled={picked}
                onClick={() => onPick(e)}
                className="mb-1 block w-full border border-[var(--color-line)] p-2 text-left hover:bg-[var(--color-sunken)] disabled:opacity-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold">{e.entity_name}</span>
                  {picked && <span className="badge border-[var(--color-line)]">Added</span>}
                </div>
                <div className="muted text-xs">
                  {entityType(e.roster_size)} · {e.zone_id ? names[e.zone_id] ?? "—" : "no zone"}
                  {e.poc_phone ? ` · ${phoneDisplay(e.poc_phone)}` : ""}
                </div>
                {rate && (
                  <div className="mono mt-0.5 text-xs">
                    reg {money(rate.regular_rate)} · trav {money(rate.travel_rate)} · other{" "}
                    {money(rate.other_rate)}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  <StaleFlag updatedAt={e.availability_updated_at} />
                  {why.map((w) => (
                    <span
                      key={w}
                      className="badge border-[var(--color-warn)] text-[var(--color-warn)]"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
