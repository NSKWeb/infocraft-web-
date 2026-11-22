# InfoCraft Web

<p align="center">
  <strong>Turn information into visual stories.</strong><br/>
  A web-based editorial infographic studio, designed around clarity, structure, and a Swiss-inspired visual system.
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black?logo=next.js"/>
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca?logo=react"/>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript"/>
  <img alt="Node" src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js"/>
  <img alt="Status" src="https://img.shields.io/badge/status-active%20development-orange"/>
</p>

**InfoCraft Web** is a separate web implementation inspired by the InfoCraft product. It lives in its own repository and does not replace or modify the original `NSKWeb/infocraft-` project.

> **Project status:** Early development / functional UI foundation. The studio interface, editable infographic preview, local session library, PNG export path, health endpoint and AI API route are present. Several integrations and production workflows are not yet implemented. See [Feature status](#feature-status) before treating this as production-ready.

---

## Contents

- [Product vision](#product-vision)
- [Interface overview](#interface-overview)
- [Feature status](#feature-status)
- [Technology stack](#technology-stack)
- [Repository structure](#repository-structure)
- [Run locally](#run-locally)
- [Environment configuration](#environment-configuration)
- [AI generation API](#ai-generation-api)
- [Antideploy deployment](#antideploy-deployment)
- [GitHub Actions](#github-actions)
- [Security and privacy](#security-and-privacy)
- [Troubleshooting](#troubleshooting)
- [Development roadmap](#development-roadmap)
- [Contributing](#contributing)

---

## Product vision

InfoCraft is being shaped as a focused workspace for turning dense information into clear, polished infographic compositions.

The design direction is:

- **Editorial, not cluttered:** strong typography, intentional whitespace and clear information hierarchy.
- **Image-first output:** portrait-oriented visual compositions suited to sharing and publishing.
- **Dark by default:** a dark studio interface with a warm editorial canvas; a light interface option is included.
- **Responsive:** the workspace adapts to desktop and mobile screen sizes.
- **Reviewable:** generated content should remain editable, and factual claims should be checked against their source before publication.

The long-term product direction includes text-to-infographic creation, photo understanding, assisted editing, poster generation, project management and optional research grounding. Not every planned capability is available yet.

## Interface overview

The current workspace is organized into five destinations:

| Area | Purpose | Current behavior |
|---|---|---|
| **Create** | Start with source text or a selected image | Text input, sample prompts and a local structured-draft fallback. Image selection is currently a UI placeholder. |
| **Canvas** | Refine the infographic | Edit headline, subtitle and hero metric; select a layout and color palette; preview the composition. |
| **Poster Studio** | Prepare poster output | Interface foundation; full image-generation workflow is not connected. |
| **AI Art Director** | Get help shaping the story | Conversation UI with static guidance; live AI conversation is not connected. |
| **Library** | Revisit saved work | In-memory browser-session list; not persistent cloud storage. |

### Visual system

**Layouts**
- KPI Stack
- Process Flow
- Comparison
- Editorial Digest

**Color palettes**
- Swiss Vermilion
- Cobalt Blueprint
- Charcoal Press
- Forest Ochre

**Canvas format**
- Portrait preview: 1080 × 1350
- Editable title, subtitle and hero metric
- Section-based editorial hierarchy
- PNG export action

The current preview is a front-end composition. Do not assume every layout selection changes the underlying information structure in a specialized way yet.

## Feature status

This table intentionally separates working interface behavior from planned integrations.

| Capability | Status | Notes |
|---|---|---|
| Responsive studio shell | Implemented | Desktop and mobile layouts |
| Dark / light appearance | Implemented | Dark is the default |
| Text input and starter examples | Implemented | Local UI |
| Local structured draft | Implemented | Deterministic fallback; not AI-generated |
| Editable canvas fields | Implemented | Headline, subtitle and hero metric |
| Template and palette selection | Implemented | Visual selection controls |
| Browser-session Library | Implemented | State is not persisted across reloads |
| PNG export | Implemented | Verify output on target browsers before production |
| Health endpoint | Implemented | Reports application process health only |
| Gemini server route | Present, requires verification | Configure key and test end-to-end; the current Create UI uses its local fallback |
| Firebase initialization helper | Present | Not yet wired into authentication or cloud persistence |
| Firebase Authentication | Planned | Not implemented in the current UI |
| Firestore project persistence | Planned | Not implemented |
| Photo-to-infographic understanding | Planned | Image upload currently selects a file only |
| Live AI Art Director | Planned | Current replies are static guidance |
| AI poster/image generation | Planned | Controls and workflow are not fully connected |
| Google Search grounding and citations | Planned | No live grounding flow currently |
| User accounts and cross-device sync | Planned | Requires Firebase integration and security rules |

A successful build or healthy HTTP response does **not** verify the integrations marked present or planned.

## Technology stack

| Layer | Technology |
|---|---|
| Web framework | Next.js 15 App Router |
| UI | React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 tooling + component-level CSS |
| Icons | Lucide React |
| Validation | Zod |
| AI provider package | Google Generative AI SDK |
| Client backend foundation | Firebase Web SDK |
| Hosting target | Antideploy / Node.js runtime |
| CI | GitHub Actions |

## Repository structure

```text
infocraft-web/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Typecheck, lint and build workflow
├── docs/
│   └── ANTIDEPLOY.md              # Hosting and environment notes
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   │   └── infographic/
│   │   │   │       └── route.ts   # Server-side infographic API
│   │   │   └── health/
│   │   │       └── route.ts       # Health endpoint
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── studio.tsx             # Main client-side studio
│   │   └── studio.css             # Responsive studio design
│   └── lib/
│       ├── firebase.ts            # Safe Firebase initialization helper
│       ├── infographic-schema.ts  # Zod response validation
│       └── types.ts               # Shared project and design types
├── .env.example
├── .gitignore
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── README.md
```

## Run locally

### Requirements

- Node.js 20.9 or newer (Node 20 LTS recommended)
- npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/NSKWeb/infocraft-web-.git
cd infocraft-web-
```

### 2. Install dependencies

```bash
npm install
```

The repository currently does not include a committed npm lockfile. Use `npm install` to resolve dependencies and generate `package-lock.json`. For repeatable CI and deployments, commit the generated lockfile and then prefer `npm ci`.

### 3. Configure environment

```bash
cp .env.example .env.local
```

Add the values required for the integrations you intend to test. The local UI fallback can be explored without Firebase credentials.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Validate before pushing

```bash
npm run typecheck
npm run lint
npm run build
```

Start the production build locally:

```bash
npm run start
```

---

## Environment configuration

Copy `.env.example` to `.env.local`. Never commit `.env.local`.

| Variable | Required for | Exposure | Description |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web app | Browser-visible | Firebase web app API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase web app | Browser-visible | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase web app | Browser-visible | Firebase project identifier |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web app | Browser-visible | Firebase app identifier |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Optional Firebase Storage | Browser-visible | Storage bucket name |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Optional Firebase Messaging | Browser-visible | Sender identifier |
| `GEMINI_API_KEY` | Server-side Gemini route | **Server secret** | Google AI provider key; never prefix with `NEXT_PUBLIC_` |
| `PORT` | Hosting runtime | Server runtime | Port supplied by Antideploy; defaults to 3000 in the start command |

Firebase web configuration is designed to be used by browser applications; it is not a substitute for Firebase Authentication, Firestore Security Rules or App Check. Protect user data with correct server-side and database authorization.

### Firebase setup (when integration is implemented)

1. Create or select a Firebase project.
2. Register a Web App in Project settings.
3. Copy its web configuration into the matching environment variables.
4. Configure the Authentication providers you intend to support.
5. Add the deployed hostname to Firebase Authentication's authorized domains.
6. Design and deploy Firestore rules before storing user projects.

Firebase initialization currently exists as a helper only; the current UI does not yet provide sign-in or Firestore-backed saving.

---

## AI generation API

A server-side route is present at:

`POST /api/ai/infographic`

It is intended to accept a JSON request containing:

```json
{
  "sourceText": "Source material to turn into an infographic",
  "model": "gemini-2.5-flash",
  "template": "DIGEST"
}
```

Supported model identifiers in the route:
- `gemini-2.5-flash`
- `gemini-2.5-pro`

Supported template identifiers:
- `KPI_STACK`
- `PROCESS_FLOW`
- `COMPARISON`
- `DIGEST`

The route checks source length, restricts the model selection, requests JSON output and validates the response with the Zod schema in `src/lib/infographic-schema.ts`.

**Integration caveat:** the current Create screen still uses its deterministic local draft path; it does not call this API route. Treat the API as an integration foundation until it is wired to the UI and tested with a valid provider key, model availability, error handling and real sample inputs. The route's error detail is intended for diagnostics; review logging and error disclosure before production.

### Example request

```bash
curl -X POST http://localhost:3000/api/ai/infographic \
  -H "Content-Type: application/json" \
  -d '{
    "sourceText": "A sufficiently detailed source text describing a topic, its evidence and key findings.",
    "model": "gemini-2.5-flash",
    "template": "DIGEST"
  }'
```

### Health check

`GET /api/health`

Example response:

```json
{
  "status": "ok",
  "service": "infocraft-web"
}
```

This endpoint confirms that the Next.js process can respond. It does not test Firebase, Gemini, database connectivity or other external services.

---

## Antideploy deployment

The project is intended to run as a standard Node.js Next.js application.

| Setting | Value |
|---|---|
| Runtime | Node.js 20 |
| Install command | `npm install` (use `npm ci` after committing a lockfile) |
| Build command | `npm run build` |
| Start command | `npm run start` |
| Health-check path | `/api/health` |
| Port | Use the platform-provided `PORT` |

The start script binds Next.js to `0.0.0.0` and uses the injected `PORT` value, falling back to 3000 for local execution.

### Deployment checklist

1. Connect the **`NSKWeb/infocraft-web-`** repository, not the original Android/source repository.
2. Select the `main` branch.
3. Select the Node.js runtime and the commands above.
4. Add only the environment variables needed by the features being tested.
5. Do not set `FIRESTORE_EMULATOR_HOST` in production.
6. Deploy and inspect the build output.
7. Open `/api/health` on the deployed hostname.
8. Test the actual UI and any configured external integrations separately.

Detailed notes: [docs/ANTIDEPLOY.md](docs/ANTIDEPLOY.md).

> Antideploy compatibility is a deployment target, not a guarantee of error-free hosting. A successful deployment must still be verified in the target environment.

---

## GitHub Actions

The workflow at `.github/workflows/ci.yml` runs on pushes to `main`, `staging` and `feature/**`, pull requests targeting `main`, and manual dispatch.

Current validation steps:

1. Checkout source
2. Set up Node.js 20
3. Install npm dependencies
4. Run TypeScript type checking
5. Run ESLint
6. Build the Next.js application

View workflow runs in the repository's **Actions** tab.

---

## Security and privacy

- Keep API keys, tokens and private credentials out of source code and commit history.
- Never expose provider secrets through `NEXT_PUBLIC_*` variables.
- Do not add Firebase Admin credentials or service-account JSON to the browser bundle.
- Configure Firebase Authentication and owner-scoped Firestore rules before introducing user data.
- Validate and constrain all AI-generated structured content before rendering or saving.
- Treat source documents and AI output as untrusted input.
- Apply upload type and size limits before enabling image processing.
- Avoid returning raw provider errors or sensitive diagnostics to end users.
- Do not enable a production Firestore emulator endpoint.
- Review dependency updates and GitHub Actions permissions periodically.

Report security issues privately to the repository maintainers rather than posting secrets or exploit details in public issues.

## Troubleshooting

### Build fails during dependency installation

- Confirm Node.js is version 20.9 or newer.
- Run `npm install` to resolve dependencies.
- If a lockfile has been committed, use `npm ci`.
- Inspect the first actual npm error rather than only the final failure line.

### Application starts but the health check fails

- Confirm the start command is `npm run start`.
- Ensure the service binds to `0.0.0.0`.
- Confirm the platform-provided `PORT` is honored.
- Inspect runtime logs for the first application error.

### AI generation reports that it is not configured

- Set `GEMINI_API_KEY` as a server-side environment secret.
- Redeploy after changing environment variables.
- Verify that the selected model is available to the key/project.
- Remember that the current Create screen uses a local fallback and is not yet connected to the AI route.

### Firebase is not connected

- Check the `NEXT_PUBLIC_FIREBASE_*` values and deployed hostname.
- Confirm Firebase Authentication authorized domains.
- Remember that Firebase auth and cloud project persistence are not yet implemented in the current UI.

### Changes do not appear after deployment

- Confirm the deployment used the intended repository and `main` branch.
- Check the deployed commit SHA.
- Review the deployment build and runtime logs.
- Trigger a new deployment after configuration changes when required.

---

## Development roadmap

The next development stages are planned as follows:

- [ ] Complete and verify a reproducible production build
- [ ] Wire the Create screen to the server-side AI route
- [ ] Add robust AI output validation, retry handling and factual review cues
- [ ] Implement Firebase Authentication
- [ ] Add owner-scoped Firestore project storage and cross-device Library
- [ ] Implement photo upload, image understanding and source extraction
- [ ] Connect the Art Director to a real conversational model
- [ ] Implement poster/image generation and output controls
- [ ] Add optional web research grounding and traceable citations
- [ ] Add export quality, accessibility and browser compatibility tests
- [ ] Complete security review and Antideploy production smoke tests

Roadmap items are goals, not claims that those features are already available.

## Contributing

1. Create a feature branch from `main`.
2. Keep changes focused and document any new environment variables.
3. Run typecheck, lint and build locally.
4. Never commit real secrets or user data.
5. Open a pull request with a clear summary, screenshots for UI changes and verification notes.

## Project separation

- **Web project:** [NSKWeb/infocraft-web-](https://github.com/NSKWeb/infocraft-web-)
- **Original project:** [NSKWeb/infocraft-](https://github.com/NSKWeb/infocraft-)

The web implementation is developed independently. Changes to this repository do not automatically change the original project.

---

<p align="center">
  <strong>InfoCraft</strong><br/>
  <sub>Clarity, composed.</sub>
</p>
