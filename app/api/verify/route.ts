import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CHALLENGE_COOKIE,
  SESSION_COOKIE,
  checkChallenge,
  createRedirectSession,
  expiredChallengeCookieOptions,
  isSameOrigin,
  sessionCookieOptions,
} from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  challengeId: z.string().uuid(),
  answer: z.string().regex(/^\d{1,2}$/),
}).strict();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Permintaan tidak valid." }, 403);
  if (!request.headers.get("cookie")?.includes(`${CHALLENGE_COOKIE}=`)) {
    return json({ error: "Soal kedaluwarsa. Silakan minta soal baru.", code: "expired" }, 410);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 2048) return json({ error: "Permintaan terlalu besar." }, 413);

  try {
    const body = schema.safeParse(await request.json());
    if (!body.success) return json({ error: "Masukkan jawaban angka yang valid." }, 400);

    const token = getCookie(request.headers.get("cookie") ?? "", CHALLENGE_COOKIE);
    if (!token) return json({ error: "Soal kedaluwarsa. Silakan minta soal baru.", code: "expired" }, 410);

    const result = checkChallenge(token, body.data.challengeId, Number(body.data.answer));
    if (result.status === "expired" || result.status === "invalid") {
      const response = json({ error: "Soal kedaluwarsa. Silakan minta soal baru.", code: "expired" }, 410);
      response.cookies.set(CHALLENGE_COOKIE, "", expiredChallengeCookieOptions);
      return response;
    }
    if (result.status === "locked") {
      const response = json({ error: "Batas percobaan soal habis. Silakan minta soal baru.", code: "locked" }, 429);
      response.cookies.set(CHALLENGE_COOKIE, "", expiredChallengeCookieOptions);
      return response;
    }
    if (result.status === "incorrect") {
      const response = json({
        error: `Jawaban belum tepat. Sisa percobaan: ${result.attemptsLeft}.`,
        code: "incorrect",
        attemptsLeft: result.attemptsLeft,
      }, 400);
      response.cookies.set(CHALLENGE_COOKIE, result.updatedToken, challengeCookieOptions);
      return response;
    }

    const response = NextResponse.json({ success: true }, {
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set(CHALLENGE_COOKIE, "", expiredChallengeCookieOptions);
    response.cookies.set(SESSION_COOKIE, createRedirectSession(), sessionCookieOptions);
    return response;
  } catch {
    return json({ error: "Verifikasi sementara tidak tersedia. Coba lagi." }, 503);
  }
}

function getCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
