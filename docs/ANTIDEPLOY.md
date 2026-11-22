# Antideploy deployment guide

## Runtime

- Runtime: Node.js 20
- Install: `npm ci` (or `npm install` after package-lock generation)
- Build: `npm run build`
- Start: `npm run start`
- Health route: `GET /api/health`
- Port: set by Antideploy's `PORT` environment variable; defaults to 3000 for local runs.

## Required Firebase web configuration

Set these values from the Firebase Console → Project settings → General → Your apps → Web app:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Optional public config values: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`.

These Firebase web configuration values are public client configuration, not server secrets. Configure Firebase Auth authorized domains for the Antideploy hostname.

## Server-side secrets

`GEMINI_API_KEY` is reserved for a server-side AI route if direct provider access is selected. It is not read by browser code and must not be prefixed with `NEXT_PUBLIC_`.

## Firestore emulator

Do not configure `FIRESTORE_EMULATOR_HOST` in production. It is only for a local emulator process reachable from the same host/container.

## Production readiness checklist

- Configure Firebase Authentication providers and authorized domains.
- Review and deploy Firestore rules that match the web data model.
- Configure AI model access, quotas and regional availability.
- Verify that image uploads are size-limited and validated.
- Test `/api/health`, sign-in, generation, save/load, export and logout.
- Confirm no secret is present in the client bundle or Git history.
- Validate a deploy preview before enabling automatic production deploys.
