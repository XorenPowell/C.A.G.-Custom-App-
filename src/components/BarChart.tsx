/**
 * Horizontal bar chart, single series.
 *
 * One measure across categories, so every bar is the same hue — colouring bars
 * by category would encode identity that the category label already carries.
 * No legend for a single series; the heading names it. Values are labelled
 * directly, which doubles as the table view.
 */
export default function BarChart({
  data,
  valueFormat = (n) => String(n),
  emptyLabel = "No data in this range.",
}: {
  data: { label: string; value: number }[];
  valueFormat?: (n: number) => string;
  emptyLabel?: string;
}) {
  const rows = [...data].sort((a, b) => b.value - a.value);
  const max = Math.max(...rows.map((r) => r.value), 0);

  if (rows.length === 0 || max <= 0) {
    return <p className="muted text-sm">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => {
        const pct = max > 0 ? (r.value / max) * 100 : 0;
        return (
          <li key={r.label} title={`${r.label}: ${valueFormat(r.value)}`}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="mono shrink-0 font-semibold">{valueFormat(r.value)}</span>
            </div>
            <div className="h-2 w-full bg-[var(--color-sunken)]">
              <div
                className="h-2 bg-[var(--color-accent)]"
                style={{ width: `${Math.max(pct, r.value > 0 ? 2 : 0)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
