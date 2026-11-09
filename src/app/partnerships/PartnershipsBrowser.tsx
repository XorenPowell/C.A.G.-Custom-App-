"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { followUpLabel, followUpState } from "@/lib/follow-up";
import { dateDisplay, money } from "@/lib/format";
import type { ListItem, Partnership } from "@/lib/types";

export type PartnershipRow = Partnership & {
  zone_name: string;
  stage_name: string;
  tier_name: string;
  contact_count: number;
  /** Every contact's name, for search. Replaces the retired poc_name slot. */
  contact_names: string;
  referrals: number;
  revenue: number;
  safc_label: string | null;
  safc_state: "overdue" | "today" | "upcoming" | null;
};

const STAGE_TONE: Record<string, string> = {
  good: "border-[var(--color-good)] text-[var(--color-good)]",
  warn: "border-[var(--color-warn)] text-[var(--color-warn)]",
  muted: "border-[var(--color-line)] text-[var(--color-muted)]",
};

const DUE_TONE = {
  overdue: "border-[var(--color-danger)] text-[var(--color-danger)]",
  today: "border-[var(--color-warn)] text-[var(--color-warn)]",
  upcoming: "border-[var(--color-line)] text-[var(--color-muted)]",
  none: "border-[var(--color-danger)] text-[var(--color-danger)]",
} as const;

const SORTS = [
  { value: "follow_up", label: "Next follow-up" },
  { value: "last_contact", label: "Last contact (newest)" },
  { value: "last_contact_oldest", label: "Last contact (oldest)" },
  { value: "business_name", label: "Business name" },
  { value: "referrals", label: "Referrals" },
];

/**
 * Filters apply as you type rather than behind an Apply button: with 117
 * rows, narrowing is iterative and a round trip per keystroke-set is the
 * difference between searching and submitting a form.
 */
export default function PartnershipsBrowser({
  rows,
  stages,
  zones,
  tiers,
  rejectedStageId,
}: {
  rows: PartnershipRow[];
  stages: ListItem[];
  zones: ListItem[];
  tiers: ListItem[];
  rejectedStageId: string | null;
}) {
  const [view, setView] = useState("all");
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("");
  const [stage, setStage] = useState("");
  const [tier, setTier] = useState("");
  const [sort, setSort] = useState("follow_up");
  const [excludeRejected, setExcludeRejected] = useState(true);

  const counts = useMemo(() => {
    const live = rejectedStageId ? rows.filter((r) => r.status_id !== rejectedStageId) : rows;
    return {
      all: live.length,
      due: live.filter((r) => ["overdue", "today"].includes(followUpState(r))).length,
      overdue: live.filter((r) => followUpState(r) === "overdue").length,
      none: live.filter((r) => !r.follow_up_at).length,
      never: live.filter((r) => !r.last_contact).length,
      safc: live.filter((r) => r.safc_state !== null).length,
    };
  }, [rows, rejectedStageId]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (excludeRejected && rejectedStageId && r.status_id === rejectedStageId) return false;
      if (view === "due" && !["overdue", "today"].includes(followUpState(r))) return false;
      if (view === "overdue" && followUpState(r) !== "overdue") return false;
      if (view === "none" && r.follow_up_at) return false;
      if (view === "never" && r.last_contact) return false;
      if (view === "safc" && r.safc_state === null) return false;
      if (zone && r.zone_id !== zone) return false;
      if (stage && r.status_id !== stage) return false;
      if (tier && r.tier_id !== tier) return false;
      if (needle) {
        const hay = [r.business_name, r.address, r.contact_names, r.notes, r.zone_name]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

    const byName = (a: PartnershipRow, b: PartnershipRow) =>
      a.business_name.localeCompare(b.business_name);
    out = [...out];
    if (sort === "business_name") out.sort(byName);
    else if (sort === "referrals") out.sort((a, b) => b.referrals - a.referrals || byName(a, b));
    else if (sort === "last_contact")
      out.sort((a, b) => (b.last_contact ?? "").localeCompare(a.last_contact ?? "") || byName(a, b));
    else if (sort === "last_contact_oldest")
      out.sort((a, b) => (a.last_contact ?? "").localeCompare(b.last_contact ?? "") || byName(a, b));
    else
      out.sort((a, b) => {
        const da = a.follow_up_at ?? "";
        const db = b.follow_up_at ?? "";
        if (da && db) return da.localeCompare(db) || byName(a, b);
        if (da) return -1;
        if (db) return 1;
        return byName(a, b);
      });
    return out;
  }, [rows, view, q, zone, stage, tier, sort, excludeRejected, rejectedStageId]);

  const Pill = ({ id, label, n }: { id: string; label: string; n: number }) => (
    <button type="button" onClick={() => setView(id)} className={`btn btn-sm ${view === id ? "btn-primary" : ""}`}>
      {label} <span className={view === id ? "" : "text-[var(--text-faint)]"}>{n}</span>
    </button>
  );

  const FollowUp = ({ r }: { r: PartnershipRow }) => {
    const st = followUpState(r);
    return (
      <>
        <span className={`badge ${DUE_TONE[st]}`}>
          {st === "none" ? "not set" : followUpLabel(r)}
        </span>
        {r.follow_up_at && (
          <div className="text-[11px] text-[var(--text-faint)]">
            {dateDisplay(r.follow_up_at.slice(0, 10))}
          </div>
        )}
      </>
    );
  };

  const Safc = ({ r }: { r: PartnershipRow }) =>
    r.safc_state === null ? (
      <span className="muted">—</span>
    ) : (
      <span className={`badge ${DUE_TONE[r.safc_state]}`}>{r.safc_label}</span>
    );

  return (
    <>
      <div className="-mx-3 mb-3 flex gap-1 overflow-x-auto px-3 md:mx-0 md:px-0 [&>*]:shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Pill id="all" label="All" n={counts.all} />
        <Pill id="due" label="Due now" n={counts.due} />
        <Pill id="overdue" label="Overdue" n={counts.overdue} />
        <Pill id="none" label="No next action" n={counts.none} />
        <Pill id="never" label="Never contacted" n={counts.never} />
        <Pill id="safc" label="SAFC" n={counts.safc} />
      </div>

      <div className="card card-pad mb-3">
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="field">
            <label className="label" htmlFor="p-q">Search</label>
            <input id="p-q" className="input" value={q} placeholder="Business, contact, address"
              onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="p-zone">Zone</label>
            <select id="p-zone" className="select" value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">All zones</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="p-stage">Stage</label>
            <select id="p-stage" className="select" value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">All stages</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="p-sort">Sort by</label>
            <select id="p-sort" className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="field mb-0 w-full sm:w-48">
            <label className="label" htmlFor="p-tier">Tier</label>
            <select id="p-tier" className="select" value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="">All tiers</option>
              {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={excludeRejected} className="size-4 accent-[var(--color-accent)]"
              onChange={(e) => setExcludeRejected(e.target.checked)} />
            Exclude rejected
          </label>
        </div>
      </div>

      <p className="muted mb-2 text-sm">
        {visible.length} of {counts.all}
      </p>

      {/* Mobile */}
      <div className="flex flex-col gap-2 md:hidden">
        {visible.map((r) => (
          <Link key={r.id} href={`/partnerships/${r.id}`} className="card card-pad block">
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold">{r.business_name}</span>
              <span className={`badge ${STAGE_TONE[r.stage_name === "Mature" ? "good" : r.stage_name === "Developing" ? "warn" : "muted"]}`}>
                {r.stage_name}
              </span>
            </div>
            <div className="muted text-xs">
              {r.zone_name} · {r.contact_count} contact{r.contact_count === 1 ? "" : "s"}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <FollowUp r={r} />
              {r.safc_state !== null && <Safc r={r} />}
            </div>
            <div className="muted mt-1 text-xs">
              last contact {r.last_contact ? dateDisplay(r.last_contact) : "never"}
              {r.referrals > 0 && ` · ${r.referrals} refs · ${money(r.revenue)}`}
            </div>
          </Link>
        ))}
        {visible.length === 0 && <p className="muted card card-pad text-sm">Nothing matches.</p>}
      </div>

      {/* Desktop */}
      <div className="card hidden md:block">
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Business</th><th>Stage</th><th>Zone</th><th>Last contact</th>
                <th>Next follow-up</th><th>SAFC</th><th>Refs</th><th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/partnerships/${r.id}`} className="link font-semibold">
                      {r.business_name}
                    </Link>
                    <div className="text-[11px] text-[var(--text-faint)]">
                      {r.contact_count} contact{r.contact_count === 1 ? "" : "s"}
                      {r.address ? ` · ${r.address}` : ""}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${STAGE_TONE[r.stage_name === "Mature" ? "good" : r.stage_name === "Developing" ? "warn" : "muted"]}`}>
                      {r.stage_name}
                    </span>
                  </td>
                  <td className="muted">{r.zone_name}</td>
                  <td className={`mono whitespace-nowrap ${!r.last_contact ? "text-[var(--color-danger)]" : ""}`}>
                    {r.last_contact ? dateDisplay(r.last_contact) : "never"}
                  </td>
                  <td className="whitespace-nowrap"><FollowUp r={r} /></td>
                  <td className="whitespace-nowrap"><Safc r={r} /></td>
                  <td className="mono">{r.referrals || "—"}</td>
                  <td className="mono">{r.revenue ? money(r.revenue) : "—"}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={8} className="muted">Nothing matches these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
