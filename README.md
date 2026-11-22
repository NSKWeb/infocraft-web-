# InfoCraft Web

A responsive web recreation of the InfoCraft Android studio. This repository is separate from `NSKWeb/infocraft-`; the Android project remains unchanged.

## Product scope

- Create: text-to-infographic and photo-to-infographic workflows.
- Canvas: editable editorial Swiss-grid layouts, palettes, sections and PNG export.
- AI Art Director: conversation and structured suggestions for canvas refinement.
- Poster Studio: image generation with aspect-ratio and resolution controls (subject to provider capability).
- Library: persist, revisit, edit and delete projects.
- Optional Google Search grounding and source citations.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Firebase Authentication and Cloud Firestore
- Firebase AI Logic Web SDK (server/client boundaries reviewed before production)
- Node.js runtime for Antideploy

## Local development

Requirements: Node.js 20.9+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Antideploy

Build command: `npm run build`  
Start command: `npm run start`  
Runtime: Node.js  
Health check: `/api/health`  
Port: use Antideploy's injected `PORT` value; the start script binds to it.

No emulator host or local Firestore emulator is required for production. Do not set `FIRESTORE_EMULATOR_HOST` in production.

## Environment variables

See `.env.example`. Firebase web configuration values prefixed with `NEXT_PUBLIC_` are client-visible by design. Never put service-account private keys, Admin SDK credentials, provider secrets, or private tokens in `NEXT_PUBLIC_*` variables.

## Implementation status

This repository is being built in stages. Features must be validated against a configured Firebase project and available AI models before being described as production-ready. A successful Next.js build alone does not verify authentication, Firestore rules, AI model availability, search grounding, or poster generation.

## Security

- Enforce Firebase Authentication and owner-scoped Firestore access.
- Validate all structured AI responses before rendering or persistence.
- Keep provider secrets server-side.
- Review Firestore security rules before production deployment.
- Do not commit real credentials, tokens, or private user data.
