# CLAUDE.md

> Canonical source of truth for this repo. Loaded by every Claude Code session.
> Updated when architecture changes, NOT when individual features ship.

## What Saga is

Saga helps people make better creative work by finding the right people for the right project. The product is an AI producer + creative production graph. We start with staffing because team formation is the first high-leverage decision in creative production.

Saga is NOT an event company, NOT a marketplace, and NOT an AI wrapper. The mission is to act as a senior producer who happens to be software.

### Three-object model

Everything the product does revolves around three objects:

- **Brief** — what the user wants to make. Created by Sagasan during intake. Lives as a `Project` in the database, refined across multiple chat turns.
- **Role** — what the brief needs filled (producer, stylist, photographer, etc.). Derived from the brief. Stored as `RoleOpening`.
- **Candidate** — a person matched to a role. Stored as `CandidateRecommendation`. Has rationale, evidence, contactability, and review status.

Every page, query, and chat reply should be expressible in terms of these three objects plus journey state. If a feature can't be expressed in this vocabulary, it's probably out of scope.

### Operating principles

- **Intelligent backend, dumb frontend.** The server decides what the user sees next. Pages are thin renderers of journey state. Don't put product logic in components.
- **The brief is the spine.** Once captured, the brief is the source of truth for everything downstream. No page should re-infer facts that are already in the brief.
- **Honesty by construction.** Candidate cards, outreach status, and contactability are enforced by data shape, not by disclaimers. The shape doesn't permit "contacted" when nothing was sent.
- **One canonical state machine per project.** `ProjectJourney` decides where the user is and what they can do next. Pages read from it; they don't compute it locally.

## Relationship to the main Saga app (CRITICAL)

This repo is the **future web client** for Saga. It will replace `apps/app-web` in the main Saga monorepo at https://github.com/Try-Saga/saga once it reaches a ready state.

**Main repo at a glance** (Try-Saga/saga, private):
- Turborepo monorepo with Bun runtime, Biome linter, Docker + GCP deploy
- `apps/app-mobile` — React Native / Expo iOS app (in production on App Store)
- `apps/app-web` — current web app (to be sunsetted, replaced by what we build here)
- `apps/app-server` — backend server. Uses Prisma v7 + Postgres. Schema is split across 9 domain files (users.prisma, posts.prisma, communities.prisma, etc.).
- `apps/worker-server` — background workers
- `packages/middleware` — shared types and contracts (the spine — types flow from here to backend and frontend)
- `packages/node` — backend utilities (consumed by app-server and worker-server)
- `packages/web` — frontend utilities (consumed by app-web)

**Full reference:** `docs/main-repo-cheat-sheet.md` (~766 lines). Read it before making any portability decision. Key takeaways:
- **Architecture pattern:** Store → Service → Router in every backend domain. Follow this when adding new backend modules.
- **SSE is the real-time backbone.** Any feature that needs real-time updates (matching notifications, outreach status) follows a 4-layer pattern: middleware type → backend emitter → frontend listener → provider wiring. All four must stay in sync.
- **Prisma v7 vs our v6.** Drift exists. Not blocking for Phase 1; reconcile during Phase 2.
- **Bun-first, Biome-only.** Our `npm + ESLint` stays for Phase 1; converges in Phase 2.

**Coexist compatibility model:** shared backend, separate clients. The iOS app and the new web app will both be clients of `apps/app-server` (or a successor). Each client owns its own UI; the brains live server-side.

**Path to convergence (three phases):**

1. **Now (web rebuild, this repo):** Build the new web app with its own backend (current Prisma + Sagasan + producer engine here). Get the tracer working end-to-end. Validate with design partners. Backend remains in this repo for speed of iteration.
2. **Then (backend convergence):** Migrate the backend (Sagasan, producer engine, matching, Prisma schema, journey state machine) into `apps/app-server` in the main repo. The web app starts calling that server. The iOS app continues calling that server. One backend, two clients.
3. **Eventually (mobile parity):** iOS app gets a new UI built against the same backend, mirroring the tracer flow. Saga becomes producer-first on both platforms.

**Portability constraints — applies to every PR from now on:**

- **Type definitions stay portable.** Brief, Role, Candidate, JourneyState, ActionDescriptor, Blocker — these types must not depend on Next.js, React, or any web-specific framework. Pure TypeScript only. They should be liftable into `packages/` in the main monorepo without changes.
- **Backend logic stays portable.** Sagasan agent, producer agent, matching, candidate research — these modules should not depend on Next.js APIs (no `NextRequest`, no `next/server` imports inside the core logic). They should be pure functions/classes that an Express server, Hono server, or Next.js API route can wrap.
- **API contract stays platform-agnostic.** Every API route should have a clean request/response shape an iOS client could also call. Return JSON, accept JSON. No web-specific authentication assumptions (no relying on Next.js cookies for the core API — use bearer tokens or session IDs that travel cross-platform).
- **Prisma schema is the shared source of truth.** When extending the schema, ask: would this also make sense for the iOS client? Avoid web-only fields. The eventual `apps/app-server` will use this same schema (after migration); design for that future, not for the current isolated setup.
- **No Tailwind / web-specific styling in shared logic.** Components are web-only; that's fine. But backend modules and shared types stay clean.
- **Don't optimize for Bun now.** Main repo uses Bun runtime; this repo uses npm + Node. Don't refactor package management — that conversion happens at the convergence step. Just don't use anything Node-version-specific that Bun doesn't support.
- **Defer Biome / lint convention conversion.** This repo uses ESLint; main repo uses Biome. They'll align at convergence. For now, follow the existing ESLint config here.

**Mergeability checklist for any PR:**
- [ ] Are new types defined in pure TypeScript (no framework imports)?
- [ ] Could the backend logic in this PR run inside `apps/app-server` with no changes besides import paths?
- [ ] Does the API endpoint return platform-agnostic JSON?
- [ ] Are Prisma changes additive (new columns/tables) rather than restructuring existing models the iOS app may depend on?

## Repo layout

Next.js 16 + React 19 + TypeScript app with a single Postgres database (Prisma 6). Standalone repo for now; will be lifted into the Turborepo at Try-Saga/saga.

- `src/` — Next.js web app deployed at demo.try-saga.com via Vercel
- `src/sms-engine/` — **canonical** SMS conversation / producer / matching engine. Imported via `@/sms-engine/*` path alias (see `tsconfig.json`).
- `sms-engine/` (top-level) — **legacy subtree** from earlier import PRs (PR-A through PR-C). Code has been lifted to `src/sms-engine/`. Top-level dir still hosts test scripts referenced from `package.json`, legacy docs, and obsolete config. Slated for cleanup — see "Open issues" below.
- `prisma/schema.prisma` — single schema for the whole app. 30+ migrations live.
- `docs/` — strategy docs (audits, dogfood scripts, handoff schemas, runtime modes).
- `docs/page-briefs.md` — designer-facing per-page briefs.
- `sms-engine/docs/` — engineering docs (architecture, conversation engine, producer agent versions, candidate graph). Will move to `docs/engine/` during cleanup.

### Where things actually live

- **Sagasan chat backend:** `src/lib/sagasanAgent.ts` (orchestrator), `src/lib/sagasanOrganizerIntake.ts` (deterministic extraction + readiness gate), `src/lib/sagasanPersonas.ts`, `src/lib/sagasanSystemPrompt.ts`, `src/lib/webChatNextStep.ts` (handoff contract), `src/lib/webChatRuntimeSettings.ts`, `src/lib/hostBriefHandoff.ts`, `src/lib/buildMyCrewContracts.ts`.
- **Web chat API:** `src/app/api/web-chat/route.ts`.
- **Web chat UI:** `src/components/web-chat/ChatThread.tsx`, `src/components/web-chat/useWebChat.ts`.
- **Producer agent:** `src/sms-engine/producer/` (role inference, candidate scoring, outreach drafting).
- **Matching:** `src/sms-engine/matchingEval/`, `src/sms-engine/networkMatching.ts`.
- **Talent research:** `src/sms-engine/sourcing/openaiWebResearchProvider.ts` (uses OpenAI for public-web research).
- **SMS/Twilio:** `src/sms-engine/twilio.ts` (kill switch `TWILIO_API_CALLS_FORBIDDEN`), `src/sms-engine/twilioWebhook.ts`, `src/sms-engine/messagingProvider.ts`.
- **Health endpoint:** `src/app/api/health/route.ts` — reports DB, Twilio mode, LLM mode, pilot stage.

## Core types (target architecture)

These are the four anchors the product is being rebuilt around. Some exist in some form already (`Project`, `RoleOpening`, `CandidateRecommendation`); some are new (`ProjectJourney`, per-field confidence). Treat this section as the spec for the in-progress rework, not as a description of current state.

```ts
// Brief = Project in DB; Brief is the user-facing name
type Brief = {
  id: string
  ownerId: string
  status: "drafting" | "ready" | "active" | "archived"
  persona: "host"                          // locked per project; never re-classified
  projectIdea: BriefField<string>
  location: BriefField<string>
  dateWindow: BriefField<string>
  scale: BriefField<string>
  vibeTags: BriefField<string[]>
  references: BriefField<string[]>          // cultural references (e.g., "Love and Deepspace")
  budgetRange: BriefField<string> | null
  existingCrew: BriefField<string[]> | null
  helpNeeded: BriefField<string[]>          // userRequests — what Saga should source
  briefProgress: {
    knownFields: string[]
    missingFields: string[]
    readinessScore: number                  // 0-10
  }
}

type BriefField<T> = {
  value: T
  confidence: "explicit" | "inferred"
}

type Role = {
  id: string
  briefId: string
  title: string
  whyNeeded: string                         // brief-specific rationale
  priority: "core" | "nice-to-have"
  localRequired: boolean
  status: "suggested" | "user-approved" | "user-removed" | "filled"
}

type Candidate = {
  id: string
  roleId: string
  display: {
    name: string                            // real name or "Demo candidate"
    sourceMode: "real" | "demo_composite" | "researched_unverified"
    location: string
    primaryRole: string
    secondaryRoles: string[]
  }
  whyFit: string                            // brief-specific, max 2 sentences
  evidence: Array<{ label: string; href: string; domain: string }>
  contactability: "researched" | "verified" | "unknown" | "do_not_contact"
  reviewStatus: "pending" | "approved" | "rejected" | "needs_info"
  outreachStatus: "not_prepared" | "draft" | "approved_to_send" | "sent"
}

type JourneyState = {
  briefId: string
  step:
    | "intake"                              // brief incomplete, user in chat
    | "brief_ready"                         // brief reviewable, "Build my crew" unlocked
    | "crew_reviewing"                      // roles suggested, user approving candidates
    | "outreach_prep"                       // candidates approved, drafts being assembled
    | "outreach_awaiting_send"              // drafts approved, blocked on A2P
    | "outreach_sent"                       // sent (currently unreachable; see "Never do")
    | "archived"
  primaryAction: ActionDescriptor
  blockers: Blocker[]
  lastTransition: Date
}

type ActionDescriptor = {
  label: string
  intent: "navigate" | "approve" | "edit" | "submit_chat"
  href?: string
  enabled: boolean
  blockedReason?: string
}

type Blocker = {
  type:
    | "missing_brief_field"
    | "no_roles_suggested"
    | "no_candidates_approved"
    | "a2p_not_approved"
    | "twilio_kill_switch"
  detail: string
  resolvable: "by_user" | "by_admin"
}
```

### State transitions

- **intake → brief_ready** — Sagasan after every reply, if `readinessScore >= 8`.
- **brief_ready → crew_reviewing** — user clicks "Build my crew." Server persists `RoleOpening` rows from the previously-previewed list.
- **crew_reviewing → outreach_prep** — automatic when ALL core roles have ≥1 `reviewStatus: "approved"`. Approval IS the trigger; no separate user action. Triggers outreach draft generation in background.
- **outreach_prep → outreach_awaiting_send** — user approves outreach drafts on `/projects/[id]/outreach`.
- **outreach_awaiting_send → outreach_sent** — blocked by `TWILIO_API_CALLS_FORBIDDEN` and unmet A2P approval. Currently unreachable. This is intentional.
- **brief_ready → intake** — soft-revert allowed if user materially changes essentials via "Edit with Sagasan." Sagasan decides.
- **any → archived** — explicit user action.

## Sagasan, in three layers

The chat agent has three independent layers. Reason about them separately.

### Layer A — Extraction

What facts come out of each user message.

- **LLM mode** (`llm.provider: openai` per `/api/health`): structured-output OpenAI call with Zod schema.
- **Fallback mode** (`llm.provider: fallback`): deterministic regex extractors at `src/lib/sagasanOrganizerIntake.ts`.

Both modes share an output contract: extracted brief fields with `{ value, confidence }`, plus `userRequests` (roles the user wants sourced) distinct from `userOffers` (roles the user identifies as their own). This distinction is what fixes the Step 6 P0 — see "Open issues."

### Layer B — Reply composition

What Sagasan says back. Principle: **reflect specifics, not categories.**

Not: "Got it — I have project idea, timing, format, vibe, and references."

Instead: "Got it — a formal ball in July, cosmic-romantic in the Love and Deepspace mood. To shape the team I need a bit more: roughly how many people, where you're hosting, whether you have crew lined up, and what you want me to help with."

The reply reflects user's own words, anchors cultural references, names specific gaps, and lowers the bar ("fuzzy is fine"). LLM mode produces this via prompt. Fallback mode produces a templated version that interpolates user's actual words, not category names.

### Layer C — Producer stance

When Sagasan leads instead of gathers. Example: "For 150 people I'd lock a venue before pinning the exact date — Saturdays in July fill up fast. Want me to start the venue search while we talk through the rest?"

Layer C is LLM-only. Don't ship producer-stance moves in fallback. When LLM mode is stable, allow ≤1 stance move per turn, must reference a fact already in the brief, must be phrased as a soft suggestion.

### Integration with journey

Every chat reply:

```
1. Extract fields from latest message (Layer A)
2. Upsert Project row (create on first turn)
3. Evaluate brief readiness; if ≥8, advanceJourney(projectId, "brief_ready")
4. Read journey state
5. Compose reply that REFERS to journey state (Layer B/C)
```

Transition is **decoupled from reply text**. The reply doesn't say "here's your button" — it says "OK, I have enough; I've sketched it on your project page." The CTA is secondary visual. This is the structural fix for "rushes to the next page after the second message."

## The tracer (current scope)

One end-to-end user journey rebuilt as a reference implementation:

```
Landing + Sagasan chat (intake)
  → /projects/[id]               (brief review)
  → /projects/[id]/crew          (Build my Crew — role-first)
  → /projects/[id]/crew/[roleId] (candidate review per role)
  → /projects/[id]/outreach      (outreach drafts — NOT sent)
```

Audience: design partners. Not internal demos, not public beta. Robustness over scale.

Pages in scope: the five above. Every other page (`/me`, `/feed`, `/events`, `/talent/[id]`, `/spaces`, `/profile`, admin) gets a **cosmetic strip-down** only, not a redesign. Behavior and routes preserved. Design tokens + component vocabulary unified.

See `docs/page-briefs.md` for designer-facing per-page briefs.

## Deferred backlog — identity + fandom preferences graph

**The product requirement (paraphrased from user, 2026-05-17):** Saga should capture personal information from every user — organizer, talent, fan alike — as early as possible, to build an **identity and fandom preferences graph**. The purpose: surface every user as a potential collaborator to every other user. This is the network effect that distinguishes Saga from a single-shot matching tool.

**Status:** explicitly deferred. The user chose to keep this backlogged "until the UI, user flow, all existing bugs are fixed and all existing updates and improvements are made." Do NOT implement now. Do NOT add identity-capture fields to the organizer intake without explicit user direction.

**What's needed to keep the door open** (i.e., not paint ourselves into a corner before this lands):
- When extending the Prisma schema, leave room for identity / fandom fields on `Person` and `CreatorProfile`. Don't lock the schema into organizer-only.
- `RelationshipEdge` is the foundation of the collaboration graph. Extend it; don't recreate it.
- When the tracer ships and the open-issues register is clean, this is the next major architectural decision: a lightweight identity-and-fandom intake (lighter than full brief intake), a fandom tag taxonomy, opt-in surfacing rules, a suggestion engine on top of `RelationshipEdge`.

**Why it's deferred and not parallel:** building it now would expand the tracer scope before it ships. The product principle of "Brief is the spine" still applies for this iteration. Fandom graph becomes another spine, not a competing one, when it's time.

## What's real vs scaffolded vs demo

Honest inventory. Update when feature state changes.

| Area | State | Notes |
|------|-------|-------|
| Sagasan persona classifier | Real, deterministic only | LLM gated off; bare-noun bug in Step 6 P0 below |
| Sagasan organizer intake | Real, deterministic only | Readiness gate works; reply composition is template-based |
| Sagasan LLM mode | Gated off | `LLM_ACTIVE_LIVE_DISABLED=true`. Invalid model string and `safeLlmReviewText` placeholder bug closed in PR #1. Vercel env var `OPENAI_MODEL` should be updated separately. |
| Conversation engine | Shadow mode | `/api/health` reports `conversationEngineMode: "shadow"`, `conversationEngineEffectiveActive: false`. Observable but not active. Gated behind A2P approval. |
| Brief → /projects/new handoff | Real | Today via base64 prefill; will move to DB-backed |
| Build My Crew page | Real | `buildMyCrewContracts.ts` enforces brief_handoff vs demo_seed |
| Candidate review per role | Not built | Tracer scope |
| ProjectJourney state machine | Not built | Tracer scope |
| Talent grid (/explore) | Demo | Picsum-seeded creator cards. Not in tracer. |
| Producer agent | Real, admin-only | `src/sms-engine/producer/*` (role inference, candidate scoring) |
| Candidate research (public web) | Real, admin-only | `src/sms-engine/sourcing/openaiWebResearchProvider.ts` |
| Outreach drafting | Real, admin-only | `Outreach` rows generated; not surfaced in user UI |
| SMS/Twilio inbound | Real, gated | Webhook, signature validation, intent routing |
| SMS/Twilio outbound | Gated off | `TWILIO_API_CALLS_FORBIDDEN=true`; A2P approval blocked |
| Group chat (ProductionConversation) | Real, gated | Twilio Conversations or MOCK; not surfaced |
| Admin command center | Real | 40+ `/admin/*` pages |
| Public beta admission | Built, gated off | `BetaInviteCode`; `pilotStage: internal_test` |
| Public launch | Disabled | `publicLaunchEnabled: false` |
| Convergence with `apps/app-server` (main repo) | Not started | Phase 2 work; backend migrates after tracer ships |
| iOS client parity | Not started | Phase 3 work; iOS UI rebuilds against shared backend |

## Open issues / known regressions

**Canonical working list:** `docs/open-issues.md` (40 items as of 2026-05-16, derived from the Cowork QA handoff packet). Update that file as items ship fixed; this section is just the top-of-list summary.

### Top items by severity

**P0 (2 open):**
- **P0-OI-1** — Persona re-classification on rich organizer brief silently flips host → creative (the Step 6 regression; details below).
- **P0-OI-2** — Organizer brief data discarded on persona flip (silent data loss; sibling of P0-OI-1).

**P1 (4 open):**
- **P1-OI-3** — `/explore` "0 surfaced" empty state on real briefs (search field auto-fills the full brief string).
- **P1-OI-4** — `/explore` cold-load still labels "Shortlisting into Beauty Brand Creator Content Day" when no `projectId`.
- **P1-OI-5** — "Cosplay cafe night Brooklyn" misclassifies as venue, not host (same root cause class as P0-OI-1).
- **P1-OI-6** — "DM that photographer right now" enrolls user as creative instead of outbound-action boundary.

P2/P3: 32 items in `docs/open-issues.md`. Don't expand inline here.

Recently closed (see resolved appendix in `docs/open-issues.md`): P1-OI-7 (invalid `gpt-5.4-mini` rejected at config-read time; env var still needs production update), P1-OI-8 (`safeLlmReviewText` placeholder leak fixed via `reply` key in `textFromValue`).

### Step 6 P0 — persona-flip on rich brief
**Symptom:** sending a rich host brief that contains the word "photographer" (e.g., "I have one photographer friend") silently flips persona host → creative, drops the brief, and routes to `/me?prefill=...` as if the user offered creative services.

**Root cause:** Three converging defects in `src/lib/sagasanAgent.ts`:
1. Line ~749: bare-word `/\bphotographer\b/i` in `CREATIVE_SIGNAL_PATTERNS` — matches any mention of the noun, not just self-identification.
2. Line ~1021: persona pivot uses loose `strongCreativeSignal` when there's no anchored persona (organic user without chip click).
3. Lines ~463-483: `inferPortfolioLink` returns "Sample shared in chat" on bare mention of "instagram"; `inferRateHint` regex captures `$15` from `$15k`.

**Structural fix (preferred):** persona becomes per-project not per-message; extraction distinguishes `userRequests` from `userOffers`. See Sagasan Layer A above.

**Tactical fix (if shipping before structural):** require self-identity anchor for bare-noun creative signals; drop "instagram" from passive portfolio inference; fix rate regex.

### Legacy `sms-engine/` top-level cleanup
**Symptom:** Every AI assistant reading the repo gets confused by two `sms-engine/` directories.

**Reality:** `src/sms-engine/` is canonical (imports resolve here via `@/sms-engine/*` alias). Top-level `sms-engine/` contains:
- Live: 14 test scripts referenced by `package.json` (import via aliases, so they ARE testing the canonical code).
- Live: ~80 engineering docs at `sms-engine/docs/`.
- Dead: `.github/workflows/ci.yml` (GitHub only reads root `.github/`; this never runs), `.original` package files, duplicate Next.js shell.
- Uncertain: `railway.json`, `docker-compose.yml`, `prisma.config.ts` — may be load-bearing for a separate Railway service; verify before deleting.

**Cleanup plan:**
1. Confirm Railway deployment state (does anything deploy from `sms-engine/` subdir?).
2. Move test scripts to `scripts/sms-engine/`; move docs to `docs/engine/`; delete confirmed-dead files.
3. Add a real `.github/workflows/ci.yml` at the repo root that runs the existing test scripts.

### LLM mode is off — and has known latents when flipped on
**Current state:** `/api/health` reports `llm.provider: "fallback"`, `llm.mode: "fallback"`, `llm.model: "gpt-5.4-mini"`. Both `LLM_ACTIVE_LIVE_DISABLED=true` and `ACTIVE_LIVE_ALLOWED=false`. Conversation engine runs in `shadow` mode (observable but not active).

**Implication for QA:** every Sagasan reply tested in recent audits came from the deterministic handler in `src/lib/sagasanAgent.ts`, NOT the LLM. The "doesn't feel personal" complaint is partially a fallback-template problem (Layer B composition is templated) and partially a not-yet-enabled-LLM problem (Layer B prompt-driven composition gets warmer in LLM mode).

**Remaining concerns when live mode flips on:**
- `OPENAI_MODEL` env var on Vercel may still be set to `gpt-5.4-mini`. PR #1 hardened `getConfiguredModel()` to reject this string and fall back to `gpt-4o-mini`, but fixing the env var at the source is cleaner. Update it in the Vercel dashboard when convenient.
- Earlier audit observation: OpenAI structured-output paths can succeed for one operation and fail for another. Stabilize structured-output reliability before pushing LLM mode to design partners.

**Direction:** With PR #1 landed, the two known LLM latents are no longer blocking. Before flipping live mode in any environment: (a) update the Vercel env var to remove the bad model string; (b) validate structured-output reliability with a non-prod test of each operation.

## Commands

```
npm install
npm run dev                              # local dev server
npm run build                            # production build
npm run lint                             # ESLint
npm run lint:copy                        # custom copy linter
npm run typecheck                        # tsc --noEmit

# Test groups (tsx node:test runner)
npm run test:sagasan-agent               # web chat persona, intake, handoff
npm run test:conversation-engine-v0.1    # SMS conversation policies + multiturn
npm run test:security-hardening
npm run test:twilio-readiness

# Database
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:studio
```

`/api/health` reports runtime state (LLM provider, DB, Twilio mode, pilot stage). Always check this when triaging — if it says `llm.provider: fallback`, you're testing the deterministic handler, not the LLM.

## Never do

These are inviolable.

- **Never send real SMS to anyone not on the allowlist.** `TWILIO_API_CALLS_FORBIDDEN=true` is the kill switch. Don't disable it. A2P approval gates real send.
- **Never flip `publicBetaEnabled` or `publicLaunchEnabled` to true** without explicit user direction.
- **Never contact a real candidate.** Outreach drafts get persisted; sends don't fire.
- **Never represent a candidate as confirmed, contacted, available, or booked.** The card shape enforces this — don't bypass it.
- **Never store production credentials in code or in this file.** `.env.example` is the reference; actual secrets live in deployment env.
- **Never bypass the journey state machine.** Pages must read from `ProjectJourney` and redirect on invalid state. Don't compute "what should this page show" locally.
- **Never write a CTA whose label, enabled state, and destination don't come from `journey.primaryAction`.**
- **Never amend commits to bypass pre-commit hooks.** If a hook fails, fix the issue and create a new commit.
- **Never run `prisma migrate deploy` against production Neon without `POSTGRES_URL_NON_POOLING` set in the build env.** This was discovered during PR #13 — without it, migrations 500 the preview environment. Coordinate with the migration playbook.
- **Never wire this demo to a real Saga production app integration.** `pilot.manualGates` includes "No production Saga app integration" as a required_boundary today. This boundary will be relaxed during Phase 2 backend convergence (when this app's backend migrates into `apps/app-server`), but until that's explicitly underway, don't cross it.

## For AI agents working in this repo

- Read this file before doing anything else. If it conflicts with what you remember from another session, trust this file.
- When you change architecture (new core type, new journey state, new Sagasan layer boundary), update this file in the same PR.
- When you make a small feature change, do NOT update this file. It's for architecture, not changelog.
- `docs/page-briefs.md` is for designers. Plain English, no code, no file paths. Don't conflate the two.
- Default to writing no comments. If you're tempted to write "what this code does," delete it. If you're tempted to write "why this code looks weird," keep it.
- Don't introduce new patterns without checking whether an existing one covers your case. Adding a new pattern without consolidating costs the next reader of this code.
- If you're not sure what's real vs scaffolded, check the inventory table. If the table is wrong, fix it.

## Workflow

1. Architecture decisions live in this file. Don't re-litigate them in chat sessions.
2. Designer collaboration uses `docs/page-briefs.md`.
3. Implementation goes through PRs. One PR per coherent change. Tests in the same PR as the change.
4. Adversarial verification (Claude co-work, or another Claude Code session in review mode) reviews PRs before merge.
5. `/api/health` is the source of truth for runtime state. Read it before you assume.
6. Every PR should pass the "mergeability checklist" in the "Relationship to the main Saga app" section above. If a PR breaks portability, flag it and discuss before merging.
7. The main Saga repo (Try-Saga/saga) has its own CLAUDE.md with conventions like plan-first, `tasks/lessons.md` self-improvement loop, and subagent-heavy workflows. When this repo merges into the main monorepo, those conventions take precedence over the ones here. Until then, this CLAUDE.md is canonical for this codebase.
