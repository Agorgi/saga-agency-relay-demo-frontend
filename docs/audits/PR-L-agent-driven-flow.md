# PR-L: Agent-driven flow + live OpenAI

## Goal

Replace the fixed-text host simulation with the real Sagasan intake flow, add
in-chat handoff buttons, simplify Relay to one composer, and prepare the API
route for live OpenAI replies behind the existing runtime kill switch.

## What Changed

### Agent flow

- Added `src/lib/sagasanAgent.ts`
  - centralizes mock/live reply generation
  - enforces the ticketing refusal
  - returns persona-aware `nextStep` payloads
- Added `src/lib/webChatNextStep.ts`
  - base64url prefill encoding/decoding
  - shared route construction for in-chat CTA buttons
- Updated `src/app/api/web-chat/route.ts`
  - keeps the PR-J kill-switch + runtime-toggle contract
  - uses `buildSystemPrompt(persona)` in live mode
  - uses the new agent layer for both mock and live replies
  - falls back to the holding reply on live errors and records a system audit row

### Home and chat handoff

- Updated `src/components/LandingHero.tsx`
  - home stays a single-column hero
  - chat sits inline under the question
  - `?intent=host` opens the host intake immediately
- Updated `src/components/web-chat/HeroChatMorph.tsx`
  - chip click submits the first turn
  - chat thread stays inline on `/`
- Added `src/components/web-chat/ChatThread.tsx`
  - renders the assistant turn list
  - renders the `nextStep` button inline at the end of an intake
- Updated `src/components/web-chat/useWebChat.ts`
  - persists `nextStep` alongside restored message history

### Project handoff

- Added `src/app/projects/new/page.tsx`
- Added `src/components/ProjectPreviewView.tsx`
  - renders a read-and-confirm brief preview from Sagasan's prefill
  - routes hosts onward to `/explore`
  - routes edits back through chat instead of a second form

### Simulation removal

- Deleted `src/components/ProjectBriefBuilderView.tsx`
- Rewired `src/app/post-project/page.tsx` to `308` redirect to `/?intent=host`
- Rewired `src/app/create/page.tsx` to the same host-intent redirect
- Updated navigation helpers so old post-project entry points reopen Sagasan
  instead of the canned demo

### Relay simplification

- Updated `src/components/RelayInboxView.tsx`
  - one live composer only
  - opposite-side view is disclosure-based and read-only
  - non-host/non-creative personas get a one-CTA empty state

### Mission clean-up

- Updated `src/components/ProjectsDashboardView.tsx`
  - removed the top-bar coordination controls
  - kept one stage-aware action per project card
- Updated `src/components/ExploreTalentView.tsx`
  - kept `Picks for you`
  - collapsed filters behind `Narrow this`
  - removed extraneous route-out buttons
- Updated `src/components/ProjectWorkspaceView.tsx`
  - removed ticketing copy and stale simulation references

## Hard Rules Check

- No design-system change: yes
- No Prisma migration: yes
- One new dependency max: yes
  - `openai` was already present, so no new package was added
- Kill switch + runtime toggle unchanged: yes
- No ticketing flow: yes
- Headers / subheads pass copy lint: yes
- Old routes still resolve: yes
- `/post-project` now redirects: yes

## Verification

### 1. Migration

```text
no migration
```

### 2. Copy lint

```text
> saga-visual-talent-demo@0.1.0 lint:copy
> tsx scripts/lint-copy.ts

Copy lint passed: 22 headers checked.
```

### 3. Build

```text
✓ Compiled successfully in 12.3s
```

### 4. Dev server

The existing dev server on `localhost:3000` was already running. A fresh
verification launch still produced the required ready line before Next aborted
the duplicate process:

```text
▲ Next.js 16.2.6 (Turbopack)
- Local:         http://127.0.0.1:3016
✓ Ready in 508ms
⨯ Another next dev server is already running.
```

### 5. Unit tests

```text
✔ web chat POST returns an autonomous mock reply in mock mode
✔ web chat POST hits OpenAI in live mode when a key is present
✔ chat thread renders an inline next-step button
✔ mock host reply yields a next step once minimum info is present
✔ generic persona starters do not get mistaken for intake answers
✔ live reply uses the provided OpenAI call and preserves nextStep
✔ system prompt enforces one question per turn
✔ every persona prompt keeps one-question rule
✔ system prompt blocks ticket handling
✔ host prompt includes nextStep handoff rule
ℹ pass 10
ℹ fail 0
```

### 6. Route checks

```text
/ 200
/projects 200
/explore 200
/relay 200
/me 200
/spaces 200
/feed 200
/profile 200
/projects/new 200
/post-project 308 http://127.0.0.1:3015/?intent=host
```

### 7. Persona handoff smoke

```json
{
  "host": {
    "firstAssistant": "What are you hosting?",
    "nextLabel": "Build my event",
    "finalUrl": "http://127.0.0.1:3015/projects/new?prefill=..."
  },
  "creative": {
    "firstAssistant": "What kind of work do you want most?",
    "nextLabel": "Open my feed",
    "finalUrl": "http://127.0.0.1:3015/me?prefill=..."
  },
  "venue": {
    "firstAssistant": "About how many people can the space hold?",
    "nextLabel": "Open my spaces",
    "finalUrl": "http://127.0.0.1:3015/spaces?prefill=..."
  },
  "fan": {
    "firstAssistant": "What city should Saga tune for you?",
    "nextLabel": "See events",
    "finalUrl": "http://127.0.0.1:3015/feed?prefill=..."
  }
}
```

Tap count:

- host: `2`
- creative: `2`
- venue: `2`
- fan: `2`

### 8. Relay simplification

```json
{
  "composerCount": 1,
  "disclosureCount": 1
}
```

### 9. Mobile pass

```json
{
  "scrollWidth": 375,
  "innerWidth": 375,
  "horizontalOverflow": false
}
```

Result:

```text
PASS
```

### 10. Screenshot artifacts

Saved under `docs/audits/PR-L-screenshots/`:

- `home-broken.png`
- `home-after.png`
- `home-mobile.png`
- `post-project-before.png`
- `projects-new-after.png`
- `relay-before.png`
- `relay-after.png`
- `projects-after.png`
- `explore-after.png`
- `me-after.png`
- `spaces-after.png`
- `feed-after.png`

## Live OpenAI Note

Preview/live OpenAI verification is still pending until Alex adds
`OPENAI_API_KEY` to the Vercel environment and flips preview `LLM_MODE` to
`active_live`. Local unit coverage already verifies the live-path integration
with a mocked OpenAI call.

## Follow-ups

- Improve host-vibe extraction so event framing and mood stay more distinct
- Add richer fan interest extraction beyond the first strong match
- Defer real auth and multi-tenant scopes
- Defer persona inference from free text for non-host flows
