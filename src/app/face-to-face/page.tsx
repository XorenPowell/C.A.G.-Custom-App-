import Link from "next/link";
import TopBar from "@/components/TopBar";
import NewSessionButton from "@/components/NewSessionButton";
import {
  getActiveSession,
  getConversations,
  getSessions,
  getTodayConversationCount,
} from "@/lib/face-to-face";
import { getLists, getSettings, lookup, nameMap } from "@/lib/data";
import { durationDisplay } from "@/lib/format";
import type { FaceToFaceSession } from "@/lib/types";

function sessionDuration(session: FaceToFaceSession): string {
  const start = new Date(session.started_at).getTime();
  const end = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
  return durationDisplay(Math.round((end - start) / 60000));
}

export default async function FaceToFacePage() {
  const [activeSession, sessions, todayCount, conversations, lists, settings] = await Promise.all([
    getActiveSession(),
    getSessions(),
    getTodayConversationCount(),
    getConversations(),
    getLists(),
    getSettings(),
  ]);
  const names = nameMap(lists);

  const countsBySession = new Map<string, number>();
  for (const c of conversations) {
    if (!c.session_id) continue;
    countsBySession.set(c.session_id, (countsBySession.get(c.session_id) ?? 0) + 1);
  }

  return (
    <>
      <TopBar
        title="Work Face to Face"
        action={<NewSessionButton activeSession={activeSession} lists={lists} />}
      />
      <main className="page">
        <p className="mb-3 text-lg font-bold">
          {todayCount} / {settings.face_to_face_daily_goal} conversations today
        </p>

        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/face-to-face/sessions/${s.id}`}
              className="card card-pad block"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold">
                  {new Date(s.started_at).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    timeZone: "America/Chicago",
                  })}
                </span>
                {!s.ended_at && (
                  <span className="badge border-[var(--color-good)] text-[var(--color-good)]">
                    In progress
                  </span>
                )}
              </div>
              <div className="muted text-sm">
                {sessionDuration(s)} · {countsBySession.get(s.id) ?? 0} / {s.conversation_goal}{" "}
                conversations
              </div>
              <div className="muted text-sm">{lookup(names, s.zone_id)}</div>
            </Link>
          ))}
          {sessions.length === 0 && (
            <p className="muted card card-pad text-sm">
              No sessions yet — tap + New Session to start one.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
