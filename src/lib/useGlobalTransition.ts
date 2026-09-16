"use client";

import { useEffect, useTransition, type TransitionStartFunction } from "react";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";

/**
 * Drop-in replacement for React's `useTransition` that also lights up the
 * app-wide loading overlay for as long as the transition is pending — every
 * save/delete/action button gets the overlay for free just by using this
 * instead of `useTransition`.
 */
export function useGlobalTransition(): [boolean, TransitionStartFunction] {
  const [pending, start] = useTransition();
  const { startLoading, stopLoading } = useGlobalLoading();

  useEffect(() => {
    if (!pending) return;
    startLoading();
    return () => stopLoading();
  }, [pending, startLoading, stopLoading]);

  return [pending, start];
}
