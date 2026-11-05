"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { savePlacement } from "@/app/actions/campaigns";
import { todayLocal } from "@/lib/follow-up";

type Candidate = { id: string; name: string; zone: string };

/**
 * Adds a stack to a partnership that doesn't have one.
 *
 * The picker only lists businesses without a live placement, which turns the
 * campaign into a conversion list over partnerships already known rather than
 * a hunt for new ones.
 */
export default function AddPlacement({
  campaignId,
  candidates,
}: {
  campaignId: string;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useGlobalTransition();
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [partnershipId, setPartnershipId] = useState("");
  const [location, setLocation] = useState("Front counter");
  const [interval, setInterval] = useState("14");
  const [cards, setCards] = useState("50");

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    const base = n ? candidates.filter((c) => c.name.toLowerCase().includes(n)) : candidates;
    return base.slice(0, 40);
  }, [q, candidates]);

  function save() {
    if (!partnershipId) {
      setError("Pick a business first.");
      return;
    }
    start(async () => {
      setError(null);
      const res = await savePlacement({
        id: null,
        campaign_id: campaignId,
        partnership_id: partnershipId,
        location,
        placed_on: todayLocal(),
        last_restock_on: todayLocal(),
        restock_interval_days: interval,
        cards_left: cards,
        notes: null,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setOpen(false);
      setPartnershipId("");
      setQ("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + Add placement
      </button>
    );
  }

  return (
    <section className="card mb-3 border-[var(--color-accent)]">
      <div className="section-title flex items-center justify-between">
        <span>Add a stack</span>
        <button className="btn btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <div className="card-pad">
        <div className="field">
          <label className="label" htmlFor="ap-q">
            Business ({candidates.length} without a stack)
          </label>
          <input id="ap-q" className="input" value={q} placeholder="Type to search"
            onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="mb-3 max-h-56 overflow-y-auto border border-[var(--color-line)]">
          {matches.map((c) => (
            <button key={c.id} type="button" onClick={() => setPartnershipId(c.id)}
              className={`block w-full px-2 py-2 text-left text-sm ${
                partnershipId === c.id ? "bg-[var(--pill-active-bg)]" : "hover:bg-[var(--panel-raised)]"
              }`}>
              <span className="font-semibold">{c.name}</span>
              <span className="muted"> · {c.zone}</span>
            </button>
          ))}
          {matches.length === 0 && (
            <p className="muted p-2 text-sm">
              Every partnership already has a stack. Add a new partnership first.
            </p>
          )}
        </div>

        <div className="grid-form">
          <div className="field">
            <label className="label" htmlFor="ap-loc">Where it sits</label>
            <input id="ap-loc" className="input" value={location} list="ap-locs"
              onChange={(e) => setLocation(e.target.value)} />
            <datalist id="ap-locs">
              {["Front counter", "Lobby rack", "Reception desk", "Mailroom board", "Checkout", "Break room"]
                .map((l) => <option key={l} value={l} />)}
            </datalist>
          </div>
          <div className="field">
            <label className="label" htmlFor="ap-int">Restock every (days)</label>
            <input id="ap-int" className="input" inputMode="numeric" value={interval}
              onChange={(e) => setInterval(e.target.value.replace(/\D/g, ""))} />
            <p className="muted mt-1 text-xs">
              7 for heavy footfall, 14 is the usual, 21 for quiet spots.
            </p>
          </div>
          <div className="field">
            <label className="label" htmlFor="ap-cards">Cards left now</label>
            <input id="ap-cards" className="input" inputMode="numeric" value={cards}
              onChange={(e) => setCards(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>

        {error && (
          <p className="mb-2 border border-[var(--color-danger)] px-2 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}

        <button className="btn btn-primary" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Add placement"}
        </button>
      </div>
    </section>
  );
}
