import { NextResponse } from "next/server";
import { z } from "zod";

import {
  checkRateLimit,
  createChallenge,
  getClientIp,
  getRedis,
} from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({}).strict();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return json({ error: "Permintaan tidak valid." }, 403);
  }

  const ip = getClientIp(request);
  if (!ip) {
    return json({ error: "Sumber permintaan tidak dapat diverifikasi." }, 403);
  }

  try {
    const body = await request.json();
    if (!schema.safeParse(body).success) {
      return json({ error: "Permintaan tidak valid." }, 400);
    }

    const redis = getRedis();
    const limit = await checkRateLimit(redis, "challenge", ip, 20, "10 m");
    if (!limit.success) {
      return json({ error: "Terlalu banyak permintaan. Silakan coba lagi nanti." }, 429);
    }

    const challenge = await createChallenge(redis);
    return json(challenge, 200);
  } catch {
    return json({ error: "Layanan soal sedang tidak tersedia." }, 503);
  }
}

export async function GET() {
  return json({ error: "Metode tidak diizinkan." }, 405, { Allow: "POST" });
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

function json(body: unknown, status: number, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}
