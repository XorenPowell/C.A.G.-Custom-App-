import type { OutcomeBreakdown as OutcomeBreakdownData } from "@/lib/face-to-face";
import { percent } from "@/lib/format";

/** Outcome mix as a row of percentage pills — pass whatever slice you want it computed over. */
export default function OutcomeBreakdown({ data }: { data: OutcomeBreakdownData[] }) {
  if (data.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap justify-center gap-2">
      {data.map((d) => (
        <span
          key={d.label}
          className="badge border-[var(--pill-border)] bg-[var(--pill-bg)]"
        >
          {d.label} {percent(d.percent, 0)}
        </span>
      ))}
    </div>
  );
}
