"use client";

import { useEffect, useState } from "react";

function elapsedLabel(startedAt: string): string {
  const totalSeconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Live-ticking elapsed time for an active session, like a run tracker. */
export default function SessionTimer({ startedAt }: { startedAt: string }) {
  const [label, setLabel] = useState(() => elapsedLabel(startedAt));

  useEffect(() => {
    const id = setInterval(() => setLabel(elapsedLabel(startedAt)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return <span className="font-mono text-3xl font-bold tabular-nums">{label}</span>;
}
