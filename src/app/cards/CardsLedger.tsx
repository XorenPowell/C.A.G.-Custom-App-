"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { addCardReceipt, deleteCardReceipt, recordCardCount } from "@/app/actions/cards";
import { todayLocal } from "@/lib/follow-up";
import { dateDisplay } from "@/lib/format";
import type { CardLedger } from "@/lib/cards";

/**
 * What is left, where it went, and when it runs out.
 *
 * The question this screen exists to answer is "do I need to order more",
 * so the balance leads and the history explains it. Drops are read-only
 * here — a drop belongs to the visit or conversation that made it, and
 * editing it anywhere else would put the two out of step.
 */
export default function CardsLedger({ ledger }: { ledger: CardLedger }) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [on, setOn] = useState(todayLocal());
  const [qty, setQty] = useState("1000");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");

  const [counting, setCounting] = useState(false);
  const [countTotal, setCountTotal] = useState("");
  const [countNote, setCountNote] = useState("");

  const [tab, setTab] = useState<"drops" | "receipts" | "counts">("drops");

  if (ledger.failure) {
    return (
      <div className="card border-[var(--color-danger)]">
        <div className="section-title">Cards</div>
        <div className="card-pad">
          <p className="text-sm font-semibold text-[var(--color-danger)]">
            The ledger could not be loaded, so this is not an empty stock.
          </p>
          <p className="muted mt-1 text-xs">{ledger.failure}</p>
          <p className="muted mt-2 text-xs">
            If this names a missing table or column, migration 029 has not been applied
            to this database yet.
          </p>
        </div>
      </div>
    );
  }

  function save() {
    start(async () => {
      setError(null);
      const res = await addCardReceipt({
        received_on: on,
        quantity: qty,
        source: source || null,
        note: note || null,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setAdding(false);
      setSource("");
      setNote("");
      router.refresh();
    });
  }

  function openCount() {
    // Prefilled with what the screen is claiming, so correcting it is a
    // matter of typing over a number rather than working one out.
    setCountTotal(String(Math.max(0, ledger.remaining)));
    setCountNote("");
    setError(null);
    setCounting(true);
  }

  function saveCount() {
    start(async () => {
      setError(null);
      const res = await recordCardCount({
        counted_on: todayLocal(),
        total: countTotal,
        // What this screen was showing when the number was typed, so the
        // correction is exactly the gap being closed.
        expected: ledger.remaining,
        note: countNote || null,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save the count.");
        return;
      }
      setCounting(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!window.confirm("Delete this collection? The balance changes.")) return;
    start(async () => {
      const res = await deleteCardReceipt(id);
      if (!res.ok) setError(res.error ?? "Could not delete.");
      router.refresh();
    });
  }

  const low = ledger.remaining < 100;
  const counted = countTotal === "" ? null : Number(countTotal);
  const correction = counted === null ? 0 : counted - ledger.remaining;

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="In hand"
          value={ledger.remaining.toLocaleString()}
          hint={
            low
              ? "running low"
              : ledger.lastCount
                ? "counted " + dateDisplay(ledger.lastCount.received_on)
                : "never counted"
          }
          alarm={low}
          action={
            counting ? null : (
              <button
                type="button"
                className="text-xs text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-accent)]"
                onClick={openCount}
              >
                count
              </button>
            )
          }
        />
        <Stat label="Collected" value={ledger.received.toLocaleString()} hint="all time" />
        <Stat label="Dropped" value={ledger.dropped.toLocaleString()} hint="all time" />
        <Stat
          label="Burn rate"
          value={ledger.burnPerDay ? ledger.burnPerDay.toFixed(1) : "—"}
          hint={
            ledger.runsOut
              ? `out around ${dateDisplay(ledger.runsOut)}`
              : ledger.burnPerDay
                ? "a day"
                : "nothing dropped yet"
          }
        />
      </div>

      {counting && (
        <section className="card mb-3">
          <div className="section-title">Count the stock</div>
          <div className="card-pad">
            <p className="muted mb-3 text-sm">
              The balance above is collections minus drops, and it is only as
              good as what got logged. Type what is actually there: the
              difference is recorded as a correction, nothing is erased, and
              drops logged from here on keep counting down from the new figure.
            </p>
            <div className="grid-form">
              <div className="field">
                <label className="label" htmlFor="cc-total">Cards in hand</label>
                <input
                  id="cc-total"
                  className="input"
                  inputMode="numeric"
                  autoFocus
                  value={countTotal}
                  onChange={(e) => setCountTotal(e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveCount();
                    if (e.key === "Escape") setCounting(false);
                  }}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="cc-note">Note</label>
                <input
                  id="cc-note"
                  className="input"
                  value={countNote}
                  placeholder="Counted the boot"
                  onChange={(e) => setCountNote(e.target.value)}
                />
              </div>
            </div>
            {counted !== null && correction !== 0 && (
              <p className="muted mb-3 text-xs">
                Recorded as{" "}
                <span
                  className={
                    "mono " +
                    (correction < 0
                      ? "text-[var(--color-danger)]"
                      : "text-[var(--color-good)]")
                  }
                >
                  {correction > 0 ? "+" : "\u2212"}
                  {Math.abs(correction).toLocaleString()}
                </span>{" "}
                against the {ledger.remaining.toLocaleString()} the ledger expected.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={pending || countTotal === ""}
                onClick={saveCount}
              >
                {pending ? "Saving\u2026" : "Save count"}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setCounting(false)}>
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="card mb-3">
        <div className="section-title flex items-center justify-between">
          <span>Collections</span>
          {!adding && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setAdding(true)}>
              + Collected cards
            </button>
          )}
        </div>

        {adding && (
          <div className="card-pad border-b border-[var(--color-line)]">
            <div className="grid-form">
              <div className="field">
                <label className="label" htmlFor="cr-on">Collected on</label>
                <input id="cr-on" type="date" className="input" value={on}
                  onChange={(e) => setOn(e.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="cr-qty">How many</label>
                <input id="cr-qty" className="input" inputMode="numeric" value={qty}
                  onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
              </div>
              <div className="field">
                <label className="label" htmlFor="cr-src">From</label>
                <input id="cr-src" className="input" value={source} placeholder="Vistaprint"
                  onChange={(e) => setSource(e.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="cr-note">Note</label>
                <input id="cr-note" className="input" value={note} placeholder="New design"
                  onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={save}>
                {pending ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mx-4 my-2 border border-[var(--color-danger)] px-2 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}

        <div className="-mx-3 flex gap-1 overflow-x-auto px-3 pt-3 md:mx-0 md:px-4 [&>*]:shrink-0">
          <button type="button" onClick={() => setTab("drops")}
            className={`btn btn-sm ${tab === "drops" ? "btn-primary" : ""}`}>
            Dropped <span className="text-[var(--text-faint)]">{ledger.drops.length}</span>
          </button>
          <button type="button" onClick={() => setTab("receipts")}
            className={`btn btn-sm ${tab === "receipts" ? "btn-primary" : ""}`}>
            Collected <span className="text-[var(--text-faint)]">{ledger.receipts.length}</span>
          </button>
          <button type="button" onClick={() => setTab("counts")}
            className={`btn btn-sm ${tab === "counts" ? "btn-primary" : ""}`}>
            Counts <span className="text-[var(--text-faint)]">{ledger.counts.length}</span>
          </button>
        </div>

        {tab === "counts" ? (
          ledger.counts.length === 0 ? (
            <p className="muted card-pad text-sm">
              The stock has never been counted, so the balance is whatever the
              logged collections and drops add up to. Counting it once replaces
              that estimate with a measurement.
            </p>
          ) : (
            <ul className="m-0 mt-2 list-none p-0">
              {ledger.counts.map((c) => (
                <li key={c.id}
                  className="flex items-center gap-3 border-t border-[var(--color-line-soft)] px-3 py-2.5 md:px-4">
                  <span className="mono w-24 shrink-0 text-sm">{dateDisplay(c.received_on)}</span>
                  <span className="mono w-16 shrink-0 text-sm">
                    {(c.counted_total ?? 0).toLocaleString()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span
                      className={
                        "mono " +
                        (c.quantity < 0
                          ? "text-[var(--color-danger)]"
                          : c.quantity > 0
                            ? "text-[var(--color-good)]"
                            : "text-[var(--text-faint)]")
                      }
                    >
                      {c.quantity === 0
                        ? "no change"
                        : (c.quantity > 0 ? "+" : "\u2212") +
                          Math.abs(c.quantity).toLocaleString()}
                    </span>
                    {c.note ? <span className="muted">{" \u00b7 "}{c.note}</span> : null}
                  </span>
                  <button type="button" disabled={pending} onClick={() => remove(c.id)}
                    className="shrink-0 text-xs text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-danger)]">
                    delete
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : tab === "receipts" ? (
          ledger.receipts.length === 0 ? (
            <p className="muted card-pad text-sm">
              Nothing collected yet, so the balance below zero is just the drops.
              Add a collection and it starts counting down.
            </p>
          ) : (
            <ul className="m-0 mt-2 list-none p-0">
              {ledger.receipts.map((r) => (
                <li key={r.id}
                  className="flex items-center gap-3 border-t border-[var(--color-line-soft)] px-3 py-2.5 md:px-4">
                  <span className="mono w-24 shrink-0 text-sm">{dateDisplay(r.received_on)}</span>
                  <span className="mono w-16 shrink-0 text-sm text-[var(--color-good)]">
                    +{r.quantity.toLocaleString()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {[r.source, r.note].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <button type="button" disabled={pending} onClick={() => remove(r.id)}
                    className="shrink-0 text-xs text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-danger)]">
                    delete
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : ledger.drops.length === 0 ? (
          <p className="muted card-pad text-sm">
            Nothing dropped yet. Cards are counted from visits and face-to-face
            conversations, so logging either one adds a line here.
          </p>
        ) : (
          <ul className="m-0 mt-2 list-none p-0">
            {ledger.drops.slice(0, 100).map((d, i) => (
              <li key={`${d.source}-${i}`}
                className="flex items-center gap-3 border-t border-[var(--color-line-soft)] px-3 py-2.5 md:px-4">
                <span className="mono w-24 shrink-0 text-sm">{dateDisplay(d.date)}</span>
                <span className="mono w-16 shrink-0 text-sm text-[var(--color-danger)]">
                  −{d.quantity.toLocaleString()}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {d.partnership_id ? (
                    <Link href={`/partnerships/${d.partnership_id}`} className="link">
                      {d.label}
                    </Link>
                  ) : (
                    d.label
                  )}
                </span>
                <span className="badge shrink-0 border-[var(--color-line)] text-[10px] text-[var(--text-faint)]">
                  {d.source === "visit" ? "VISIT" : "F2F"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {ledger.drops.length > 100 && tab === "drops" && (
          <p className="muted card-pad text-xs">
            Showing the most recent 100 of {ledger.drops.length}.
          </p>
        )}
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  alarm,
  action,
}: {
  label: string;
  value: string;
  hint?: string;
  alarm?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className={`card card-pad ${alarm ? "border-[var(--color-danger)]" : ""}`}>
      <div className="label flex items-center justify-between gap-2">
        <span>{label}</span>
        {action}
      </div>
      <div
        className={`font-heading text-2xl font-extrabold ${
          alarm ? "text-[var(--color-danger)]" : ""
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-[var(--text-faint)]">{hint}</div>}
    </div>
  );
}
