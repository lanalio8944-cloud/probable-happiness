import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CHALLENGE_COOKIE,
  challengeCookieOptions,
  createChallenge,
  isSameOrigin,
} from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({}).strict();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Permintaan tidak valid." }, 403);

  try {
    const body = await request.json();
    if (!schema.safeParse(body).success) return json({ error: "Permintaan tidak valid." }, 400);

    const challenge = createChallenge();
    const response = json({
      challengeId: challenge.challengeId,
      question: challenge.question,
      expiresIn: challenge.expiresIn,
    }, 200);
    response.cookies.set(CHALLENGE_COOKIE, challenge.token, challengeCookieOptions);
    return response;
  } catch {
    return json({ error: "Soal tidak dapat dibuat saat ini." }, 503);
  }
}

export async function GET() {
  return json({ error: "Metode tidak diizinkan." }, 405, { Allow: "POST" });
}

function json(body: unknown, status: number, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}
