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
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID for Poster Studio image generation.
- `CLOUDFLARE_API_TOKEN` — server-side API token with Workers AI permissions; used only by Poster Studio. No paid-provider fallback is configured.
- `UPSTASH_REDIS_REST_URL` — Upstash Redis REST database URL for shared API rate-limit counters.
- `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST token; keep it secret and server-side.

**Production rate limiting:** configure both Upstash variables on every deployment target. Production API routes fail closed with HTTP 503 if Redis is missing or unavailable; local development uses a per-process in-memory fallback. Do not rely on the local fallback for production or multi-instance deployments. The limiter uses separate per-IP fixed windows for AI and import endpoints.

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

## Universal Linux VPS deployment

This is the provider-independent deployment path for a self-managed VPS. It suits common Ubuntu/Debian servers and other Linux distributions that can run the project's supported Node.js version.

### 1. Prepare the server

- Linux VPS with a supported 64-bit OS (Ubuntu 22.04/24.04 or Debian are common choices).
- Node.js **20.x (20.9+)**, npm, Git, and Nginx.
- A domain name pointed to the VPS public IP.
- Enough memory and disk for a Next.js production build; build memory needs vary with the server and dependency tree.

Create a dedicated non-root application user and a persistent app directory such as `/var/www/infocraft-web`. Install Node.js 20 using a trusted Node.js distribution/package source appropriate for your OS. Do not expose the app process directly to the public internet.

### 2. Fetch and build the application

Run as the dedicated application user:

```bash
sudo mkdir -p /var/www/infocraft-web
sudo chown -R infocraft:infocraft /var/www/infocraft-web
sudo -u infocraft git clone https://github.com/NSKWeb/infocraft-web-.git /var/www/infocraft-web
cd /var/www/infocraft-web
npm install
npm run build
```

For a private repository, configure secure Git authentication on the server; do not embed a personal access token in the clone URL or shell history. There is currently no committed npm lockfile, so use `npm install`. Once a lockfile is committed, prefer `npm ci` for repeatable deployments.

### 3. Configure production secrets

Create a protected environment file outside the repository, for example `/etc/infocraft-web.env`:

```env
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
GEMINI_API_KEY=...
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
```

Set only the optional Firebase values you use. Keep `GEMINI_API_KEY` server-side. Restrict access to the file (for example, owner root and group-readable only by the app service group). Never commit it.

### 4. Run with systemd

Create `/etc/systemd/system/infocraft-web.service`:

```ini
[Unit]
Description=InfoCraft Web Next.js application
After=network.target

[Service]
Type=simple
User=infocraft
Group=infocraft
WorkingDirectory=/var/www/infocraft-web
EnvironmentFile=/etc/infocraft-web.env
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Confirm the actual npm executable path with `command -v npm` and adjust `ExecStart` if it differs. Then enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now infocraft-web
sudo systemctl status infocraft-web
```

The existing start script binds Next.js to `0.0.0.0` and uses the `PORT` environment variable. Keep port 3000 private to the VPS; Nginx will be the public entry point.

### 5. Configure Nginx reverse proxy

Create an Nginx site for your domain and proxy to the local Next.js process:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN www.YOUR_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Replace `YOUR_DOMAIN` with the real hostname, enable the site using your distribution's Nginx layout, validate with `sudo nginx -t`, and reload Nginx.

### 6. DNS, firewall and HTTPS

- Point the domain's A record to the VPS IPv4 address; configure AAAA only if IPv6 is working end to end.
- Allow SSH and inbound TCP 80/443 in the VPS/provider firewall.
- Do not expose port 3000 publicly.
- Issue and renew TLS certificates using Certbot/Let's Encrypt or another trusted certificate manager. Configure HTTPS redirection after the certificate is installed.

### 7. Verify and maintain

- Check `sudo systemctl status infocraft-web` and `sudo journalctl -u infocraft-web -n 100 --no-pager`.
- Check `https://YOUR_DOMAIN/api/health` for HTTP 200 and `"status":"ok"`.
- Test Google sign-in, Firestore save/load/delete, Gemini generation, imports, and exports.
- For an update: fetch the intended Git commit, install dependencies, run `npm run build`, then restart with `sudo systemctl restart infocraft-web`. Use a maintenance window or a tested release strategy if downtime is unacceptable.

A healthy process and health endpoint do not prove that Firebase/Gemini credentials, Firestore rules, quotas, or all user workflows are correct. Back up the environment file and any operational data/configuration before upgrades.

## Post-deployment verification

1. Open `https://YOUR_HOSTNAME/api/health`; expect HTTP 200 and JSON containing `"status":"ok"`.
2. Load the home page and check browser/server logs for errors.
3. Test Google sign-in and sign-out.
4. Test Firestore save, list, load, and delete using an authenticated account.
5. Test Gemini-backed generation and the AI Art Director.
6. Test URL/PDF/image import and canvas exports.
7. Test Poster Studio separately using Cloudflare Workers AI (`@cf/black-forest-labs/flux-1-schnell`). Configure `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`; generation stops with a clear quota message when the free daily allocation/rate limit is reached. There is no paid fallback. The model returns a generated image rather than a guaranteed 1K/2K/4K native output.
8. Verify preview and production hostnames are included in Firebase authorized domains.

A successful build and health response confirm only basic deployment health; they do not prove every third-party integration is configured correctly.

## Production security notes

- Keep `GEMINI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN` in server-only environment settings. Cloudflare credentials are used only for Poster Studio.
- Firebase web configuration is browser-visible by design; secure data with Authentication and Firestore Rules.
- Do not set `FIRESTORE_EMULATOR_HOST` in production.
- Before exposing URL import to public traffic, add connection-level DNS pinning or equivalent egress controls and production rate limiting. URL/IP checks and redirect restrictions alone are not a complete SSRF defense.
- Review upload limits, provider quotas, abuse controls, and Firestore rules before public launch.
- Never commit `.env.local` or provider credentials.
