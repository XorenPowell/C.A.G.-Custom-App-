import Link from "next/link";
import TopBar from "@/components/TopBar";
import { getPartnerships, getReferralCounts } from "@/lib/partnerships";
import { getCampaigns, getPlacements, restockLabel, restockState } from "@/lib/campaigns";
import { getContacts } from "@/lib/contacts";
import { active, getLists, lookup, nameMap } from "@/lib/data";
import { partnershipStageId } from "@/lib/lists";
import PartnershipsBrowser, { type PartnershipRow } from "./PartnershipsBrowser";

export default async function PartnershipsPage() {
  const [lists, all, referrals, campaigns, contacts] = await Promise.all([
    getLists(),
    getPartnerships(),
    getReferralCounts(),
    getCampaigns(),
    getContacts(),
  ]);

  const campaign = campaigns[0] ?? null;
  const placements = campaign ? await getPlacements(campaign.id) : [];
  const placementBy = new Map(placements.map((p) => [p.partnership_id, p]));

  const names = nameMap(lists);
  const contactCounts = contacts.reduce<Record<string, number>>((acc, c) => {
    if (c.partnership_id) acc[c.partnership_id] = (acc[c.partnership_id] ?? 0) + 1;
    return acc;
  }, {});

  // Search used to read the partnership's poc_name slot. Those slots are
  // retired, so the names come from the contacts themselves — which also
  // means searching a person now finds them however many there are.
  const contactNames = contacts.reduce<Record<string, string[]>>((acc, c) => {
    if (!c.partnership_id) return acc;
    (acc[c.partnership_id] ??= []).push(c.name);
    return acc;
  }, {});

  // Everything the table needs is resolved here, so the browser stays a pure
  // filtering component with no further lookups.
  const rows: PartnershipRow[] = all.map((p) => {
    const placement = placementBy.get(p.id) ?? null;
    const ref = referrals.get(p.id);
    return {
      ...p,
      zone_name: lookup(names, p.zone_id),
      stage_name: lookup(names, p.status_id),
      tier_name: lookup(names, p.tier_id),
      contact_count: contactCounts[p.id] ?? 0,
      contact_names: (contactNames[p.id] ?? []).join(" "),
      referrals: ref?.jobs ?? 0,
      revenue: ref?.revenue ?? 0,
      safc_label: placement ? restockLabel(placement) : null,
      safc_state: placement ? restockState(placement) : null,
    };
  });

  return (
    <>
      <TopBar
        title="Partnerships"
        back={null}
        action={
          <div className="flex shrink-0 gap-2">
            <Link href="/contacts" className="btn btn-sm">
              Contacts
            </Link>
            <Link href="/campaigns" className="btn btn-sm">
              SAFC
            </Link>
            <Link href="/partnerships/new" className="btn btn-sm btn-primary">
              + New
            </Link>
          </div>
        }
      />
      <main className="page">
        <PartnershipsBrowser
          rows={rows}
          stages={active(lists.partnership_status)}
          zones={active(lists.zone)}
          tiers={active(lists.partnership_tier)}
          rejectedStageId={partnershipStageId(lists, "Rejected")}
        />
      </main>
    </>
  );
}
