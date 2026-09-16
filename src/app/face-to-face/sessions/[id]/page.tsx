import Link from "next/link";
import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import SessionTimer from "@/components/SessionTimer";
import EndSessionButton from "@/components/EndSessionButton";
import { startConversationInSession } from "@/app/actions/face-to-face";
import { getSession, getSessionConversations } from "@/lib/face-to-face";
import { getLists, lookup, nameMap } from "@/lib/data";
import { dateDisplay, durationDisplay, phoneDisplay } from "@/lib/format";
import type { FaceToFaceConversation } from "@/lib/types";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function ConversationList({
  conversations,
  names,
}: {
  conversations: FaceToFaceConversation[];
  names: Map<string, string>;
}) {
  if (conversations.length === 0) {
    return <p className="muted card card-pad text-sm">No conversations logged in this session yet.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
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
    </div>
  );
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, conversations, lists] = await Promise.all([
    getSession(id),
    getSessionConversations(id),
    getLists(),
  ]);
  if (!session) notFound();
  const names = nameMap(lists);
  const isActive = session.ended_at === null;

  if (isActive) {
    return (
      <>
        <TopBar title="Active Session" back="/face-to-face" backLabel="Work Face to Face" />
        <main className="page max-w-2xl">
          <div className="card card-pad mb-3 flex flex-col items-center gap-1 py-6">
            <SessionTimer startedAt={session.started_at} />
            <span className="muted text-sm">
              elapsed · committing to {session.committed_hours}h · {lookup(names, session.zone_id)}
            </span>
          </div>

          <p className="mb-3 text-center text-lg font-bold">
            {conversations.length} / {session.conversation_goal} conversations
          </p>

          <form action={startConversationInSession.bind(null, session.id, session.zone_id)}>
            <button type="submit" className="btn btn-primary mb-4 w-full">
              + New Conversation
            </button>
          </form>

          <ConversationList conversations={conversations} names={names} />

          <EndSessionButton id={session.id} />
        </main>
      </>
    );
  }

  const minutes = session.ended_at
    ? Math.round(
        (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000,
      )
    : 0;

  return (
    <>
      <TopBar title="Session Overview" back="/face-to-face" backLabel="Work Face to Face" />
      <main className="page max-w-2xl">
        <div className="card card-pad mb-3">
          <p className="text-sm">
            {dateDisplay(session.started_at)} · {timeOf(session.started_at)} –{" "}
            {session.ended_at ? timeOf(session.ended_at) : "—"}
          </p>
          <p className="mt-1 text-lg font-bold">{durationDisplay(minutes)}</p>
          <p className="muted text-sm">
            {conversations.length} / {session.conversation_goal} conversations ·{" "}
            {lookup(names, session.zone_id)}
          </p>
        </div>

        <ConversationList conversations={conversations} names={names} />
      </main>
    </>
  );
}
