# Secure Math Redirect

A small Next.js App Router starter for a transparent, fixed-destination redirect gateway. Visitors see the destination hostname, solve an accessible addition question, and receive a short-lived, one-use redirect session after server-side verification.

## Stack and deployment target

- Next.js 16 and React 19
- Node.js 26.x (configured in `package.json`; supported by the current Vercel Node.js runtime documentation)
- Vercel Functions with Upstash Redis for server-side challenge state, attempt limits, rate limits, and one-use sessions

## Local setup

1. Install Node.js 26.x and npm.
2. Copy `.env.example` to `.env.local` and set each value.
3. Create an Upstash Redis database and fill in its REST URL and token.
4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

5. Open `http://localhost:3000`.

`APP_ORIGIN` must exactly match the browser-facing origin, e.g. `http://localhost:3000` for local development. In Vercel, set it to the deployed custom domain origin, e.g. `https://redirect.example.com`.

## Environment variables

- `APP_ORIGIN`: exact public origin used for same-origin POST checks.
- `REDIRECT_DESTINATION`: one fixed HTTPS destination URL.
- `REDIRECT_ALLOWED_HOSTS`: comma-separated exact hostname allowlist. The destination's hostname must be listed.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: server-only Upstash credentials. Never expose these with a `NEXT_PUBLIC_` prefix.

The app does not accept a destination URL from query parameters or form input. The destination host is displayed before verification.

## Security behavior

- Addition questions use numbers 1–9 and expire after five minutes.
- Each question allows up to five answers; answer checking and attempt increments are atomic in Redis.
- Per-IP request limits protect challenge creation and verification.
- A successful answer creates a random HttpOnly, SameSite=Strict cookie. The matching Redis session expires after two minutes and is atomically consumed on redirect, so it cannot be reused.
- The destination must use HTTPS and match an exact hostname allowlist.
- The `x-forwarded-for` address is used for rate limiting. Vercel provides this through its proxy; on another host, ensure a trusted proxy overwrites the header.

A simple arithmetic question is an accessibility-oriented friction measure, not strong bot protection. It can be automated; rate limits and one-use sessions reduce abuse but do not prevent it completely. Do not use this as a substitute for protecting the destination itself.

## Vercel deployment

1. Import the GitHub repository into Vercel and select the `feature/math-captcha-vercel` branch, or merge the branch into the production branch when ready.
2. Add the environment variables above in Vercel Project Settings. Add them for the required environments (Preview and Production) with the appropriate origin and destination.
3. Deploy. Vercel detects Next.js automatically. Confirm Node.js 26.x in Project Settings if the project setting does not follow `engines.node`.
4. Test correct and incorrect answers, the fifth failed answer, expired questions, repeated use of `/r`, and rate limiting on the deployed site.

Do not commit `.env.local` or real Redis credentials.
