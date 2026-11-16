import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createRedirectSession,
  isSameOrigin,
  sessionCookieOptions,
} from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(1).max(8192) }).strict();

type RecaptchaResponse = {
  success?: boolean;
  hostname?: string;
  challenge_ts?: string;
  "error-codes"?: string[];
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Permintaan tidak valid." }, 403);

  const siteSecret = process.env.RECAPTCHA_SECRET_KEY;
  const allowedHostnames = (process.env.RECAPTCHA_ALLOWED_HOSTNAMES ?? "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

  if (!siteSecret || allowedHostnames.length === 0) {
    return json({ error: "Layanan CAPTCHA belum dikonfigurasi." }, 503);
  }
  if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    return json({ error: "Site Key reCAPTCHA belum dikonfigurasi." }, 503);
  }
  if (!process.env.SESSION_SECRET || Buffer.byteLength(process.env.SESSION_SECRET, "utf8") < 32) {
    return json({ error: "Secret sesi belum dikonfigurasi dengan benar." }, 503);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 12_000) return json({ error: "Permintaan terlalu besar." }, 413);

  try {
    const body = schema.safeParse(await request.json());
    if (!body.success) return json({ error: "Token CAPTCHA tidak valid." }, 400);

    const googleResponse = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: siteSecret, response: body.data.token }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!googleResponse.ok) return json({ error: "Layanan CAPTCHA sedang tidak tersedia." }, 503);

    const result = await googleResponse.json() as RecaptchaResponse;
    const valid = result.success === true &&
      typeof result.hostname === "string" &&
      allowedHostnames.includes(result.hostname.toLowerCase());

    if (!valid) return json({ error: "Verifikasi CAPTCHA gagal. Silakan coba lagi." }, 403);

    const response = NextResponse.json({ success: true }, {
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set("redirect_session", createRedirectSession(), sessionCookieOptions);
    return response;
  } catch {
    return json({ error: "Verifikasi CAPTCHA tidak dapat diselesaikan. Silakan coba lagi." }, 503);
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
