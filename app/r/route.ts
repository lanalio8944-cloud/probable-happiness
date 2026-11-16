import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { consumeRedirectSession, getRedirectDestination } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const destination = getRedirectDestination();
  const session = request.cookies.get("redirect_session")?.value;

  if (!destination) {
    return new NextResponse("Redirect destination is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  try {
    const consumed = await consumeRedirectSession(session);

    if (!consumed) {
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    const response = NextResponse.redirect(destination, 302);
    response.cookies.set("redirect_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/r",
      maxAge: 0,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return new NextResponse("Redirect service is temporarily unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
