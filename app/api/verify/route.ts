import { NextResponse } from "next/server";
import { z } from "zod";

import {
  checkRateLimit,
  createRedirectSession,
  getClientIp,
  getRedis,
  getRedirectDestination,
  verifyChallengeAnswer,
} from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  challengeId: z.string().uuid(),
  answer: z.string().regex(/^\d{1,2}$/),
}).strict();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return json({ error: "Permintaan tidak valid." }, 403);
  }

  const destination = getRedirectDestination();
  if (!destination) {
    return json({ error: "Tujuan redirect belum dikonfigurasi." }, 503);
  }

  const ip = getClientIp(request);
  if (!ip) {
    return json({ error: "Sumber permintaan tidak dapat diverifikasi." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 2048) {
    return json({ error: "Permintaan terlalu besar." }, 413);
  }

  try {
    const body = schema.safeParse(await request.json());
    if (!body.success) {
      return json({ error: "Masukkan jawaban angka yang valid." }, 400);
    }

    const redis = getRedis();
    const limit = await checkRateLimit(redis, "verify", ip, 10, "10 m");
    if (!limit.success) {
      return json({ error: "Terlalu banyak percobaan. Silakan coba lagi nanti." }, 429);
    }

    const result = await verifyChallengeAnswer(
      redis,
      body.data.challengeId,
      Number(body.data.answer),
    );

    if (result.status === "expired") {
      return json({ error: "Soal kedaluwarsa. Silakan minta soal baru.", code: "expired" }, 410);
    }
    if (result.status === "locked") {
      return json({ error: "Batas percobaan untuk soal ini habis. Silakan minta soal baru.", code: "locked" }, 429);
    }
    if (result.status === "incorrect") {
      return json({
        error: `Jawaban belum tepat. Coba lagi. Sisa percobaan: ${result.attemptsLeft}.`,
        code: "incorrect",
        attemptsLeft: result.attemptsLeft,
      }, 400);
    }

    const token = await createRedirectSession(redis);
    const response = NextResponse.json({ success: true }, {
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set("redirect_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/r",
      maxAge: 120,
    });
    return response;
  } catch {
    return json({ error: "Verifikasi sementara tidak tersedia. Coba lagi." }, 503);
  }
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const configuredOrigin = process.env.APP_ORIGIN;
  if (!origin || !configuredOrigin) return false;

  try {
    return new URL(origin).origin === new URL(configuredOrigin).origin;
  } catch {
    return false;
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
