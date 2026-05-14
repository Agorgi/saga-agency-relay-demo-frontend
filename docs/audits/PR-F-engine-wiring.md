# PR-F Audit — Engine Wiring For Web Chat

**Date:** 2026-05-14
**Branch:** `feature/web-chat/pr-f-engine-wiring`
**Base:** `main` @ `90838a48d070b804df5e94577149fe4a354f7db3`

## Inventory

### 1. `find src/sms-engine -maxdepth 3 -type d | sort`

```text
src/sms-engine
src/sms-engine/access
src/sms-engine/admin
src/sms-engine/cohortSimulation
src/sms-engine/commandCenter
src/sms-engine/conversation
src/sms-engine/dataOps
src/sms-engine/dryRuns
src/sms-engine/graph
src/sms-engine/launchDrill
src/sms-engine/llm
src/sms-engine/llm/prompts
src/sms-engine/matchingEval
src/sms-engine/observability
src/sms-engine/producer
src/sms-engine/publicBeta
src/sms-engine/releaseCandidate
src/sms-engine/sourcing
```

### 2. `find src/sms-engine -maxdepth 3 -type f -name '*.ts' | head -40`

```text
src/sms-engine/releaseCandidate/releaseCandidate.ts
src/sms-engine/cohortSimulation/runCohortSimulation.ts
src/sms-engine/cohortSimulation/cohortReadiness.ts
src/sms-engine/cohortSimulation/cohortPersonas.ts
src/sms-engine/cohortSimulation/cohortTypes.ts
src/sms-engine/producer/roleMap.ts
src/sms-engine/producer/outboundSelfTestReadiness.ts
src/sms-engine/producer/outboundDrafts.ts
src/sms-engine/producer/approvalQueue.ts
src/sms-engine/producer/producerAgentTypes.ts
src/sms-engine/producer/sourcingPlan.ts
src/sms-engine/producer/shortlistDraft.ts
src/sms-engine/producer/index.ts
src/sms-engine/producer/projectUnderstanding.ts
src/sms-engine/producer/candidateRecommendations.ts
src/sms-engine/producer/sendReadiness.ts
src/sms-engine/twilio.ts
src/sms-engine/llm/fallbackProvider.ts
src/sms-engine/llm/openaiProvider.ts
src/sms-engine/llm/llmProvider.ts
src/sms-engine/llm/qualityReview.ts
src/sms-engine/llm/llmTypes.ts
src/sms-engine/llm/prompts/index.ts
src/sms-engine/dataOps/pilotRedaction.ts
src/sms-engine/dataOps/dataClassification.ts
src/sms-engine/dataOps/pilotExport.ts
src/sms-engine/messagingPipeline.ts
src/sms-engine/access/accessControl.ts
src/sms-engine/publicBeta/publicBetaAdmission.ts
src/sms-engine/publicBeta/publicBetaWaitlist.ts
src/sms-engine/publicBeta/publicBetaConfig.ts
src/sms-engine/launchDrill/launchReadinessDrill.ts
src/sms-engine/safety.ts
src/sms-engine/networkCore.ts
src/sms-engine/workflow.ts
src/sms-engine/matchingEval/matchingTuningRecommendations.ts
src/sms-engine/matchingEval/runMatchingEvaluation.ts
src/sms-engine/matchingEval/matchingEvalCandidates.ts
src/sms-engine/matchingEval/matchingEvalFixtures.ts
src/sms-engine/matchingEval/goldenExpectations.ts
```

### 3. `grep -rln 'export ' src/sms-engine/llm 2>/dev/null | head -10`

```text
src/sms-engine/llm/fallbackProvider.ts
src/sms-engine/llm/openaiProvider.ts
src/sms-engine/llm/llmProvider.ts
src/sms-engine/llm/qualityReview.ts
src/sms-engine/llm/llmTypes.ts
src/sms-engine/llm/prompts/index.ts
```

### 4. `grep -rE 'export (async )?function|export const' src/sms-engine | grep -iE 'reply|response|turn|llm|generate|complete' | head -30`

```text
src/sms-engine/llm/fallbackProvider.ts:export async function runFallbackProvider<T extends z.ZodType>({
src/sms-engine/llm/openaiProvider.ts:export async function callOpenAiStructured<T extends z.ZodType>({
src/sms-engine/llm/llmProvider.ts:export async function runStructuredLlmTask<T extends z.ZodType>({
src/sms-engine/conversation/organizerReplyGenerator.ts:export function generateOrganizerReplyFromPlan(input: {
src/sms-engine/conversation/adminDevLlmReplies.ts:export async function generateAdminDevOrganizerReplyWithLlm({
src/sms-engine/conversation/gigSeekerReplyGenerator.ts:export function generateGigSeekerReplyFromPlan(input: {
src/sms-engine/conversation/interestCheckReplyGenerator.ts:export function generateInterestCheckReplyFromPlan(input: {
src/sms-engine/conversation/contactReplyGenerator.ts:export function generateContactReplyFromPlan(input: {
```

### 5. `grep -rE 'process\.env\.LLM_MODE|process\.env\.OPENAI_API_KEY' src/sms-engine | head -10`

```text
src/sms-engine/llm/llmProvider.ts:        apiKey: process.env.OPENAI_API_KEY || "",
src/sms-engine/sourcing/openaiWebResearchProvider.ts:    const apiKey = process.env.OPENAI_API_KEY;
src/sms-engine/sourcing/publicWebResearchProvider.ts:    input.provider === "openai_web_search" && !process.env.OPENAI_API_KEY
src/sms-engine/sourcing/publicWebResearchProvider.ts:    !process.env.OPENAI_API_KEY
```

### 6. `cat src/app/api/web-chat/route.ts` before PR-F

Route contained:
- in-memory `Map<string, Message[]>`
- static stub replies
- `POST` validation and response contract
- no engine imports

### 7. `cat .env.example`

Relevant pre-PR-F entries already existed:

```text
OPENAI_API_KEY=
LLM_MODE=
```

## Engine Entry Point Chosen

There is no single exported `runConversationTurn()`-style helper in `src/sms-engine`. The route now uses the engine’s existing organizer-intake flow as the public entry path:

- `evaluateOrganizerIntakePolicy(...)` to derive organizer state from message history
- `generateOrganizerReplyFromPlan(...)` for the deterministic engine fallback
- `generateAdminDevOrganizerReplyWithLlm(...)` for `LLM_MODE=active_mock`

For `LLM_MODE=live`, the route uses the same organizer context + reply plan, but calls the engine’s lower-level `callOpenAiStructured(...)` directly. This was necessary because the engine’s higher-level `runStructuredLlmTask(...)` currently hard-disables `active_live` internally and would otherwise always fall back.

## Diff Summary

### `src/app/api/web-chat/route.ts`

- removed the PR-E stub reply array
- preserved the in-memory conversation `Map`
- added organizer-context reconstruction from `{ role, content }[]`
- replaced stub selection with engine-backed reply generation
- added route-level `LLM_MODE` normalization:
  - default `active_mock`
  - `live` / `active_live` => live branch
- added `503` response when `LLM_MODE=live` and `OPENAI_API_KEY` is missing
- added `502` response for engine/provider failures

### `.env.example`

- added explicit comment for `OPENAI_API_KEY`
- documented `LLM_MODE=active_mock` default and accepted values

## Env Vars Touched

- `LLM_MODE`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `LLM_TIMEOUT_MS`

## Verification

### Install

`npm install`: PASS

Notable warnings:
- unsupported engine warnings on Node `v23.6.1`
- Prisma deprecation warning for `package.json#prisma`
- deprecated `scmp` and `tar`

### Lint

`npm run lint`: PASS

### Build

`npm run build`: PASS

Build note:
- Next.js emitted an existing NFT tracing warning involving `next.config.js` via `/api/health`
- route build completed successfully, including `/api/web-chat`

### Active-mock dev verification

Command:

```bash
LLM_MODE=active_mock npm run dev
```

HTTP codes:

```text
/ 200
/explore 200
/feed 200
/my-events 200
/post-project 200
/profile 200
/projects 200
/relay 200
/talent 200
/web-chat-test 200
/admin 200
/admin/contacts 307
/beta 200
/api/web-chat empty-body 400
/api/web-chat bad-json 400
```

Happy-path response sample:

```json
{"conversationId":"ea03b6b8-abc8-4577-816a-dc8a2c5145a5","reply":"Great. What city or general location are you thinking for this?","turn":0}
```

Multi-turn sample:

```text
conversationId=35c12899-2647-4d57-8df9-434ce480f611
{"conversationId":"35c12899-2647-4d57-8df9-434ce480f611","reply":"Great. What city or general location are you thinking for this?","turn":1}
```

The response is distinct from PR-E’s stub replies (`"Got it."`, `"Tell me more."`, etc.), which confirms the endpoint is now using engine logic.

### Live mode without key

Command:

```bash
LLM_MODE=live OPENAI_API_KEY= npm run dev
```

Verification:

```text
live-no-key 503
```

Route body:

```json
{"error":"LLM not configured"}
```

### Secret sweeps

```text
OK_AC
OK_SK
```

## Deferred / Not Done In PR-F

- no safety flag or kill switch (`PR-G`)
- no session cookies or real identity (`PR-H`)
- no DB persistence for web chat turns (`PR-H`)
- no widget or `/web-chat-test` changes
- no engine library modifications under `src/sms-engine/**`

## TODOs Surfaced

- The engine currently has no single public chat-turn export; the route composes organizer policy + reply generation directly.
- The engine’s `active_live` path is still disabled inside `runStructuredLlmTask(...)`, so live mode in PR-F uses the lower-level engine OpenAI provider rather than the higher-level runner.
- The organizer flow does not track arbitrary personal facts like names, so multi-turn “what is my name?” behavior is limited to whatever the organizer intake policy naturally supports.

## Deviations

- Worked from a fresh clone at `/Users/alexgorgi/Documents/Playground/saga-agency-relay-demo-frontend-pr-f` because the older local PR workspace had a corrupted worktree with most tracked files missing from disk.
- `LLM_MODE=live` is mapped route-side to a direct engine OpenAI provider call because the engine currently recognizes `active_live` internally and forces that mode back to fallback.
