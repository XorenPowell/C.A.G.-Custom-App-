import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { consentUrl, googleConfigured } from "@/lib/google-calendar";

/** Kicks off the one-time OAuth consent flow. Reachable only when signed in. */
export async function GET() {
  if (!googleConfigured()) {
    return NextResponse.redirect(
      new URL("/settings/calendar?error=not_configured", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    );
  }

  // CSRF guard: the state we send must come back on the callback.
  const state = crypto.randomUUID();
  const jar = await cookies();
  jar.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(consentUrl(state));
}
