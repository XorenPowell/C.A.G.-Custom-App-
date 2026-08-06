import { NextResponse } from "next/server";

/**
 * Reports which commit is actually running.
 *
 * Public and unauthenticated on purpose — it answers "did my deploy land?"
 * without a login, which is the one question you cannot answer from inside a
 * gated app. Deliberately limited to the commit SHA, branch and environment;
 * no commit message, so nothing leaks if the repo is ever made private.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      environment: process.env.VERCEL_ENV ?? "development",
      region: process.env.VERCEL_REGION ?? null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
