import Link from "next/link";
import TopBar from "@/components/TopBar";
import { getSettings } from "@/lib/data";
import FaceToFaceSettingsEditor from "./FaceToFaceSettingsEditor";

export default async function FaceToFaceSettingsPage() {
  const settings = await getSettings();
  return (
    <>
      <TopBar title="Work Face to Face" back="/settings" backLabel="Settings" />
      <main className="page max-w-2xl">
        <FaceToFaceSettingsEditor dailyGoal={settings.face_to_face_daily_goal} />

        <Link
          href="/settings/lists/conversation_outcome"
          className="card mb-16 mt-3 flex min-h-12 items-center justify-between gap-3 px-3 py-2 hover:bg-[var(--color-sunken)]"
        >
          <span className="font-semibold">Conversation Outcomes</span>
          <span aria-hidden className="text-[var(--color-muted)]">
            ›
          </span>
        </Link>
      </main>
    </>
  );
}
