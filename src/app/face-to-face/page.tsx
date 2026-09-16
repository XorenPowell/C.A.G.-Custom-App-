import Link from "next/link";
import TopBar from "@/components/TopBar";
import { startConversation } from "@/app/actions/face-to-face";
import { getConversations } from "@/lib/face-to-face";
import { getLists, lookup, nameMap } from "@/lib/data";
import { dateDisplay, phoneDisplay } from "@/lib/format";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default async function FaceToFacePage() {
  const [conversations, lists] = await Promise.all([getConversations(), getLists()]);
  const names = nameMap(lists);

  return (
    <>
      <TopBar
        title="Work Face to Face"
        action={
          <form action={startConversation}>
            <button type="submit" className="btn btn-sm btn-primary shrink-0">
              + New Conversation
            </button>
          </form>
        }
      />
      <main className="page">
        <p className="muted mb-3 text-sm">
          {conversations.length} conversation{conversations.length === 1 ? "" : "s"} logged.
        </p>

        {/* Mobile: cards */}
        <div className="flex flex-col gap-2 md:hidden">
          {conversations.map((c) => (
            <Link key={c.id} href={`/face-to-face/${c.id}`} className="card card-pad block">
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold">{c.contact_name || "Unnamed contact"}</span>
                <span className="badge border-[var(--pill-border)] bg-[var(--pill-bg)]">
                  {c.intent_level}/10
                </span>
              </div>
              <div className="muted text-sm">
                {dateDisplay(c.occurred_at)} · {timeOf(c.occurred_at)}
              </div>
              <div className="muted text-sm">
                {lookup(names, c.service_category_id)} · {lookup(names, c.zone_id)}
              </div>
              {c.contact_phone && <div className="text-sm">{phoneDisplay(c.contact_phone)}</div>}
              <div className="muted mt-1 text-xs">{c.cards_given} card(s) given</div>
            </Link>
          ))}
          {conversations.length === 0 && (
            <p className="muted card card-pad text-sm">
              No conversations logged yet — tap + New Conversation to start one.
            </p>
          )}
        </div>

        {/* Desktop: table */}
        <div className="card hidden md:block">
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Contact</th>
                  <th>Service</th>
                  <th>Zone</th>
                  <th>Cards</th>
                  <th>Intent</th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/face-to-face/${c.id}`} className="link font-semibold">
                        {dateDisplay(c.occurred_at)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{timeOf(c.occurred_at)}</td>
                    <td>
                      {c.contact_name || "—"}
                      {c.contact_phone && (
                        <div className="muted text-xs">{phoneDisplay(c.contact_phone)}</div>
                      )}
                    </td>
                    <td>{lookup(names, c.service_category_id)}</td>
                    <td>{lookup(names, c.zone_id)}</td>
                    <td className="mono">{c.cards_given}</td>
                    <td className="mono">{c.intent_level}/10</td>
                  </tr>
                ))}
                {conversations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      No conversations logged yet — tap + New Conversation to start one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
