"use client";

import { useEffect, useState } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";

/**
 * Next.js shows this automatically the instant a navigation starts, for as
 * long as the destination page is still loading — this component's own
 * mounted lifetime is the timer, no coordination needed.
 */
export default function Loading() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), 7500);
    return () => clearTimeout(id);
  }, []);

  return (
    <LoadingOverlay
      timedOut={timedOut}
      actionLabel="Reload"
      onAction={() => window.location.reload()}
    />
  );
}
