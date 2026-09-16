"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";

type GlobalLoadingContextValue = {
  startLoading: () => void;
  stopLoading: () => void;
};

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

/** How long the overlay spins before it gives up and shows an error instead. */
const TIMEOUT_MS = 7500;

/**
 * App-wide "something is happening" overlay. Any number of in-flight
 * operations can be active at once (a save plus a background refresh, say) —
 * a count, not a boolean, so the overlay only clears once everything is
 * actually done.
 */
export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const [activeCount, setActiveCount] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startLoading = useCallback(() => {
    setActiveCount((c) => {
      if (c === 0) {
        setTimedOut(false);
        clearTimer();
        timerRef.current = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
      }
      return c + 1;
    });
  }, [clearTimer]);

  const stopLoading = useCallback(() => {
    setActiveCount((c) => {
      const next = Math.max(0, c - 1);
      if (next === 0) {
        clearTimer();
        setTimedOut(false);
      }
      return next;
    });
  }, [clearTimer]);

  // A stuck operation (server hung, connection dropped) never resolves on
  // its own, so give the dismiss button a way out of the overlay.
  const dismiss = useCallback(() => {
    clearTimer();
    setActiveCount(0);
    setTimedOut(false);
  }, [clearTimer]);

  return (
    <GlobalLoadingContext.Provider value={{ startLoading, stopLoading }}>
      {children}
      {activeCount > 0 && (
        <LoadingOverlay timedOut={timedOut} actionLabel="Dismiss" onAction={dismiss} />
      )}
    </GlobalLoadingContext.Provider>
  );
}

export function useGlobalLoading(): GlobalLoadingContextValue {
  const ctx = useContext(GlobalLoadingContext);
  if (!ctx) throw new Error("useGlobalLoading must be used within GlobalLoadingProvider");
  return ctx;
}
