# Open Issues Register

Synthesized from the Cowork QA handoff packet (browser-based read-only QA against demo.try-saga.com), as of 2026-05-16. Updated 2026-05-17 to live in the repo as the canonical working list.

**Severity scale:** P0 = blocks design-partner intro / breaks the most important flow. P1 = visible enough to undermine trust in a high-touch demo. P2 = polish, but real. P3 = style refinement.

**Cadence:** Cowork runs a browser walkthrough after each Codex push. Reports land in `qa-reports/raw/` (in Cowork's session — not committed here yet). This file is the human-readable rollup.

**Update protocol:** when an issue ships fixed, move it to the "Resolved — do not re-fix" appendix at the bottom with the closing commit. Don't delete entries; the history matters.

---

## P0 — Open

### P0-OI-1 — Persona re-classification on rich organizer brief silently flips to creative

**Repro:** Fresh session →
1. "I want to throw a formal ball inspired by Love and Deepspace in July"
2. "LA"
3. "don't you need more info?"
4. "Probably 150 people. I don't have a venue yet. I have one photographer friend but no production crew. Budget is maybe $15k. I want it to feel romantic, elegant, and space-inspired. I can send an Instagram reference. I want Saga to help find a producer, stylist, venue lead, and performers."

**Symptom:** Step 4 returns "Got it — I shaped that into your creative profile draft." with an "Open my feed" CTA. Brief progress panel disappears. Click "Open my feed" → `/me?prefill=…` decodes to `{city: "Flexible", roles: ["Photographer","Stylist","Producer"], portfolio: "Sample shared in chat", rates: "$15"}`.

**Root cause (verified by code reading 2026-05-17):**
- `src/lib/sagasanAgent.ts` line ~749: bare-word `/\bphotographer\b/i` in `CREATIVE_SIGNAL_PATTERNS` — matches "I have one photographer friend".
- `src/lib/sagasanAgent.ts` line ~1021: `detectPersonaPivot()` uses loose `strongCreativeSignal` when no anchored persona (organic user without chip click).
- `src/lib/sagasanAgent.ts` lines ~463–483: `inferPortfolioLink` returns "Sample shared in chat" on bare mention of "instagram"; `inferRateHint` regex `/\$[\d,]+/` captures `$15` from `$15k` (drops the `k`).

**Recommended fix (structural):** persona becomes per-project, not per-message. Once an organizer brief has reached ≥5/10 essentials, latch persona for the session. Extraction also distinguishes `userRequests` (roles user wants sourced) from `userOffers` (roles user identifies as their own). See CLAUDE.md "Sagasan Layer A."

**Recommended fix (tactical, if shipping before structural):**
- Require self-identity anchor for bare-noun creative signals (e.g., require "I'm" / "I am" before the noun).
- Drop "instagram" / "ig" from passive portfolio inference.
- Fix rate regex to reject `$Nk` capture as a creative day rate.

### P0-OI-2 — Organizer brief data discarded on persona flip

**Symptom:** When P0-OI-1 fires, the 5-field captured brief (project idea, location, timing, format, vibe) visibly tracked in the dock through Steps 2–4 disappears. User has no recovery path short of resetting and re-typing.

**Recommended fix:** Persist the brief in session state independent of persona. When the classifier wants to flip persona mid-conversation, surface a disambiguation prompt ("Are you the host, or are you offering services?") rather than silently overwriting. Treat brief loss as an explicit user action, not a side effect. Closes alongside P0-OI-1 if persona becomes per-project.

---

## P1 — Open

### P1-OI-3 — /explore "0 surfaced" empty state on real briefs

**Symptom:** Build My Crew prefilled flow auto-fills the `/explore` search field with the full brief string ("Throw A 100-Person Anime Picnic In Silver Lake Next Month With A Playful Neon Vibe"), which over-filters and returns "0 surfaced". The explorer's "Reset" clears dropdown filters but not the search input.

**Recommended fix (pick one):**
- Don't auto-fill the search field; use structured filters (city, role, vibe tags).
- OR make "Reset" also clear the search input.
- OR add a "Closest matches" fallback when strict filters return zero.

Cleanest: option (a). The brief is already represented as filter chips above the grid.

### P1-OI-4 — /explore cold-load still labels "Shortlisting into Beauty Brand Creator Content Day"

**Symptom:** Direct nav to `/explore` (no `projectId`) renders 18 distinct talent cards (good) but the "Shortlisting into" header still reads the old Miami fixture string.

**Recommended fix:** When no `projectId` is present, drop the "Shortlisting into" header (or replace with "Browse all talent"). When `projectId` is present, use the project's actual name. Don't fall back to the Beauty Brand string.

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

### P2-OI-15 — Generic openers "Great." / "Love this." feel chatbot
**Fix:** Drop these or replace with producer-voice acknowledgments that quote a noun from the user's message ("Anime picnic in Silver Lake, got it.").

### P2-OI-16 — Hyphens vs em-dashes inconsistent across producer-voice copy
**Fix:** Pick a house style and apply consistently in the fallback string library.

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

### P2-OI-22 — "Crew is distribution" jargon repeated three times across surfaces without gloss
**Fix:** Add a one-sentence gloss the first time a user sees it.

### P2-OI-23 — "Relay" card type unexplained in For-me feed
**Fix:** Add a definition tooltip or in-context micro-copy.

### P2-OI-24 — "Got it. I tuned that into your event feed setup" served for 4 distinct fan-classified prompts
**Fix:** Vary the acknowledgment by intent.

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

- P0 open: 2 (both from the latest organizer intake regression)
- P1 open: 4 (2 on `/explore`, 2 persona-classifier subclass; the 2 LLM latents closed in PR #1)
- P2 open: 16
- P3 open: 16
- **Total open: 38**

Closing P0-OI-1 and P0-OI-2 indirectly closes P1-OI-5 and P1-OI-6 because the same per-message-vs-session-latch class is upstream of all four.

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
- **P1-OI-7 — invalid `gpt-5.4-mini` model string** — partial fix landed in PR #1. `getConfiguredModel()` now rejects known-invalid model strings at config-read time and falls back to `gpt-4o-mini` (the `BASE_MODEL` constant in code, which was already correct). The production env var on Vercel still needs to be updated separately — once `OPENAI_MODEL` is unset or set to a real model, the warning disappears.
- **P1-OI-8 — `safeLlmReviewText()` placeholder leak** — closed in PR #1. The audit identified this at `src/lib/sagasanAgent.ts ~L981–983` but the function actually lives at `src/sms-engine/llm/qualityReview.ts`. Root cause: `textFromValue()` checked for `replyText`, `message`, `body`, `selectedText`, `organizerFacingSummary` but not `reply`. Schemas with a `reply` field fell through to the "Structured output fields: ..." placeholder. Fix: added `reply` to the key list. Tested with a new regression test in `test-llm-quality-review.ts`.

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
