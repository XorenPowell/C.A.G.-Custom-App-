import TopBar from "@/components/TopBar";
import {
  getCampaigns,
  getPlacements,
  restockDue,
  restockLabel,
  restockQueue,
  restockState,
} from "@/lib/campaigns";
import { getPartnerships } from "@/lib/partnerships";
import { active, getLists, lookup, nameMap } from "@/lib/data";
import { dateDisplay } from "@/lib/format";
import AddPlacement from "./AddPlacement";
import RestockRow from "./RestockRow";
import TargetEditor from "./TargetEditor";

export default async function CampaignsPage() {
  const [campaigns, lists, partnerships] = await Promise.all([
    getCampaigns(),
    getLists(),
    getPartnerships(),
  ]);

  const campaign = campaigns[0];
  if (!campaign) {
    return (
      <>
        <TopBar title="Campaigns" />
        <main className="page">
          <p className="muted card card-pad text-sm">
            No active campaign. One is created by migration 022.
          </p>
        </main>
      </>
    );
  }

  const placements = await getPlacements(campaign.id);
  const names = nameMap(lists);

  const live = placements.length;
  const target = campaign.target || 0;
  const pct = target ? Math.min(100, Math.round((live / target) * 100)) : 0;
  const queue = restockQueue(placements);
  const overdue = queue.filter((p) => restockState(p) === "overdue").length;

  // The target is measured against partnerships already known, so the honest
  // framing is conversion, not prospecting.
  const placedIds = new Set(placements.map((p) => p.partnership_id));
  const candidates = partnerships
    .filter((p) => !placedIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.business_name, zone: lookup(names, p.zone_id) }));

  const byZone = active(lists.zone).map((z) => ({
    name: z.name,
    placed: placements.filter((p) => p.partnership?.zone_id === z.id).length,
    total: partnerships.filter((p) => p.zone_id === z.id).length,
  }));
  const maxZone = Math.max(1, ...byZone.map((z) => z.total));

  const avgInterval = live
    ? Math.round(placements.reduce((s, p) => s + p.restock_interval_days, 0) / live)
    : 0;

  return (
    <>
      <TopBar title={campaign.short_name || campaign.name} />
      <main className="page">
        <p className="muted mb-3 text-sm">{campaign.description}</p>

        <section className="card mb-3 p-4 md:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="label">Stacks live</div>
              <div className="font-heading mono text-5xl font-extrabold leading-none">
                {live}
                <span className="text-lg text-[var(--color-muted)]"> / {target}</span>
              </div>
            </div>
            <div className="text-right">
              <span
                className={`badge ${
                  pct >= 75
                    ? "border-[var(--color-good)] text-[var(--color-good)]"
                    : pct >= 40
                      ? "border-[var(--color-warn)] text-[var(--color-warn)]"
                      : "border-[var(--color-danger)] text-[var(--color-danger)]"
                }`}
              >
                {pct}% of target
              </span>
              <div className="muted mono mt-1 text-sm">
                {Math.max(0, target - live)} to go
              </div>
              <div className="mt-2">
                <TargetEditor campaignId={campaign.id} target={target} />
              </div>
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--panel-raised)]">
            <div className="h-full rounded-full bg-[var(--color-good)]" style={{ width: `${pct}%` }} />
          </div>

          <p className="muted mt-2 text-xs">
            {candidates.length} of your {partnerships.length} partnerships still have no
            stack — the target is a conversion goal over businesses you already know, not
            a hunt for new ones.
            {avgInterval > 0 && ` Average cadence ${avgInterval} days.`}
          </p>
        </section>

        <div className="mb-3">
          <AddPlacement campaignId={campaign.id} candidates={candidates} />
        </div>

        <section className="card mb-3">
          <div className="section-title flex items-center justify-between">
            <span>Restock run</span>
            <span
              className={`badge ${
                overdue
                  ? "border-[var(--color-danger)] text-[var(--color-danger)]"
                  : "border-[var(--color-line)] text-[var(--color-muted)]"
              }`}
            >
              {queue.length} due{overdue ? ` · ${overdue} overdue` : ""}
            </span>
          </div>
          {queue.length === 0 ? (
            <p className="muted card-pad text-sm">
              Nothing due. Every stack is within its restock interval.
            </p>
          ) : (
            <div>
              {queue.map((p) => (
                <RestockRow
                  key={p.id}
                  placementId={p.id}
                  partnershipId={p.partnership_id}
                  businessName={p.partnership?.business_name ?? "—"}
                  zoneName={lookup(names, p.partnership?.zone_id ?? null)}
                  location={p.location}
                  cardsLeft={p.cards_left}
                  intervalDays={p.restock_interval_days}
                  lastRestock={p.last_restock_on ? dateDisplay(p.last_restock_on) : null}
                  dueLabel={restockLabel(p)}
                  tone={restockState(p)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="card mb-3">
          <div className="section-title">Coverage by zone</div>
          <div className="card-pad">
            {byZone.map((z) => (
              <div key={z.name} className="mb-2 last:mb-0">
                <div className="flex justify-between text-sm">
                  <span>{z.name}</span>
                  <span className="muted mono">
                    {z.placed} / {z.total}
                  </span>
                </div>
                <div className="lbar">
                  <i style={{ width: `${(z.placed / maxZone) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {live > 0 && (
          <section className="card">
            <div className="section-title">All live stacks ({live})</div>
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Zone</th>
                    <th>Location</th>
                    <th>Cards left</th>
                    <th>Cadence</th>
                    <th>Last restock</th>
                    <th>Next due</th>
                  </tr>
                </thead>
                <tbody>
                  {[...placements]
                    .sort((a, b) => restockDue(a).localeCompare(restockDue(b)))
                    .map((p) => (
                      <tr key={p.id}>
                        <td className="font-semibold">{p.partnership?.business_name ?? "—"}</td>
                        <td className="muted">{lookup(names, p.partnership?.zone_id ?? null)}</td>
                        <td className="muted text-xs">{p.location ?? "—"}</td>
                        <td
                          className={`mono ${p.cards_left != null && p.cards_left < 10 ? "text-[var(--color-danger)]" : ""}`}
                        >
                          {p.cards_left ?? "—"}
                        </td>
                        <td className="muted mono">{p.restock_interval_days}d</td>
                        <td className="muted mono">{dateDisplay(p.last_restock_on)}</td>
                        <td className="mono">{dateDisplay(restockDue(p))}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
