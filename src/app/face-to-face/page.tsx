import TopBar from "@/components/TopBar";

/**
 * Placeholder route only — the actual feature isn't built yet.
 * Reachable from the Home screen's nav list, marked with a "New" pill.
 */
export default function FaceToFacePage() {
  return (
    <>
      <TopBar title="Work Face to Face" />
      <main className="page">
        <div className="card card-pad">
          <p className="muted text-sm">Coming soon.</p>
        </div>
      </main>
    </>
  );
}
