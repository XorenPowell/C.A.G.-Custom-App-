/** Read-view primitives shared by the detail screens. */

export function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 border-b border-[var(--color-line-soft)] py-1.5 last:border-0">
      <span className="w-36 shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: "good" | "bad" | null;
}) {
  const color =
    emphasis === "good"
      ? "text-[var(--color-good)]"
      : emphasis === "bad"
        ? "text-[var(--color-danger)]"
        : "";
  return (
    <div className="border border-[var(--color-line)] bg-white p-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </div>
      <div className={`mono text-lg font-bold ${color}`}>{value}</div>
      {sub && <div className="muted text-xs">{sub}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{children}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="muted text-sm">{children}</p>;
}

/** Renders a Google Drive link, or a muted dash when unset. */
export function DocLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return <span className="muted">— {label} not set</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="link">
      {label}
    </a>
  );
}
