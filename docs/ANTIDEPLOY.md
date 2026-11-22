# Deployment guide: Antideploy, Vercel and Netlify

InfoCraft Web is a standard **Next.js 15 App Router** application. It can be deployed to Antideploy as a Node.js service, to Vercel with its built-in Next.js support, or to Netlify using Netlify's Next.js adapter.

## Shared project settings

- Node.js: **20.x** (Node.js 20.9+ recommended by the project)
- Package manager: npm
- Install command: `npm install` (there is currently no committed npm lockfile; use `npm ci` only after a lockfile is committed)
- Build command: `npm run build`
- Local production start: `npm run start`
- Health endpoint: `GET /api/health`

Do not set a static publish directory such as `out` or `.next` for these standard Next.js deployments. This app uses Next.js server/API functionality and is not configured as a static export.

## Environment variables

Configure these in each hosting provider's project/site environment settings:

Required Firebase web configuration:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Optional Firebase values:

- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`

Server-side AI secret:

- `GEMINI_API_KEY` — keep this server-side; never prefix it with `NEXT_PUBLIC_`.

Use the same Firebase project configuration across preview/production only if that is intentional. Add each deployed hostname to Firebase Authentication → Settings → Authorized domains, and enable the Google provider. Deploy and review `firestore.rules` before enabling cloud saves.

## Vercel

No custom `vercel.json` is required for this Next.js project. Import `NSKWeb/infocraft-web-` into Vercel and use:

| Setting | Value |
|---|---|
| Framework preset | Next.js (auto-detected) |
| Root directory | `./` |
| Install command | `npm install` (auto-detect is also fine) |
| Build command | `npm run build` |
| Output directory | Leave default / auto-detected |
| Node.js | 20.x |

Add the environment variables above under **Project → Settings → Environment Variables**. Add them to the environments where they are needed (Preview and Production, and Development if desired).

Deploy a Preview first. Verify the health endpoint and application workflows before promoting the deployment to Production.

## Netlify

The repository includes a `netlify.toml` with the Node.js version and build command. Import `NSKWeb/infocraft-web-` into Netlify and use:

| Setting | Value |
|---|---|
| Base directory | Leave blank (repository root) |
| Build command | `npm run build` |
| Publish directory | Leave blank / let the Next.js adapter manage it |
| Node.js | 20.x |

Netlify should detect the Next.js framework and use its maintained Next.js adapter. Do not override the publish directory with `.next` or `out`, and do not add a static export setting. If the site setup screen asks for a framework preset, choose **Next.js**.

Add environment variables under **Site configuration → Environment variables**. Trigger a fresh deploy after changing environment variables. Test a Deploy Preview before production.

## Antideploy

Use the Node.js service settings:

| Setting | Value |
|---|---|
| Runtime | Node.js 20 |
| Install | `npm install` (or `npm ci` after committing a lockfile) |
| Build | `npm run build` |
| Start | `npm run start` |
| Health check | `/api/health` |
| Port | Platform-provided `PORT` |

The start script binds to `0.0.0.0` and uses the platform's `PORT` value, falling back to 3000 for local runs.

## Post-deployment verification

1. Open `https://YOUR_HOSTNAME/api/health`; expect HTTP 200 and JSON containing `"status":"ok"`.
2. Load the home page and check browser/server logs for errors.
3. Test Google sign-in and sign-out.
4. Test Firestore save, list, load, and delete using an authenticated account.
5. Test Gemini-backed generation and the AI Art Director.
6. Test URL/PDF/image import and canvas exports.
7. Test poster generation separately; provider availability, quotas, and output dimensions depend on the configured model.
8. Verify preview and production hostnames are included in Firebase authorized domains.

A successful build and health response confirm only basic deployment health; they do not prove every third-party integration is configured correctly.

## Production security notes

- Keep `GEMINI_API_KEY` in server-only environment settings.
- Firebase web configuration is browser-visible by design; secure data with Authentication and Firestore Rules.
- Do not set `FIRESTORE_EMULATOR_HOST` in production.
- Before exposing URL import to public traffic, add connection-level DNS pinning or equivalent egress controls and production rate limiting. URL/IP checks and redirect restrictions alone are not a complete SSRF defense.
- Review upload limits, provider quotas, abuse controls, and Firestore rules before public launch.
- Never commit `.env.local` or provider credentials.
