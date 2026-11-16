import { randomInt, randomBytes, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const MAX_ATTEMPTS = 5;
const CHALLENGE_TTL_SECONDS = 300;
const SESSION_TTL_SECONDS = 120;

let redisInstance: Redis | undefined;
const limiters = new Map<string, Ratelimit>();

export type MathChallenge = {
  challengeId: string;
  question: string;
  expiresIn: number;
};

export function getRedis(): Redis {
  if (redisInstance) return redisInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Upstash Redis is not configured");

  redisInstance = new Redis({ url, token });
  return redisInstance;
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
      destination.protocol !== "https:" ||
      destination.username ||
      destination.password ||
      !allowedHosts.includes(destination.hostname.toLowerCase())
    ) {
      return null;
    }
    return destination;
  } catch {
    return null;
  }
}

export function getClientIp(request: Request): string | null {
  // On Vercel, x-forwarded-for is supplied by the platform proxy. If hosting
  // elsewhere, configure a trusted proxy that overwrites this header.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const candidate = forwarded || realIp;
  return candidate && isIP(candidate) ? candidate : null;
}

export async function checkRateLimit(
  redis: Redis,
  scope: string,
  identity: string,
  count: number,
  window: `${number} m`,
): Promise<{ success: boolean }> {
  const key = `${scope}:${count}:${window}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(count, window),
      prefix: `math-redirect:${scope}`,
    });
    limiters.set(key, limiter);
  }
  return limiter.limit(identity);
}

export async function createChallenge(redis: Redis): Promise<MathChallenge> {
  const first = randomInt(1, 10);
  const second = randomInt(1, 10);
  const challengeId = randomUUID();
  await redis.set(
    `math-challenge:${challengeId}`,
    JSON.stringify({ answer: first + second, attempts: 0 }),
    { ex: CHALLENGE_TTL_SECONDS },
  );

  return {
    challengeId,
    question: `${first} + ${second}`,
    expiresIn: CHALLENGE_TTL_SECONDS,
  };
}

const VERIFY_CHALLENGE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return cjson.encode({ status = 'expired', attemptsLeft = 0 })
end
local challenge = cjson.decode(raw)
local attempts = tonumber(challenge.attempts) or 0
if attempts >= tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1])
  return cjson.encode({ status = 'locked', attemptsLeft = 0 })
end
attempts = attempts + 1
if tonumber(ARGV[1]) == tonumber(challenge.answer) then
  redis.call('DEL', KEYS[1])
  return cjson.encode({ status = 'correct', attemptsLeft = tonumber(ARGV[2]) - attempts })
end
if attempts >= tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1])
  return cjson.encode({ status = 'locked', attemptsLeft = 0 })
end
local ttl = redis.call('TTL', KEYS[1])
redis.call('SET', KEYS[1], cjson.encode({ answer = challenge.answer, attempts = attempts }), 'EX', ttl)
return cjson.encode({ status = 'incorrect', attemptsLeft = tonumber(ARGV[2]) - attempts })
`;

type ChallengeResult = {
  status: "expired" | "locked" | "incorrect" | "correct";
  attemptsLeft: number;
};

export async function verifyChallengeAnswer(
  redis: Redis,
  challengeId: string,
  answer: number,
): Promise<ChallengeResult> {
  const raw = await redis.eval<string>(
    VERIFY_CHALLENGE_SCRIPT,
    [`math-challenge:${challengeId}`],
    [answer, MAX_ATTEMPTS],
  );
  return typeof raw === "string" ? JSON.parse(raw) as ChallengeResult : raw as ChallengeResult;
}

export async function createRedirectSession(redis: Redis): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const created = await redis.set(`redirect-session:${token}`, "1", {
    ex: SESSION_TTL_SECONDS,
    nx: true,
  });
  if (created !== "OK") throw new Error("Could not create redirect session");
  return token;
}

const CONSUME_SESSION_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if value then redis.call('DEL', KEYS[1]) end
return value
`;

export async function consumeRedirectSession(token: string): Promise<boolean> {
  const redis = getRedis();
  const value = await redis.eval<string>(
    CONSUME_SESSION_SCRIPT,
    [`redirect-session:${token}`],
    [],
  );
  return value === "1";
}
