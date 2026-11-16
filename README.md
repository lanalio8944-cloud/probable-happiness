# Secure Redirect Gateway

A Next.js App Router gateway that verifies visitors with Google reCAPTCHA v2 Checkbox before showing a continue button to a single fixed external destination.

## Stack

- Next.js 16 and React 19
- Node.js 26.x (`package.json`)
- Google reCAPTCHA v2 Checkbox
- Signed server-side session cookie for the redirect gate

## Environment variables

Set these in `.env.local` for local development and in Vercel Project Settings → Environment Variables for deployment:

- `APP_ORIGIN`: exact public app origin, without a trailing slash (for example `http://localhost:3000` locally or `https://your-app.vercel.app` in deployment).
- `REDIRECT_DESTINATION`: fixed HTTPS destination URL.
- `REDIRECT_ALLOWED_HOSTS`: comma-separated exact hostnames allowed for that destination, without scheme or path.
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`: public site key for a Google reCAPTCHA v2 Checkbox key.
- `RECAPTCHA_SECRET_KEY`: private secret for that same reCAPTCHA key. Never prefix it with `NEXT_PUBLIC_` or commit it.
- `RECAPTCHA_ALLOWED_HOSTNAMES`: comma-separated hostnames registered for the CAPTCHA key, e.g. `your-app.vercel.app,localhost`.
- `SESSION_SECRET`: private random value with at least 32 bytes, used to sign the redirect cookie. Generate one with `openssl rand -base64 32`; do not commit it or use a `NEXT_PUBLIC_` prefix.

Example (replace every example value):

```dotenv
APP_ORIGIN=http://localhost:3000
REDIRECT_DESTINATION=https://destination.example.com
REDIRECT_ALLOWED_HOSTS=destination.example.com
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_public_site_key
RECAPTCHA_SECRET_KEY=your_private_secret_key
RECAPTCHA_ALLOWED_HOSTNAMES=localhost
SESSION_SECRET=replace-with-a-private-random-secret-at-least-32-bytes
```

Register each deployed hostname in the Google reCAPTCHA admin console. The hostname returned by Google's verification must exactly match one item in `RECAPTCHA_ALLOWED_HOSTNAMES`. Use the correct `APP_ORIGIN` for each Vercel environment; Preview URLs may vary, so configure stable preview hostnames or test with the production domain.

## Flow

1. The browser loads Google's checkbox widget.
2. The browser sends the response token to `/api/verify`.
3. The server verifies that token directly with Google and checks the returned hostname against the allowlist.
4. Only after successful verification does the server set a short-lived HttpOnly session cookie and the UI show the continue button.
5. The button opens `/r`, which checks the signed session and redirects to the server-configured destination.

The app never accepts a destination from user input or query parameters. The destination hostname is displayed before verification and must use HTTPS and match the exact allowlist.

This is a lightweight anti-bot gate, not a full access control system for the destination website itself. A visitor or bot may still reach the destination directly. If the destination's actual content must not be public, the destination server must enforce its own authentication or access control.

## Local and Vercel setup

1. Create a Google reCAPTCHA v2 Checkbox key and register the local/deployed hostnames.
2. Fill all variables above; generate the session secret locally.
3. Run `npm install` and `npm run dev`, then test the checkbox and continue button.
4. Import this repository/branch into Vercel, add all variables for Preview and Production as appropriate, and deploy.
5. Never commit `.env.local` or real secrets.
