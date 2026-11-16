import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  SESSION_COOKIE,
  expiredSessionCookieOptions,
  getRedirectDestination,
  verifyRedirectSession,
} from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const destination = getRedirectDestination();
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const denied = () => {
    const response = NextResponse.redirect(new URL("/", request.url), 303);
    response.cookies.set(SESSION_COOKIE, "", expiredSessionCookieOptions);
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  if (!destination) {
    return new NextResponse("Redirect destination is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!session || !verifyRedirectSession(session)) return denied();

  const response = NextResponse.redirect(destination, 302);
  response.cookies.set(SESSION_COOKIE, "", expiredSessionCookieOptions);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
