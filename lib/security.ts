import "server-only";

import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

const MAX_ATTEMPTS = 5;
const CHALLENGE_TTL_SECONDS = 300;
const SESSION_TTL_SECONDS = 120;

export const CHALLENGE_COOKIE = "math_challenge";
export const SESSION_COOKIE = "redirect_session";

export type MathChallenge = {
  challengeId: string;
  question: string;
  expiresIn: number;
  token: string;
};

type ChallengePayload = {
  type: "challenge";
  id: string;
  a: number;
  b: number;
  attempts: number;
  exp: number;
};

type SessionPayload = {
  type: "redirect";
  exp: number;
  nonce: string;
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes");
  }
  return secret;
}

function signPayload(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function readSignedPayload<T>(token: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encoded, suppliedSignature] = parts;
  if (!encoded || !suppliedSignature || !/^[A-Za-z0-9_-]+$/.test(suppliedSignature)) return null;

  try {
    const expected = createHmac("sha256", getSecret()).update(encoded).digest();
    const supplied = Buffer.from(suppliedSignature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed as T : null;
  } catch {
    return null;
  }
}

export function createChallenge(): MathChallenge {
  const a = randomInt(1, 10);
  const b = randomInt(1, 10);
  const challengeId = randomUUID();
  const token = signPayload({
    type: "challenge",
    id: challengeId,
    a,
    b,
    attempts: 0,
    exp: Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS,
  } satisfies ChallengePayload);

  return { challengeId, question: `${a} + ${b}`, expiresIn: CHALLENGE_TTL_SECONDS, token };
}

export type ChallengeCheck =
  | { status: "invalid" | "expired" | "locked" }
  | { status: "incorrect"; attemptsLeft: number; updatedToken: string }
  | { status: "correct" };

export function checkChallenge(token: string, challengeId: string, answer: number): ChallengeCheck {
  const payload = readSignedPayload<ChallengePayload>(token);
  const now = Math.floor(Date.now() / 1000);

  if (
    !payload || payload.type !== "challenge" || typeof payload.id !== "string" ||
    !Number.isInteger(payload.a) || !Number.isInteger(payload.b) ||
    !Number.isInteger(payload.attempts) || !Number.isInteger(payload.exp) ||
    payload.id !== challengeId
  ) return { status: "invalid" };
  if (payload.exp <= now) return { status: "expired" };
  if (payload.attempts >= MAX_ATTEMPTS) return { status: "locked" };
  if (answer === payload.a + payload.b) return { status: "correct" };

  const attempts = payload.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) return { status: "locked" };

  return {
    status: "incorrect",
    attemptsLeft: MAX_ATTEMPTS - attempts,
    updatedToken: signPayload({ ...payload, attempts } satisfies ChallengePayload),
  };
}

export function createRedirectSession(): string {
  return signPayload({
    type: "redirect",
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    nonce: randomUUID(),
  } satisfies SessionPayload);
}

export function verifyRedirectSession(token: string): boolean {
  const payload = readSignedPayload<SessionPayload>(token);
  return Boolean(
    payload && payload.type === "redirect" && Number.isInteger(payload.exp) &&
    payload.exp > Math.floor(Date.now() / 1000) && typeof payload.nonce === "string",
  );
}

export function getRedirectDestination(): URL | null {
  const rawDestination = process.env.REDIRECT_DESTINATION;
  const allowedHosts = (process.env.REDIRECT_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  if (!rawDestination || allowedHosts.length === 0) return null;

  try {
    const destination = new URL(rawDestination);
    if (
      destination.protocol !== "https:" || destination.username || destination.password ||
      !allowedHosts.includes(destination.hostname.toLowerCase())
    ) return null;
    return destination;
  } catch {
    return null;
  }
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const configuredOrigin = process.env.APP_ORIGIN;
  if (!origin || !configuredOrigin) return false;

  try {
    return new URL(origin).origin === new URL(configuredOrigin).origin;
  } catch {
    return false;
  }
}

export const challengeCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api",
  maxAge: CHALLENGE_TTL_SECONDS,
};

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/r",
  maxAge: SESSION_TTL_SECONDS,
};

export const expiredChallengeCookieOptions = { ...challengeCookieOptions, maxAge: 0 };
export const expiredSessionCookieOptions = { ...sessionCookieOptions, maxAge: 0 };
