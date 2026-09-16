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
      </main>
    </>
  );
}
