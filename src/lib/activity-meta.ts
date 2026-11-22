import type { ActivityKind } from "@/lib/types";

/**
 * Client-safe half of the activity module.
 *
 * Kept separate from lib/activity.ts because that file imports the server
 * Supabase client, and a "use client" component importing it drags
 * next/headers into the browser bundle and fails the build.
 */

/** What each kind is called, and the dot colour it gets on the trail. */
export const ACTIVITY_META: Record<ActivityKind, { label: string; tone: string }> = {
  call:  { label: "Call",  tone: "var(--color-accent)" },
  text:  { label: "Text",  tone: "var(--color-accent)" },
  email: { label: "Email", tone: "var(--color-warn)" },
  visit: { label: "Visit", tone: "var(--color-good)" },
  note:  { label: "Note",  tone: "var(--color-muted)" },
};

/**
 * Outcome shortcuts per kind. Deliberately plain strings rather than a
 * Settings list: an outcome is shorthand the dispatcher types once and reads
 * later, not a value anything filters or reports on.
 */
export const OUTCOME_SUGGESTIONS: Record<ActivityKind, string[]> = {
  call:  ["Spoke with POC", "Left voicemail", "No answer", "Asked to call back", "Wrong number"],
  text:  ["Sent text", "Replied", "No reply"],
  email: ["Sent email", "Replied", "Bounced"],
  // Restocking folded in here when it stopped being a kind of its own.
  visit: [
    "Dropped cards", "Met the manager", "Front desk only", "Nobody available",
    "Refilled the stack", "Stack was empty", "Stack was gone",
  ],
  note:  [],
};
