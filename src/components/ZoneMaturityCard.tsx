"use client";

import { useRouter } from "next/navigation";

const TONE_BG: Record<string, string> = {
  good: "bg-[var(--color-good)]",
  warn: "bg-[var(--color-warn)]",
  danger: "bg-[var(--color-danger)]",
};

/**
 * The one Zone control on the Partnerships screen — picking a zone here also
 * filters the list below it. Shows that zone's Mature-status partnerships
 * against the shared per-zone target from Settings.
 */
export default function ZoneMaturityCard({
  zones,
  selectedZoneId,
  currentParams,
  percent,
  tone,
}: {
  zones: { id: string; name: string }[];
  selectedZoneId: string | null;
  currentParams: Record<string, string | undefined>;
  percent: number;
  tone: "good" | "warn" | "danger";
}) {
  const router = useRouter();

  function onZoneChange(id: string) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(currentParams)) {
      if (v && k !== "zone") params.set(k, v);
    }
    if (id) params.set("zone", id);
    router.push(`/partnerships?${params.toString()}`);
  }

  return (
    <div className="card card-pad mb-3 flex flex-col items-center text-center">
      <select
        className="select mb-3 max-w-xs text-center font-semibold"
        value={selectedZoneId ?? ""}
        onChange={(e) => onZoneChange(e.target.value)}
        disabled={zones.length === 0}
      >
        {zones.length === 0 ? (
          <option value="">No zones yet</option>
        ) : (
          zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))
        )}
      </select>

      <div
        className={`flex w-full max-w-[220px] items-center justify-center rounded-[var(--radius-card)] py-5 text-white ${TONE_BG[tone]}`}
      >
        <span className="font-heading text-5xl font-extrabold">{percent}%</span>
      </div>

      <p className="muted mt-2 text-sm">Mature</p>
    </div>
  );
}
