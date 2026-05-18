# Open Issues Register

Synthesized from the Cowork QA handoff packet (browser-based read-only QA against demo.try-saga.com), as of 2026-05-16. Updated 2026-05-17 to live in the repo as the canonical working list.

**Severity scale:** P0 = blocks design-partner intro / breaks the most important flow. P1 = visible enough to undermine trust in a high-touch demo. P2 = polish, but real. P3 = style refinement.

**Cadence:** Cowork runs a browser walkthrough after each Codex push. Reports land in `qa-reports/raw/` (in Cowork's session — not committed here yet). This file is the human-readable rollup.

**Update protocol:** when an issue ships fixed, move it to the "Resolved — do not re-fix" appendix at the bottom with the closing commit. Don't delete entries; the history matters.

---

## P0 — Open

_No P0 items open as of PR #2. Both P0-OI-1 and P0-OI-2 closed by the Step 6 P0 structural fix — see "Resolved" appendix._

---

## P1 — Open

### P1-OI-5 — "Cosplay cafe night Brooklyn" misclassified as venue, not host

**Symptom:** "Thinking about a cosplay cafe night in Brooklyn" classifies as venue (replies "your space profile draft", "Open my spaces", "List a space"). Venue-shaped noun "cafe" outweighs host intent verb "thinking about throwing".

**Recommended fix:** Re-rank intent verbs ("throw", "host", "plan", "thinking about", "want to do") over object nouns when both are present. Indirectly closed by the P0 session-latch fix because the same per-message-vs-session-latch class is upstream.

### P1-OI-6 — "DM that photographer right now" enrolls user as creative instead of producing outbound-action boundary

**Symptom:** Imperative directed at a named third party gets keyword-classified as creative because of the noun "photographer". Should be a boundary turn — Saga doesn't send outbound on behalf of users without human review.

**Recommended fix:** Treat imperatives directed at third parties ("DM that photographer", "text my friends", "tell them to come") as boundary turns. Reply with the outbound-action boundary copy ("Saga can help prepare outreach, but it won't contact anyone until a human reviews and approves it."). Not persona classification.

---

## P2 — Open

### P2-OI-9 — Time-bound fan questions fall to generic lane router
"Where should I go this weekend?" / "What's happening on Friday?" → "I can route hosts, creatives, venues, and fans. Which lane fits you best?" instead of fan setup.
**Fix:** Default time-bound discovery questions to fan persona setup.

### P2-OI-10 — Edge boundary prompts fall to generic lane router
"Can you book my whole team for an event?" / "Am I 100% sure I'll book gigs?" → generic lane router instead of mirroring the paid-work boundary tone.
**Fix:** Expand the boundary fallback library to cover team-booking and outcome-guarantee prompts.

### P2-OI-11 — "Open my feed" creative CTA routes to /me, not /feed
**Fix:** Rename button to "Open my profile" (cleaner — `/me` is the creative's home dashboard, not a feed surface).

### P2-OI-12 — Public event page hero is meta-narration about the system
"The rave public page sells scarce tickets while backstage Saga tracks DJ, social, volunteer, and photo roles…" — internal product framing aimed at a Saga reader, not a fan landing from a share link.
**Fix:** Replace with a normal fan-facing event tagline.

### P2-OI-13 — Cold-load top-right CTA uses persisted localStorage persona
On a fresh tab where localStorage has a prior persona, the top-right CTA shows the prior persona's CTA before any new turn. Reads as stale on the empty landing state.
**Fix:** Reset the top-right CTA to the neutral default on landing/empty state unless persona-on-cold-load is a deliberate feature.

### P2-OI-14 — /projects/new shows EVENT TYPE = "Fan event" on host-oriented prefill
Cosmetic — brief still creates correctly. **Fix:** Map host intent to a host-appropriate event type label.

### ~~P2-OI-15~~ — closed in PR #38
Audit found no bare "Great." / "Love this." openers in the current Sagasan fallback library. Likely closed earlier when the producer-voice copy was tightened. Verified clean by exhaustive grep + producer-voice review.

### ~~P2-OI-16~~ — closed in PR #38
Code already standardizes on em-dashes (—) for parentheticals across all four Sagasan reply files. PR #38 adds a regression-prevention rule to `scripts/lint-copy.ts` that scans `sagasanAgent.ts`, `sagasanOrganizerIntake.ts`, `sagasanSystemPrompt.ts`, and `hostBriefHandoff.ts` for ` - ` (space-hyphen-space) inside string literals and fails the lint if found. Comment-stripped first so example copy in comments doesn't trigger.

### P2-OI-17 — /admin/observability fallback-rate widget shows 0 while RECENT FALLBACKS = 27
Operator dashboard misleading. **Fix:** Either rate calc is wrong or time-window mismatch — resolve.

### P2-OI-18 — /admin/llm-review header packs three concepts into one |-delimited string
**Fix:** Label fields explicitly: `Selected reply | Configured model | Fallback reason`.

### P2-OI-19 — "LLM output: Not captured" conflates "never called OpenAI" and "called and failed"
**Fix:** Distinguish the two failure modes in `/admin/llm-review`.

### P2-OI-20 — For-me feed shows Sammi Smith twice (once as OPPORTUNITY, once as RELAY) with identical copy
**Fix:** Dedupe by ID, OR make the two card types substantively different.

### P2-OI-21 — Top-nav "Discover" button non-functional pre-classification
Clicking "Discover" before persona is classified does nothing. Nav labels that change behavior based on hidden state are a navigation antipattern.
**Fix:** Either make it functional pre-classification, or hide it.

### ~~P2-OI-22~~ — closed in PR #38
Two surfaces fixed: (1) the bare "Crew is distribution" pill in `AssemblyView.tsx`'s metrics row (between concrete launch-readiness + estimated-reach chips) was dropped — pill chips don't have room for a gloss. (2) The "Role board" Panel kept the slogan as its eyebrow but gained a `description` prop on the Panel component carrying a one-sentence gloss: "The crew Saga books is your audience reach — every role doubles as a distribution channel into the fandom they bring." The four other surfaces in `ProjectDetailView`, `CreateProjectFlow`, and `sagaPlatformData` already had inline explanations and were left alone.

### ~~P2-OI-23~~ — closed in PR #38
`ForMeView.tsx` Relay card's `detail` label changed from "Relay" (gnomic) to "Saga outreach" (self-explanatory). The fallback title is "Outreach thread" (was "Relay thread") and the action label is "Open thread" (was "Open relay"). Conveys that Saga is messaging a candidate on the viewer's behalf without requiring users to learn what "Relay" means.

### ~~P2-OI-24~~ — closed in PR #38
The fan persona's success reply now varies by extracted `city` + `interests`. Four branches in `buildFanSuccessReply` (`src/lib/sagasanAgent.ts`): both → "Got it — I'll tune your feed for [interests] in [city]."; city only → "Got it — I'll watch what's stirring in [city]."; interests only → "Got it — I'll surface [interests] events near you."; neither → "Got it — I tuned that into your event feed setup." (canonical fallback). A `FAN_INTEREST_STOPWORDS` filter strips question-stem words ("where", "should", etc.) the inferInterestTags extractor sometimes captures, so the variant reply never surfaces "tune your feed for Where and Should." Regression test in `sagasanAgent.test.ts`.

### P2-OI-37 — Vercel preview environment has no DATABASE_URL, so PR previews can't exercise DB-dependent code paths
**Symptom:** PR #34's Cowork re-test couldn't validate the chat→outreach tracer end-to-end because `bindNextStepToProject` (PR #35) requires a successful `upsertProjectFromBrief` write, and there's no DB on preview. Cowork verified the fix code is in the deployed bundle but couldn't observe the rewrite firing.

**Root cause:** the Neon Storage integration scopes `DATABASE_URL` / `POSTGRES_URL_NON_POOLING` to Production only. The integration owns those vars (badged with the Neon icon), so Vercel's per-variable "add Preview scope" toggle doesn't appear on them — the scope is controlled inside the Neon↔Vercel integration settings, which requires Neon dashboard login to edit.

**Workarounds for now:**
- Verify DB-dependent flows on production after merge (the path used for PR #34).
- For PR-specific testing, run the branch locally with a dev Neon connection string.

**Real fix:** sign into https://console.neon.tech → the Saga project → Integrations → Vercel → add "Preview" to the environment-scope multi-select. Or: manually create Preview-only override env vars on Vercel by copying values from the integration-managed rows (Cowork can do this once you give explicit OK to reveal the values). After either change, redeploy PR previews and the DB-dependent code paths will exercise.

---

## P3 — Open

### P3-OI-25 — `/explore` "Why this person" rationale template feels formulaic at scale
**Fix:** Mix in concrete proof points alongside the "recurring X cues" pattern ("worked the last 3 anime activations in LA", "DJ'd 2024 LA Comic-Con afterparty").

### P3-OI-26 — Ticketing chat reply doesn't offer next step
"Tickets live elsewhere — Saga doesn't handle those." dead-ends the conversation.
**Fix:** Add "I can pull up the public page if you want the link" or similar.

### P3-OI-27 — Tag-chip tokenization at display layer
"Jujutsu Kaisen" renders as separate "Jujutsu" / "Kaisen" chips. **Fix:** Tokenize at the data layer.

### P3-OI-28 — Light-mode toggle label reads "Light mode" while in light mode
**Fix:** Display destination state ("Dark mode") to communicate what the click will do.

### P3-OI-29 — `/explore` search placeholder references Miami beauty project regardless of brief
**Fix:** Bind placeholder to current project.

### P3-OI-30 — For-me feed projects all show same next-move text "Review recommended roles"
**Fix:** Differentiate by actual project state.

### P3-OI-31 — Empty avatar circles next to user-sent messages
**Fix:** Default initial or generic icon.

### P3-OI-32 — Sagasan reply asks two questions in one turn
"Have you hosted something like this before, or would this be your first one?" — violates one-question-per-turn rule.

### P3-OI-33 — No breadcrumbs from /talent/:slug back to project / explorer

### P3-OI-34 — Top-nav surface inconsistent across pages
Present on `/`, `/me`, `/feed`, `/events/:slug`, `/talent/:slug`. Absent on `/projects/new`.

### P3-OI-35 — Event cover imagery is generic stock landscape
Site sells as the AI agency for anime events; cards use stock landscape photos that don't signal genre.

### P3-OI-36 — "Reset to landing" doesn't visibly clear chat scroll
Landing chips re-render at top but prior conversation remains visible below. Next message functionally resets.

### P3-OI-37 — `"portfolio": "Sample shared in chat"` placeholder in creative handoff
**Fix:** Confirm intent and either remove or bind to real user content before design partners see it.

### P3-OI-38 — Brief content not surfaced after "I shaped that into a draft event brief"
**Fix:** Render a short brief-summary message ("Event: rooftop summer party • City: Brooklyn • Date: June 21 • Size: ~80 • Vibe: house, natural wine") after the acknowledgment.

### P3-OI-39 — City-deferred venue/creative CTA suppression isn't explained in reply
**Fix:** Surface "Tell me your city and I'll list this space" so the suppressed CTA doesn't look like a stale-CTA bug.

### P3-OI-40 — BRIEF PROGRESS counter vs visible Known list don't reconcile
Counter ticks 5 → 6 between turns but the visible Known list shows 5 fields. **Fix:** Re-display all known fields or expose the counter calculation transparently.

---

## Summary counts

- P0 open: 0 (closed in PR #16)
- P1 open: 2 (persona-classifier subclasses — likely indirectly closed by PR #16, pending Cowork re-verification on staging; /explore items closed in PR #22)
- P2 open: 16
- P3 open: 16
- **Total open: 34**

---

## Resolved — do NOT re-fix

These have been closed by prior pushes. Listed so future work doesn't accidentally re-open them.

- **PR-L (#12) post-merge regression** — "Thanks - we've logged your message and will reply soon." on every turn. Closed by PR #13 + hydration/CTA fixes.
- **PR #13 preview 500** — missing `WebChatRuntimeSetting.llm_mode` migration. Closed by Codex's preview-safe no-DB fallback.
- **Creative-path render P1** — UI silently dropped the assistant turn. Closed by commit `1f1c129`.
- **Build My Crew Miami Beauty Brand fixture** (prefilled flow) — closed in `fa5b281`.
- **Talent cards all named "Adriana Lupini" with identical image** — closed in `fa5b281`.
- **/for-me and /discover 404s** — closed in `fa5b281`. They redirect now (`/for-me` → `/me`, `/discover` → `/feed`).
- **/projects/new dead-end empty state** — closed in `fa5b281`.
- **Reset-to-landing state bleed across sessions** — closed in `fa5b281` (via `?new=1`).
- **Creative prefill carrying host event date/vibe as availability** — closed in `fa5b281`.
- **Trust boundary "Are these people confirmed?" being routed to fan feed** — closed in `fa5b281`.
- **Host backstage panel exposed on public event page** — closed in `fa5b281` ("Launch readiness 42%, Open Production Workspace" no longer leaks).
- **Chat ticketing copy contradicting event-page ticket tiers** — closed in `fa5b281` (both surfaces disclaim ticketing is external).
- **Build My Crew brief handoff and candidate credibility** — closed in `e9e7bc6` (today). `buildMyCrewContracts.ts` enforces brief_handoff vs demo_seed.
- **P1-OI-7 — invalid `gpt-5.4-mini` model string** — partial fix landed in PR #15. `getConfiguredModel()` now rejects known-invalid model strings at config-read time and falls back to `gpt-4o-mini`. Production env var on Vercel still needs updating separately.
- **P1-OI-8 — `safeLlmReviewText()` placeholder leak** — closed in PR #15. Function lives at `src/sms-engine/llm/qualityReview.ts`; added `reply` to the `textFromValue` key list. Regression test in `test-llm-quality-review.ts`.
- **P0-OI-1 — Persona re-classification on rich organizer brief** — closed in PR #16. Bare-noun creative signals removed from `CREATIVE_SIGNAL_PATTERNS`; `CREATIVE_SELF_IDENTITY` regex widened to "I'm a/an/the {role}"; `inferRateHint` rejects `$Nk`/`$Nm`; `inferPortfolioLink` requires possessive framing. Three new regression tests cover the Step 6 scenario, $Nk parsing, and possessive vs passive portfolio inference.
- **P0-OI-2 — Organizer brief data discarded on persona flip** — closed alongside P0-OI-1 in PR #16. Persona no longer flips → brief isn't dropped. Deeper per-project latch via `ProjectJourney` shipped in PR #17/#24.
- **P1-OI-3 — /explore "0 surfaced" empty state on real briefs** — closed in PR #22. `useAgencyStore.resetTalentFilters` now also clears `talentSearchQuery` so the Reset button wipes both filters and search.
- **P1-OI-4 — /explore cold-load shows Beauty Brand fixture label** — closed in PR #22. `ExploreTalentView` only shows "Shortlisting into …" when the URL explicitly indicates a project (`projectIdParam` or `projectSlug`). Otherwise the header is suppressed.
- **/explore cold-load shows 0 cards regression** — closed in PR #32. PR #22's fix for the Beauty Brand label leak removed the default-project fallback in `activeProject` resolution, which inadvertently emptied the grid on cold-load (because `buildCrewRecommendationState` returns empty `candidateGroups` when project is null). PR #32 introduces `buildBrowseAllTalentState` in `src/lib/buildMyCrewContracts.ts`: when no `activeProject`, `ExploreTalentView` renders an honest "Browse all talent" surface populated from `TALENT_PROFILES`, grouped by primary role, capped at 18 cards / 6 per role. The page header switches to "Browse talent / Demo profiles, grouped by role." and the empty-state CTA reads "Browse demo profiles below, or tell Saga what you're planning for a project-scored shortlist." Cards stay `sourceMode: demo_seed`, `contacted: false`, `confirmed: false`, `contactabilityStatus: "Human review required"`.
- **ProjectJourney state machine** — built in PR #17 (Prisma model, service, API routes) and wired to Sagasan in PR #24 (host briefs persist to Project rows; journey auto-advances on readiness; chat API returns `projectId` + `journey` to client).
- **Brief review page (`/projects/[id]`)** — shipped in PR #19.
- **Build my Crew page (`/projects/[id]/crew`)** — shipped in PR #20.
- **Candidate review per role (`/projects/[id]/crew/[roleId]`) + review API** — shipped in PR #21. Honesty contract pinned at the type level (`outreachStatus: "not_prepared"`).
- **Legacy `sms-engine/` partial cleanup** — PR #23 deleted `.original` package files + dead nested CI workflow. Remaining: railway.json, docker-compose.yml, prisma.config.ts, leftover Next.js shell (`next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `next-env.d.ts`, `public/`) — verify Railway state before deleting.
- **Sentry observability wired** — closed in PR #33. `@sentry/nextjs` installed; `instrumentation.ts` + `sentry.{client,server,edge}.config.ts` initialize the SDK when `SENTRY_DSN` is set. `beforeSend` and `beforeBreadcrumb` route every event through `redactForLog()` so PII never leaves the runtime. `captureServerError()` in `src/lib/observability.ts` is the canonical server-error helper (writes structured log line + forwards to Sentry when DSN is configured). Three raw `console.error` sites + one `logServerError` site in `src/app/api/web-chat/route.ts` migrated. `/api/health` reports `sentry.dsn_configured` (DSN value never exposed). Error boundaries added at `src/app/error.tsx` + `src/app/global-error.tsx`. SDK is gated off by default — set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` in Vercel to flip live. See `docs/DEPLOY.md` "Sentry observability runbook."
- **Chat → project persistence rewrite** — closed in PR #35. Cowork's P0 finding on PR #34's QA: the "Review brief" CTA was still routing to `/projects/new?prefill=…` even when the chat had persisted a real Project row, so the entire downstream tracer was unreachable. Root cause: `bindNextStepToProject` (the helper that rewrites `/projects/new` → `/projects/<cuid>` after persistence) had never landed in the codebase. PR #35 adds the helper, wires it into both return paths of `src/app/api/web-chat/route.ts` AFTER persistence so the bound route is what gets stored in `WebChatMessage.nextStep` + `WebChatMessage.route` (so session-restore paths get the same route the POST response served). `getPersonaFromNextStep` updated to recognise `/projects/<cuid>` as host. New explicit regression test in `route.test.ts` locks the contract.
- **/projects/[slug] blank-page on cuid miss** — closed in PR #35. The bare-route handler used to render empty chrome when a cuid-shaped slug didn't resolve to a Project. Now calls `notFound()` so stale links surface a real 404. Closes Cowork's cross-PR P2 finding.
- **Tracer page 5 — `/projects/[id]/outreach`** — shipped in PR #34. `src/lib/projectOutreachView.ts` loads `OutboundDraft` rows of type CANDIDATE_OUTREACH joined to candidate + role; `src/lib/outreachApproval.ts` marks NEEDS_REVIEW drafts as APPROVED and advances journey outreach_prep → outreach_awaiting_send. Approval API at `/api/projects/[id]/outreach/approve`. Honesty contract: `outreachStatus` type-pinned to `"not_prepared" | "draft" | "approved_to_send" | "sent"`; "sent" is structurally unreachable. PR #34 also closed the data-flow gap by wiring `maybeAdvanceToOutreachPrep` in `candidateReview.ts` to call `generateCandidateOutreachDraftsForProject(projectId)` — a new project-id sibling of the producer's existing project-brief-id draft generator. The 5-page tracer is now complete end-to-end (gated by PR #35's persistence rewrite landing first).
- **Per-user auth on tracer API routes** — closed in PR #37. `src/lib/projectAuth.ts` exports `requireProjectOwnership(req, projectId)` and `requireCandidateOwnership(req, candidateId)`. Wired into `/api/projects/[id]/journey` (GET), `/api/projects/[id]/journey/advance` (POST), `/api/projects/[id]/outreach/approve` (POST), and `/api/candidates/[id]/review` (POST). Closes all four `TODO(auth)` markers. Ownership = `WebSession.projectId === <requested-projectId>`, set at `upsertProjectFromBrief` time. 401 for no session, 403 for wrong session, 404 for missing candidate. 10 new tests in `projectAuth.test.ts` lock the contract. Note: auth currently reads the `web_session_id` cookie only; iOS clients will need a bearer-token reader added before Phase 3 — single-helper extension, deferred.

---

## Things to NOT do (rails inherited from QA)

These are the same rails Cowork has operated under across every audit pass. Match them when shipping code:

- Do NOT flip `SMS_SENDS_DISABLED` to enable sends.
- Do NOT enable `publicLaunchEnabled` or `publicBetaEnabled`.
- Do NOT wire the demo to a real Saga production app (`pilot.manualGates` "No production Saga app integration" is currently a required_boundary — relaxed for the Phase 2 backend convergence).
- Do NOT send SMS.
- Do NOT contact candidates / invite design partners.
- Do NOT change Twilio config.
- Do NOT auto-run `prisma migrate deploy` against production Neon without coordinating with the migration playbook (`POSTGRES_URL_NON_POOLING` needs to be set in the build env first — discovered during PR #13).

These overlap with CLAUDE.md's "Never do" section. The canonical statement is in CLAUDE.md; this list is the operational mirror.
