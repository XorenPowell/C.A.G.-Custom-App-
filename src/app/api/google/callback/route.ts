import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const settings = new URL("/settings/calendar", request.nextUrl.origin);
  const params = request.nextUrl.searchParams;

  const jar = await cookies();
  const expected = jar.get("google_oauth_state")?.value;
  jar.delete("google_oauth_state");

  if (params.get("error")) {
    settings.searchParams.set("error", params.get("error")!);
    return NextResponse.redirect(settings);
  }

  const state = params.get("state");
  if (!expected || state !== expected) {
    settings.searchParams.set("error", "state_mismatch");
    return NextResponse.redirect(settings);
  }

  const code = params.get("code");
  if (!code) {
    settings.searchParams.set("error", "missing_code");
    return NextResponse.redirect(settings);
  }

  const { error } = await exchangeCode(code);
  if (error) settings.searchParams.set("error", error);
  else settings.searchParams.set("connected", "1");

  return NextResponse.redirect(settings);
}
