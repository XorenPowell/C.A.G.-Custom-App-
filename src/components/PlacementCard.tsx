"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { markRestocked, removePlacement, savePlacement } from "@/app/actions/campaigns";
import { todayLocal } from "@/lib/follow-up";
import { dateDisplay } from "@/lib/format";
import type { CampaignPlacement } from "@/lib/types";

/**
 * The stack at this business, editable in place.
 *
 * Restocking is a one-tap action rather than a date field, because it is
 * recorded standing in the lobby with a phone in one hand.
 */
export default function PlacementCard({
  campaignId,
  partnershipId,
  placement,
  dueLabel,
  tone,
}: {
  campaignId: string;
  partnershipId: string;
  placement: CampaignPlacement | null;
  dueLabel: string;
  tone: "overdue" | "today" | "upcoming" | "none";
}) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [location, setLocation] = useState(placement?.location ?? "Front counter");
  const [placedOn, setPlacedOn] = useState(placement?.placed_on ?? todayLocal());
  const [interval, setIntervalDays] = useState(String(placement?.restock_interval_days ?? 14));
  const [cards, setCards] = useState(placement?.cards_left == null ? "" : String(placement.cards_left));
  /** How many went on the stack this time. Feeds the card ledger. */
  const [dropped, setDropped] = useState("");

  const badge =
    tone === "overdue"
      ? "border-[var(--color-danger)] text-[var(--color-danger)]"
      : tone === "today"
        ? "border-[var(--color-warn)] text-[var(--color-warn)]"
        : "border-[var(--color-line)] text-[var(--color-muted)]";

  function persist() {
    start(async () => {
      await savePlacement({
        id: placement?.id ?? null,
        campaign_id: campaignId,
        partnership_id: partnershipId,
        location,
        placed_on: placedOn,
        last_restock_on: placement?.last_restock_on ?? todayLocal(),
        restock_interval_days: interval || "14",
        cards_left: cards === "" ? null : cards,
        notes: placement?.notes ?? null,
      });
      router.refresh();
    });
  }

  if (!placement) {
    return (
      <section className="card">
        <div className="section-title">Stack At Front placement</div>
        <div className="card-pad">
          <p className="muted mb-3 text-sm">No stack placed here yet.</p>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={persist}>
            {pending ? "Adding…" : "+ Add SAFC placement"}
          </button>
        </div>
      </section>
    );
  }

  const daysInPlace = Math.max(
    0,
    Math.round(
      (new Date(`${todayLocal()}T00:00:00Z`).getTime() -
        new Date(`${placement.placed_on}T00:00:00Z`).getTime()) / 86_400_000,
    ),
  );

  return (
    <section className="card border-[#a98bd8]">
      <div className="section-title flex items-center justify-between gap-2">
        <span>Stack At Front placement</span>
        <span className={`badge ${badge}`}>restock {dueLabel}</span>
      </div>

      <div className="card-pad">
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="pc-loc">Where it sits</label>
            <input id="pc-loc" className="input" value={location} list="pc-locs"
              onChange={(e) => setLocation(e.target.value)} onBlur={persist} />
            <datalist id="pc-locs">
              {["Front counter", "Lobby rack", "Reception desk", "Mailroom board", "Checkout", "Break room"]
                .map((l) => <option key={l} value={l} />)}
            </datalist>
          </div>
          <div className="field">
            <label className="label" htmlFor="pc-placed">Placed on</label>
            <input id="pc-placed" type="date" className="input" value={placedOn}
              onChange={(e) => setPlacedOn(e.target.value)} onBlur={persist} />
          </div>
          <div className="field">
            <label className="label" htmlFor="pc-int">Restock every (days)</label>
            <input id="pc-int" className="input" inputMode="numeric" value={interval}
              onChange={(e) => setIntervalDays(e.target.value.replace(/\D/g, ""))} onBlur={persist} />
          </div>
          <div className="field">
            <label className="label" htmlFor="pc-drop">Cards to drop</label>
            <input id="pc-drop" className="input" inputMode="numeric" value={dropped}
              placeholder="25"
              onChange={(e) => setDropped(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="field">
            <label className="label" htmlFor="pc-cards">Cards left (est.)</label>
            <input id="pc-cards" className="input" inputMode="numeric" value={cards}
              onChange={(e) => setCards(e.target.value.replace(/\D/g, ""))} onBlur={persist} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await markRestocked(
                  placement.id,
                  cards === "" ? null : Number(cards),
                  dropped === "" ? null : Number(dropped),
                );
                setDropped("");
                router.refresh();
              })
            }
          >
            {pending ? "…" : "Restocked today"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("End this placement? Its history is kept.")) return;
              start(async () => {
                await removePlacement(placement.id);
                router.refresh();
              });
            }}
          >
            Remove placement
          </button>
        </div>

        <p className="muted mt-2 text-xs">
          Last restocked {dateDisplay(placement.last_restock_on)} · {daysInPlace} days in place
        </p>
      </div>
    </section>
  );
}
