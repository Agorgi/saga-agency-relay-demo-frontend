# PR-K: Four-persona router

## Goal

Turn the public home page into a four-persona Sagasan router, keep chat as the
primary entry point, shorten public headers and subheads, rewire the main
surfaces around persona-aware destinations, and keep legacy URLs working.

## What Changed

### Chat and persona routing

- Added client/session persona helpers:
  - `src/lib/sagasanPersonas.ts`
  - `src/lib/useSessionPersona.ts`
- Added `src/lib/sagasanSystemPrompt.ts`
- Added prompt test:
  - `src/lib/sagasanSystemPrompt.test.ts`
- Reworked `src/app/api/web-chat/route.ts`
  - keeps the existing response contract
  - stores persona in a lightweight cookie instead of Prisma
  - uses persona-aware active-mock first-turn logic
  - uses `buildSystemPrompt(persona)` for live-mode prompts
  - hard-blocks ticket handling with:
    - `Tickets live elsewhere — Saga doesn't handle those.`

### Home and nav

- Reworked `src/components/LandingHero.tsx`
  - single public H1
  - single Sagasan question
  - fold is the chat launcher
- Reworked `src/components/web-chat/HeroChatMorph.tsx`
  - four persona chips
  - chip click submits the persona starter turn
  - no morph until first submit
- Reworked `src/components/AppChrome.tsx`
  - nav shrinks to `Home · For me · Discover`
  - `For me` and `Discover` are hidden until a persona exists
  - right CTA changes copy by persona

### Public routes

- Added:
  - `src/app/me/page.tsx`
  - `src/app/spaces/page.tsx`
  - `src/components/ForMeView.tsx`
  - `src/components/SpacesView.tsx`
  - `src/components/FanFeedView.tsx`
- Rewired:
  - `/feed` to the fan feed
  - `/profile` to the `/me` content under a legacy header
- Updated public copy on:
  - `/chat`
  - `/explore`
  - `/projects`
  - `/relay`

### Copy tooling

- Added `scripts/lint-copy.ts`
- Added package script:
  - `npm run lint:copy`

## Hard Rules Check

- No new dependencies: yes
- No Prisma migration: yes
- No auth changes: yes
- No ticketing flow added: yes
- Legacy URLs still resolve: yes
- Persona kept out of Prisma: yes

## Verification

### Screenshot pairs

- `/`
  - before: `docs/audits/PR-K-screenshots/before-home-prod.png`
  - after: `docs/audits/PR-K-screenshots/home.png`
- `/explore`
  - before: `docs/audits/PR-K-screenshots/before-explore-prod.png`
  - after: `docs/audits/PR-K-screenshots/explore.png`
- `/projects`
  - before: `docs/audits/PR-K-screenshots/before-projects-prod.png`
  - after: `docs/audits/PR-K-screenshots/projects.png`

### 1. Migration

```text
no migration
```

### 2. Copy lint

```text
> saga-visual-talent-demo@0.1.0 lint:copy
> tsx scripts/lint-copy.ts

Copy lint passed: 15 headers checked.
```

### 3. Prompt test

```text
✔ system prompt enforces one question per turn
✔ system prompt blocks ticket handling
```

### 4. Build

```text
✓ Compiled successfully in 4.7s
```

### 5. Dev server

The existing local demo server remained on `http://localhost:3000`.
A second verification launch on another port produced:

```text
▲ Next.js 16.2.6 (Turbopack)
- Local:         http://localhost:3010
✓ Ready in 199ms
```

### 6. Screenshots

Saved under `docs/audits/PR-K-screenshots/`:

- `home.png`
- `home-mobile.png`
- `me.png`
- `feed.png`
- `spaces.png`
- `explore.png`
- `projects.png`
- `relay.png`

### 7. Persona starts

Verified in a fresh browser context on `http://localhost:3000`:

```json
{
  "host": "What are you hosting, and what should it feel like?",
  "creative": "What kind of work do you want, and what do you make?",
  "venue": "What kind of space do you run, and what does it feel like?",
  "fan": "What city are you in, and what scenes do you want more of?"
}
```

### 8. Mobile pass

```json
{
  "horizontalOverflow": false,
  "chipsVisible": true,
  "inputFits": true
}
```

Result:

```text
PASS
```

### 9. Tap-count audit

- host: `2` taps
  - chip, then `Discover`
- creative: `2` taps
  - chip, then `For me`
- venue: `2` taps
  - chip, then `Discover`
- fan: `2` taps
  - chip, then `Discover`

### 10. Legacy route checks

```text
/profile 200
/explore 200
/projects 200
/relay 200
/me 200
/feed 200
/spaces 200
```

Header checks:

```text
/profile FOUND Your next moves.
/explore FOUND Talent in your world.
/projects FOUND What you're working on.
/relay FOUND Outreach in motion.
```

## Deviations

- The requested source audit file was unavailable in the mounted workspace, so
  `PR-K-audit.md` records that deviation rather than copying the missing file.
- `lint:copy` uses `tsx` instead of `ts-node` because `tsx` is already present in
  the repo and the brief explicitly disallowed new dependencies.
- Persona is stored in a lightweight cookie plus client state, so no Prisma
  change was needed.

## Follow-ups

- Defer real talent self-signup to PR-L
- Defer venue persistence models to PR-M
- Defer fan email capture plumbing to PR-N
- Defer real auth and role-aware accounts beyond the demo session
