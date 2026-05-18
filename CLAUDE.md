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
- **API contract stays platform-agnostic.** Every API route should have a clean request/response shape an iOS client could also call. Return JSON, accept JSON. Cross-platform auth note: PR #37 wired cookie-bound `requireProjectOwnership` into the tracer API routes for Phase 1. The helper resolves to `getExistingSession(req)`, which currently reads only the `web_session_id` cookie. Before iOS parity (Phase 3) the helper needs a bearer-token reader added so the same routes can be hit from a native client with an `Authorization: Session <id>` header. Single-helper extension; deferred for now.
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
- **Producer agent:** `src/sms-engine/producer/` (role inference, candidate scoring, outreach drafting). The tracer hook is `generateCandidateOutreachDraftsForProject(projectId)` in `producer/outboundDrafts.ts` — called from `candidateReview.ts` after journey advance to outreach_prep.
- **Crew generation (tracer):** `src/lib/projectCrewGeneration.ts` — `generateCrewForProject(projectId)` orchestrator that runs the producer engine on chat-created Projects. Builds `ProjectUnderstanding` from Project fields (patches `sourceKind` to `organizer_project` since the chat persona gate already classified it), generates the role map, scores the internal `CreatorProfile` pool, and persists `RoleOpening` + `Opportunity` + `CandidateRecommendation` rows. Idempotent (skips if any role already exists). Wired into `loadCrewView` so the first `/projects/[id]/crew` visit materializes roles.
- **Composite talent pool:** `scripts/seed-creator-pool.ts` — idempotent seeder that creates ~18 `Person` + `CreatorProfile` rows tagged `Person.source = DEMO_COMPOSITE`. Covers every role the producer's deterministic role map emits across the five cities its `inferCity` recognises directly (LA, NYC, Brooklyn, Atlanta, Chicago). Honesty: composites carry no phone/email; `projectCandidateView` reads `Person.source` and drives the "Demo candidate · Composite from public sources" badge on the candidate review card. Run via `npm run seed:creator-pool`. Apply migration `20260518000000_add_demo_composite_person_source` first.
- **Admin talent filter:** `src/lib/adminTalentFilter.ts` — `buildAdminPersonWhere` / `buildAdminCreatorProfileWhere` Prisma fragments + `shouldIncludeComposites` query-param parser. Wired into `/admin/people` and `/admin/creator-profiles`: composites are hidden by default; admins toggle with the "Include composites" link (sets `?includeComposites=1`). Tracer + producer code paths still see everything — only the admin-list pages filter.
- **Person identity-graph fields:** `Person.fandoms: String[]` and `Person.interests: String[]` (added PR #63, migration `20260518040000_add_person_fandoms_interests`). Both default to `[]`. GIN-indexed for Postgres array-overlap (`&&`) and contains (`@>`) queries. Captured across every persona — fandoms are specific media/franchises (anime, K-pop, Love and Deepspace); interests are broader preferences (nightlife, brunch, raves). Foundation for cross-pollination: a host who mentions "Love and Deepspace" in their brief surfaces to other Love-and-Deepspace fans. **This lifts the "identity + fandom preferences graph" backlog item** that was previously deferred per the "Deferred backlog" section below — built across PRs #63–68. PR #64 wires regex extraction; PR #67 wires LLM extraction; PR #68 ships the matching helper and the producer-scoring integration.
- **Cross-fandom matching helper (PR #68):** `findPeopleWithOverlappingFandoms({ personId, limit?, excludeSources? })` in `src/lib/findOverlappingPeople.ts`. Uses Postgres `&&` array-overlap via `$queryRaw` so the GIN index on `Person.fandoms` is hit; orders by overlap size descending. Returns `{ personId, displayName, fandomOverlap, overlapCount, source, city }` per match — `fandomOverlap` is the actual intersection (not just the count), so callers can display the shared fandoms. `excludeSources` filters out e.g. `DEMO_COMPOSITE` rows for "real users only" surfaces. Liftable into `apps/app-server` unchanged.
- **Producer-scoring identity-graph boost (PR #68):** `generateCrewForProject` now unions the owner's `Person.fandoms` into `ProjectUnderstanding.fandoms` before scoring — via `enrichUnderstandingWithOwnerFandoms` in `src/lib/projectCrewGeneration.ts`. The producer's existing `scoreCandidateForRole` (in `src/sms-engine/producer/candidateRecommendations.ts`) already weights fandom overlap; widening the project fandom set with the owner's identity-graph signal feeds it more matches without changing the scoring code. Wired up by `upsertProjectFromBrief` setting `Project.organizerPersonId` from `WebSession.personId` at create time (and backfilling existing projects on subsequent chat turns when the session's Person appears after the project was first created — closes the PR #64/#67 race).
- **Identity signal extraction:** `src/lib/identitySignals.ts` is the cross-persona pattern bank (`FANDOM_PATTERNS` + `INTEREST_PATTERNS`) plus `extractIdentitySignals(text)` and `mergeIdentitySignals(a, b)`. `src/lib/sessionPersonStore.ts` owns the DB side. Two write paths into Person: `upsertSessionIdentitySignals({ sessionId, message })` runs regex on the raw message (safety net, runs first on every turn), and `upsertSessionIdentitySignalsFromExtracted({ sessionId, signals })` writes the LLM's already-structured fandoms/interests from `AgentReply.llmExtractedSignals` (added in PR #67, runs after the LLM call succeeds). Both share an internal `applyExtractedSignals` helper and converge on the same Person row — `mergeIdentitySignals` dedups case-insensitively so re-mentions don't double-count. `ensureSessionPerson(sessionId)` creates the anchor Person lazily on the first identity-bearing turn (source=APP, no PII). `WebSession.personId` was added in migration `20260518050000_add_web_session_person`. Both calls are wrapped in try/catch + Sentry tagging so identity capture failures never break chat reply.
- **LLM-primary extraction contract (PR #65):** `liveAgentReplySchema` in `src/lib/sagasanAgent.ts` now demands the LLM produce BOTH a reply message AND a structured `extractedSignals` object containing fandoms / interests / city / persona-specific fields. The system prompt (`src/lib/sagasanSystemPrompt.ts` → `EXTRACTION_RULES`) instructs the model to populate the fields it recognizes, leave unmentioned fields as `null`, and never fabricate. `mergeLlmExtractedSignals(regex, llmSignals)` in `sagasanAgent.ts` merges the LLM output over the regex baseline: scalar fields use the LLM's value when non-empty (whitespace doesn't count), array fields union with case-insensitive dedup. The regex extractor remains as a fallback path for when the LLM is unavailable. All schema fields are `.nullable()` per OpenAI strict-mode rules ("all fields must be required; use null for absent values"). The LLM-extracted payload is also surfaced on `AgentReply.llmExtractedSignals` so the chat route can route fandoms/interests through `upsertSessionIdentitySignals` (PR #67) without re-parsing the user message.
- **LLM smoke-test endpoint (PR #66):** `POST /api/admin/llm-smoke-test` exercises the live LLM path with a fixed set of fixtures — one per persona, picked to cover the regex-gap motivating cases (nightclub, speakeasy) and the cross-persona identity-graph signals (Love and Deepspace, anime / cosplay, K-pop). Each fixture calls `generateAgentReply` with `mode: "active_live"` regardless of `LLM_ACTIVE_LIVE_DISABLED` (the endpoint IS the validation gate for flipping that flag), measures latency, and reports `{ name, persona, ok, latencyMs, errorCategory, reply, extractedSignals }`. Auth-gated by `requireInternalApiKey`. Returns 400 (with `apiKeyConfigured: false`) when `OPENAI_API_KEY` is missing — without it the test can't exercise the model and pretending otherwise would hide the real config error. Use this after setting `OPENAI_API_KEY` + a valid `OPENAI_MODEL` in Vercel, before flipping `LLM_ACTIVE_LIVE_DISABLED=false`.
- **Outreach review (tracer page 5):** `src/lib/projectOutreachView.ts` (server-side loader), `src/lib/outreachApproval.ts` (approve action), `src/app/projects/[slug]/outreach/page.tsx`, `src/app/api/projects/[id]/outreach/approve/route.ts`, `src/components/projects/OutreachReviewView.tsx`.
- **"Your projects" landing (`/projects`):** `src/lib/projectsListView.ts` (server-side loader keyed on the cookie session), `src/app/projects/page.tsx`, `src/components/projects/MyProjectsView.tsx`. Shape is a list so an identity layer (Phase 2/3) can expose multiple projects per user without changing the page contract. Empty state CTA goes to `/chat`.
- **Per-user auth on tracer APIs:** `src/lib/projectAuth.ts` — `requireProjectOwnership(req, projectId)` and `requireCandidateOwnership(req, candidateId)`. Returns a discriminated `{ ok: true, sessionId }` / `{ ok: false, status, error }` result; pair with `jsonForAuthFailure` in route handlers. Add this check at the top of any new project- or candidate-mutating route.
- **Project archival:** `src/lib/projectArchive.ts` — `archiveProject(projectId, db?)` wraps `advanceJourney(projectId, "archive")` plus a `WebSession.projectId` unbind for every session pointing at the project, all inside one Prisma transaction. API route at `src/app/api/projects/[id]/archive/route.ts`; client island button at `src/components/projects/ProjectArchiveButton.tsx`. `loadProjectsListView` filters archived projects so the user lands on a clean empty state, and `BriefReviewView` renders an "Archived" banner + "Start a new brief" CTA when `journey.step === "archived"`. The Project row itself is not deleted — brief / roles / candidates / drafts all stay queryable for audit.
- **Per-user auth on tracer pages:** `sessionOwnsProject(sessionId, projectId)` in `src/lib/projectAuth.ts` — server-component variant that takes the session id directly (read it via `next/headers` `cookies().get(WEB_SESSION_COOKIE_NAME)`). Returns a boolean. Page handlers: if false, call `notFound()` before loading. Already applied to all four tracer page handlers.
- **Matching:** `src/sms-engine/matchingEval/`, `src/sms-engine/networkMatching.ts`.
- **Talent research:** `src/sms-engine/sourcing/openaiWebResearchProvider.ts` (uses OpenAI for public-web research).
- **SMS/Twilio:** `src/sms-engine/twilio.ts` (kill switch `TWILIO_API_CALLS_FORBIDDEN`), `src/sms-engine/twilioWebhook.ts`, `src/sms-engine/messagingProvider.ts`.
- **Health endpoint:** `src/app/api/health/route.ts` — reports DB, Twilio mode, LLM mode, pilot stage. PR #58 added a `tracer` block (from `src/lib/tracerHealth.ts`) with `compositeTalentPoolSize` / `compositeTalentPoolSeeded`, `projectJourneyCount` + `projectJourneyCountByStep`, `latestMigration { name, appliedAt }`, and `producerDeterministicHealthy` (synthetic-input smoke test for `buildProjectUnderstanding` + `generateRoleMap`). Each probe is wrapped — a single failure (DB down, missing column) degrades to `tracerHealthAvailable: false` without 500ing the whole response.
- **WebSession TTL cleanup:** `src/lib/webSessionCleanup.ts` (framework-agnostic) + `scripts/cleanup-web-sessions.ts` (CLI). `cleanupStaleSessions({ ttlDays, dryRun })` deletes `WebSession` rows whose `lastSeenAt` is older than the TTL AND that carry no project link OR are bound to an archived project. WebChatMessage cascades on session delete. Active-project sessions are never touched. Defaults to dry-run; runbook in `docs/DEPLOY.md`. TTL default 90 days, override via `WEB_SESSION_TTL_DAYS` env. Audit log entry on every run (`action: web_session.cleanup`).

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

## Identity + fandom preferences graph (active workstream, lifted 2026-05-18)

**The product requirement (originally 2026-05-17, lifted 2026-05-18):** Saga captures personal information from every user — organizer, talent, fan alike — as early as possible, to build an **identity and fandom preferences graph**. The purpose: surface every user as a potential collaborator to every other user. This is the network effect that distinguishes Saga from a single-shot matching tool.

**Status:** active. The user explicitly lifted the deferral on 2026-05-18 with the directive: "When a user adds information like their event is 'love and deepspace' even if that is not included in a specific UI component later, it should be stored in their user profile so we can better pair them with other creators venues, organizers, or artists that have also expressed a similar fandom." The build is sequenced across PRs #63–68 as part of the broader LLM/conversation-quality workstream.

**What's shipping (in order):**
- **PR #63 (this one)** — Schema: `Person.fandoms: String[]`, `Person.interests: String[]`, both GIN-indexed for `&&` / `@>` queries. Default `[]`. Foundation only — no extractor changes yet.
- **PR #64** — Wiring: cross-persona extractors write captured fandoms/interests to `Person` regardless of which intake surface (host/creative/venue/fan) the user came in through. Also closes the regex gaps screenshotted by the user (e.g., "nightclub" not matching `VENUE_TYPE_PATTERNS`).
- **PR #65** — Layer B fallback de-robotization across all personas, reflecting captured words.
- **PR #66** — `/api/admin/llm-smoke-test` to validate structured-output reliability per operation before the env flip.
- **PR #67** — Extend LLM Layer B prompt rules to creative/venue/fan personas.
- **PR #68** — `findPeopleWithOverlappingFandoms` helper + producer-score boost so fandom overlap influences candidate recommendations.

**Schema philosophy:** `RelationshipEdge` remains the foundation of the collaboration graph (per the original deferred-backlog note). The fandom columns on `Person` are the *signal layer* — `RelationshipEdge` becomes derived from fandom overlap among other inputs, not a recreation of it.

## What's real vs scaffolded vs demo

Honest inventory. Update when feature state changes.

| Area | State | Notes |
|------|-------|-------|
| Sagasan persona classifier | Real, deterministic only | LLM gated off; Step 6 P0 closed in PR #16 |
| Sagasan organizer intake | Real, deterministic only | Readiness gate works; reply composition is template-based (Layer B prompt-driven composition deferred until LLM live mode is stable) |
| Sagasan LLM mode | Gated off | `LLM_ACTIVE_LIVE_DISABLED=true`. Invalid model string + `safeLlmReviewText` bug closed in PR #15. **Action item:** update `OPENAI_MODEL` env var in Vercel from `gpt-5.4-mini` to `gpt-4o-mini`. |
| Conversation engine | Shadow mode | `/api/health` reports `conversationEngineMode: "shadow"`, `conversationEngineEffectiveActive: false`. Observable but not active. Gated behind A2P approval. |
| Brief persistence (Project rows) | Real | PR #17 + #24: host briefs persist as `Project` rows linked to `WebSession.projectId`. Idempotent upsert; survives across turns. |
| ProjectJourney state machine | Real + wired | Built in PR #17, wired to chat in PR #24. `intake → brief_ready → crew_reviewing → outreach_prep → outreach_awaiting_send → outreach_sent`. Auto-advance on readiness; soft revert on edit. **Migration must be applied to Neon — see docs/DEPLOY.md.** |
| Brief review page (`/projects/[id]`) | Real | PR #19: server-rendered from Project + journey. Legacy fixture slugs fall through to ProjectWorkspaceView. |
| Build my Crew page (`/projects/[id]/crew`) | Real | PR #20: role list with candidate counts, "no one contacted" badge, auto-advances journey to crew_reviewing on first visit. |
| Candidate review per role (`/projects/[id]/crew/[roleId]`) | Real | PR #21: honesty contract enforced at the type level (`outreachStatus: "not_prepared"` is pinned). Review API at `/api/candidates/[id]/review` auto-advances journey to outreach_prep when every core role has ≥1 approval. |
| "Your projects" landing (`/projects`) | Real | PR #49: server-rendered list of projects owned by the cookie session. Reads `WebSession.projectId`, surfaces the project + journey via `loadProjectsListView`. Today the schema couples a session to one project, so the list has 0 or 1 entries; the page shape is a list so multi-project support can land when an identity layer arrives without changing the page contract. Empty state directs the user to `/chat`. Stable URL: design partners can bookmark `/projects` and always reach either their project or the start-here CTA, even if their cookie session has been replaced. Replaces the fixture-based `ProjectsDashboardView` that previously rendered the demo agency dashboard at this URL. |
| Outreach review (`/projects/[id]/outreach`) | Real | PR #34: 5th tracer page. Surfaces `OutboundDraft` rows (type CANDIDATE_OUTREACH) loaded by `src/lib/projectOutreachView.ts`. Approval API at `/api/projects/[id]/outreach/approve` marks NEEDS_REVIEW drafts as APPROVED and advances journey outreach_prep → outreach_awaiting_send via `src/lib/outreachApproval.ts`. Honesty contract: `outreachStatus` type-pinned to `"not_prepared" \| "draft" \| "approved_to_send" \| "sent"`; "sent" is structurally unreachable today. PR #34 also closed the data-flow gap by wiring `maybeAdvanceToOutreachPrep` in `candidateReview.ts` to call the new `generateCandidateOutreachDraftsForProject(projectId)` sibling of the producer's existing project-brief generator. |
| Per-user auth on tracer API routes | Real (cookie-bound) | PR #37: `src/lib/projectAuth.ts` exports `requireProjectOwnership` + `requireCandidateOwnership`. Wired into `/api/projects/[id]/journey` (GET), `/journey/advance` (POST), `/outreach/approve` (POST), and `/candidates/[id]/review` (POST). Ownership = `WebSession.projectId === <requested-projectId>`, set at `upsertProjectFromBrief` time. 401 for no session, 403 for wrong session, 404 for missing candidate. iOS clients will need bearer-token support added; deferred to Phase 3 (the cookie path uses the same `getExistingSession` lookup, so swapping in a bearer-token reader is one helper away). |
| Per-user auth on tracer page reads | Real (cookie-bound) | PR #48: `sessionOwnsProject(sessionId, projectId)` in `src/lib/projectAuth.ts` is a server-component-friendly variant of `requireProjectOwnership` that takes the session id directly (read via `next/headers` `cookies()`). Wired into `/projects/[slug]`, `/projects/[slug]/crew`, `/projects/[slug]/crew/[roleId]`, and `/projects/[slug]/outreach` page handlers. Non-owning sessions see `notFound()` — cleaner UX than 401 for browsing, and consistent with the "stale cuid" 404 behavior PR #35 added. Sharing a URL cross-session won't work (was already a documented limitation given cuids are unguessable). Defensive: DB error on the ownership check is treated as "not authorized" so misconfigured deploys can't bypass the gate. |
| /explore "0 surfaced" + Beauty Brand label leak | Closed | PR #22: closes P1-OI-3 and P1-OI-4. |
| Legacy `sms-engine/` cleanup | Partial | PR #23 deleted confirmed-dead files. Remaining (uncertain): railway.json, docker-compose.yml, prisma.config.ts, leftover Next.js shell. |
| Talent grid (/explore) | Demo | Picsum-seeded creator cards. Not in tracer. |
| Producer agent | Real | `src/sms-engine/producer/*` (role inference, candidate scoring). Originally admin-only via `ProjectBrief` entry points. PR #50 added a tracer-side orchestrator (`src/lib/projectCrewGeneration.ts`) that runs the same role-map + internal candidate scoring on chat-created Projects. The legacy `persistInternalCandidateRecommendations` keyed on `projectBriefId` is untouched. |
| Crew generation wired into tracer | Real | PR #50: `generateCrewForProject(projectId)` fires on the first `/projects/[id]/crew` visit, materializing producer-generated `RoleOpening` + `Opportunity` rows plus `CandidateRecommendation` rows scored from the internal `CreatorProfile` pool. Idempotent on existing roles. PR #51 seeded a composite `CreatorProfile` pool (`scripts/seed-creator-pool.ts`) so fresh projects now surface actual candidates per role, not "0 candidates" placeholders. The OpenAI web research provider (`src/sms-engine/sourcing/openaiWebResearchProvider.ts`) is not yet wired in; layering it on top is the natural next step once LLM mode is stable. |
| Composite talent pool | Real (seeded) | PR #51: ~18 `Person` + `CreatorProfile` rows tagged `Person.source = DEMO_COMPOSITE` covering every role-type the producer can emit, across the five cities the deterministic classifier recognises (LA, NYC, Brooklyn, Atlanta, Chicago). Honesty: composites carry no phone/email and the candidate card surfaces a "Demo candidate · Composite from public sources" label. Real talent will sit alongside these in production; the source enum makes them distinguishable in queries and UI. Run `npm run seed:creator-pool` after applying the `20260518000000_add_demo_composite_person_source` migration. |
| Candidate research (public web) | Real, admin-only | `src/sms-engine/sourcing/openaiWebResearchProvider.ts` |
| Outreach drafting | Real | `OutboundDraft` rows (type CANDIDATE_OUTREACH) generated by the producer agent and now surfaced to users via `/projects/[id]/outreach` (PR #34). PR #52 layered personalization into the body composer: `composeCandidateOutreachBody` (in `src/sms-engine/producer/outboundDrafts.ts`) now uses the project's actual title verbatim, anchors on fandom overlap when project + candidate share a fandom (with a "redundant if the title already names it" guard), and picks the strongest non-trivial matching reason for the role-fit sentence (skipping pure-proximity and generic-trust signals). Safety contract still enforced — body must contain "open" or "interested" AND "considered". The legacy `Outreach` table is admin-only and not on the tracer path. |
| SMS/Twilio inbound | Real, gated | Webhook, signature validation, intent routing |
| SMS/Twilio outbound | Gated off | `TWILIO_API_CALLS_FORBIDDEN=true`; A2P approval blocked |
| Group chat (ProductionConversation) | Real, gated | Twilio Conversations or MOCK; not surfaced |
| Admin command center | Real | 40+ `/admin/*` pages |
| Public beta admission | Built, gated off | `BetaInviteCode`; `pilotStage: internal_test` |
| Public launch | Disabled | `publicLaunchEnabled: false` |
| Sentry observability | Wired, gated off by default | PR #33: `@sentry/nextjs` installed; `instrumentation.ts` + `sentry.{client,server,edge}.config.ts` initialize the SDK when `SENTRY_DSN` is set. `beforeSend` reuses `redactForLog()` so PII is scrubbed. `captureServerError()` in `src/lib/observability.ts` is the canonical helper. `/api/health` reports `sentry.dsn_configured` without exposing the DSN. To flip live, set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` in Vercel — see docs/DEPLOY.md "Sentry observability runbook." |
| Convergence with `apps/app-server` (main repo) | Not started | Phase 2 work; backend migrates after tracer ships |
| iOS client parity | Not started | Phase 3 work; iOS UI rebuilds against shared backend |

## Open issues / known regressions

**Canonical working list:** `docs/open-issues.md`. As of 2026-05-17 post-merge, 4 P1 items + 32 P2/P3 items remain open. PRs #15–#24 closed the P0s and the LLM latents.

**Deploy operational notes:** `docs/DEPLOY.md` — what to do after a schema-touching PR merges, env-var actions, post-deploy verification.

**CI:** `.github/workflows/ci.yml` runs typecheck, lint, lint:copy, journey state-machine tests on every PR + push to main, plus a separate job that spins up a Postgres service and runs the DB-dependent test suite.

### Top items by severity

**P0 (0 open):** Both P0 items closed in PR #2 — see `docs/open-issues.md` resolved appendix.

**P1 (0 open):** P1-OI-3 / P1-OI-4 closed in PR #22 (/explore Beauty Brand label leak + reset behavior). P1-OI-5 / P1-OI-6 verified closed in PR #40 — regression tests in `src/lib/sagasanAgent.test.ts` exercise the exact strings from the original QA report and pass on every run.

P2/P3: 27 items in `docs/open-issues.md`. Don't expand inline here.

Recently closed (see resolved appendix in `docs/open-issues.md`): P0-OI-1 / P0-OI-2 (Step 6 P0 in PR #16), P1-OI-7 / P1-OI-8 (LLM mode latents in PR #15), P1-OI-3 / P1-OI-4 (/explore label leak in PR #22), P1-OI-5 / P1-OI-6 (persona-classifier subclasses verified in PR #40).

### Step 6 P0 — persona-flip on rich brief (CLOSED in PR #16)
Closed via three converging fixes in `src/lib/sagasanAgent.ts`:
1. Bare-noun creative signals (e.g., `\bphotographer\b`) removed from `CREATIVE_SIGNAL_PATTERNS`. The list is action-phrased only ("looking for gigs", "book me", etc.). Self-identity is still caught via a widened `CREATIVE_SELF_IDENTITY` regex that matches "I'm a/an/the {role}".
2. `inferRateHint` regex rejects `$Nk` / `$Nm` — event budgets are no longer parsed as creative day rates.
3. `inferPortfolioLink` requires possessive framing ("my portfolio", "my Instagram") — passive mentions like "I can send an Instagram reference" no longer mint a portfolio.

The deeper per-project persona latch (via `ProjectJourney`) is still queued for PR #3 + PR #4. Until then, the bare-noun fix and possessive requirement carry the load.

### Legacy `sms-engine/` top-level cleanup
**Symptom:** Every AI assistant reading the repo gets confused by two `sms-engine/` directories.

**Reality:** `src/sms-engine/` is canonical (imports resolve here via `@/sms-engine/*` alias). Top-level `sms-engine/` contains:
- Live: 14 test scripts referenced by `package.json` (import via aliases, so they ARE testing the canonical code).
- Live: ~80 engineering docs at `sms-engine/docs/`.
- Uncertain: `railway.json`, `docker-compose.yml`, `prisma.config.ts`, the leftover Next.js shell (`next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `next-env.d.ts`, `public/`) — may be load-bearing for a separate Railway service; verify before deleting.

**Cleanup state:**
- PR #9 deleted the obviously dead items: `package.json.original`, `package-lock.json.original`, and the unreachable CI workflow at `sms-engine/.github/workflows/ci.yml` (GitHub only reads root `.github/`).
- The next pass (queued, post-Railway verification): move test scripts to `scripts/sms-engine/`, move docs to `docs/engine/`, delete the remaining "uncertain" set, and add a real `.github/workflows/ci.yml` at the repo root that runs the existing test scripts.

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
