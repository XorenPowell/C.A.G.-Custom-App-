import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import ConversationEditor from "@/components/ConversationEditor";
import DeleteConversationButton from "./DeleteConversationButton";
import { getConversation } from "@/lib/face-to-face";
import { getLists } from "@/lib/data";
import { chicagoDateOf } from "@/lib/dates";
import { dateLongDisplay } from "@/lib/format";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [conversation, lists] = await Promise.all([getConversation(id), getLists()]);
  if (!conversation) notFound();

  const time = new Date(conversation.occurred_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });

  const back = conversation.session_id
    ? `/face-to-face/sessions/${conversation.session_id}`
    : "/face-to-face";
  const backLabel = conversation.session_id ? "Session" : "Work Face to Face";

  return (
    <>
      <TopBar title="Conversation" back={back} backLabel={backLabel} />
      <main className="page max-w-2xl">
        <p className="muted mb-3 text-sm">
          Logged {dateLongDisplay(chicagoDateOf(conversation.occurred_at))} at {time}
        </p>

        <ConversationEditor
          id={conversation.id}
          outcomeId={conversation.outcome_id}
          intentLevel={conversation.intent_level}
          lists={lists}
        />

        <DeleteConversationButton id={conversation.id} />
      </main>
    </>
  );
}
