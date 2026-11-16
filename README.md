# Secure Math Redirect

A small Next.js App Router starter for a transparent, fixed-destination redirect gateway. Visitors see the destination hostname, solve an accessible addition question, and receive a short-lived signed cookie before continuing.

## Stack and deployment target

- Next.js 16 and React 19
- Node.js 26.x (`package.json`)
- Vercel Functions; no external database or Redis is used

## Local setup

1. Install Node.js 26.x and npm.
2. Copy `.env.example` to `.env.local` and set the values.
3. Generate a private session signing secret (for example: `openssl rand -base64 32`) and put it in `SESSION_SECRET`.
4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

5. Open `http://localhost:3000`.

`APP_ORIGIN` must exactly match the browser-facing origin, e.g. `http://localhost:3000` locally or `https://your-domain.vercel.app` in deployment.

## Environment variables

- `APP_ORIGIN`: exact public origin used for same-origin POST checks.
- `REDIRECT_DESTINATION`: one fixed HTTPS destination URL.
- `REDIRECT_ALLOWED_HOSTS`: comma-separated exact hostname allowlist. The destination's hostname must be listed.
- `SESSION_SECRET`: random secret of at least 32 bytes used to sign challenge and redirect cookies. Keep it private and do not use a `NEXT_PUBLIC_` prefix.

The app does not accept a destination URL from query parameters or form input. The destination hostname is displayed before verification.

## Security and limitations

- Addition questions use numbers 1–9 and expire after five minutes.
- A signed HttpOnly cookie tracks up to five wrong answers in the normal browser flow; no server-side database is used.
- A successful answer creates a signed HttpOnly, SameSite=Strict cookie valid for two minutes.
- The destination must use HTTPS and match an exact hostname allowlist.
- `robots` metadata asks compliant search engines not to index/follow this gateway. It is a request, not access control.

Because there is no shared persistent store, this is a lightweight **friction gate**, not strong bot protection: a determined client can request fresh questions, replay an earlier signed challenge/session until expiry, or automate addition. Cookies are signed to prevent editing, but stateless tokens cannot guarantee globally enforced attempt limits or true one-time session use. It also does not hide/protect the destination website itself: visitors and bots may access that destination directly. To protect actual website content, the origin/server hosting that site must enforce authentication or another access control before serving the content.

Vercel's Hobby plan is free for eligible personal use but has usage quotas; free hosting is not unlimited. Review current Vercel plan limits before deployment.

## Vercel deployment

1. Import the GitHub repository into Vercel and select the `feature/math-captcha-vercel` branch, or merge the branch into the production branch when ready.
2. Add `APP_ORIGIN`, `REDIRECT_DESTINATION`, `REDIRECT_ALLOWED_HOSTS`, and `SESSION_SECRET` in Vercel Project Settings → Environment Variables.
3. Set `APP_ORIGIN` separately for Preview and Production if the origins differ. Keep `SESSION_SECRET` private.
4. Deploy and test correct/incorrect answers, the fifth incorrect answer, expiry, and repeated access to `/r`.

Do not commit `.env.local` or real secrets.
