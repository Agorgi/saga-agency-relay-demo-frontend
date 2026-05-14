# PR-H Audit — Anonymous Session Cookie + DB-Backed Web Chat History

**Date:** 2026-05-14  
**Branch:** `feature/web-chat/pr-h-identity-and-persistence`  
**Base:** `main` @ `7df8ab82e485ed5f8140fba6cfbe793711023c74`

## Inventory

### 1. `cat src/app/api/web-chat/route.ts`

```ts
import { generateAdminDevOrganizerReplyWithLlm } from "@/sms-engine/conversation/adminDevLlmReplies";
import { evaluateOrganizerIntakePolicy } from "@/sms-engine/conversation/organizerIntakePolicy";
import { generateOrganizerReplyFromPlan } from "@/sms-engine/conversation/organizerReplyGenerator";
import {
  conversationContextSchema,
  type ConversationContext,
  type OrganizerGeneratedReply,
  type ReplyPlan,
} from "@/sms-engine/conversation/conversationTypes";
import { callOpenAiStructured } from "@/sms-engine/llm/openaiProvider";
import {
  forbiddenClaimsGuidance,
  sagaLlmSystemPrompt,
  sagaVoiceGuidelines,
} from "@/sms-engine/llm/prompts";
import { intakeReplySchema } from "@/sms-engine/producerAgent";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ConversationState = {
  messages: ChatMessage[];
};

type RouteLlmMode = "active_mock" | "live";
type ReplyMode = "autonomous" | "holding";

const conversations = new Map<string, ConversationState>();
const HOLDING_REPLY = "Thanks - we've logged your message and will reply soon.";

const LIVE_INSTRUCTIONS = [
  sagaLlmSystemPrompt,
  sagaVoiceGuidelines,
  forbiddenClaimsGuidance,
].join("\n");

export const dynamic = "force-dynamic";

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(data, { ...init, headers });
}

function normalizeRouteLlmMode(value: string | undefined): RouteLlmMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "live" || normalized === "active_live") {
    return "live";
  }
  return "active_mock";
}

function autonomousResponsesEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function toPriorMessage(
  message: ChatMessage,
  index: number,
): ConversationContext["priorMessages"][number] {
  return {
    id: `web_chat_${index}`,
    direction: message.role === "user" ? "INBOUND" : "OUTBOUND",
    channel: "SMS",
    body: message.content,
    createdAt: new Date((index + 1) * 1000).toISOString(),
  };
}

function createBaseContext(
  priorMessages: ConversationContext["priorMessages"] = [],
): ConversationContext {
  return conversationContextSchema.parse({
    normalizedPhone: null,
    intent: "ORGANIZER_PROJECT_IDEA",
    priorMessages,
    knownFields: {},
    gigSeekerKnownFields: {},
    interestCheckKnownFields: {},
    contactReplyKnownFields: {},
    missingRequiredFields: ["city", "projectConcept", "scopeOrVibe"],
    missingOptionalFields: [
      "targetDate",
      "budgetRange",
      "expectedAudienceSize",
      "helpNeeded",
    ],
    hasCompletedFirstTimeHostQuestion: false,
    optedOut: false,
    safetyFlags: [],
    providerMode: "MOCK",
    sendsDisabled: true,
    allowlistResult: "not_applicable",
    currentStage: "NEW",
  });
}

function rebuildConversationContext(history: ChatMessage[]): ConversationContext {
  let priorMessages: ConversationContext["priorMessages"] = [];
  let context = createBaseContext();

  history.forEach((message, index) => {
    if (message.role === "user") {
      const evaluation = evaluateOrganizerIntakePolicy({
        context,
        latestMessage: message.content,
      });
      const hasCompletedFirstTimeHostQuestion =
        context.hasCompletedFirstTimeHostQuestion ||
        (evaluation.knownFields.firstTimeHost !== null &&
          evaluation.knownFields.firstTimeHost !== undefined);

      context = conversationContextSchema.parse({
        ...context,
        knownFields: evaluation.knownFields,
        missingRequiredFields: evaluation.missingRequiredFields,
        missingOptionalFields: evaluation.missingOptionalFields,
        hasCompletedFirstTimeHostQuestion,
        safetyFlags: evaluation.safetyFlags,
        currentStage: evaluation.replyPlan.nextStage,
      });
    }

    priorMessages = [...priorMessages, toPriorMessage(message, index)];
    context = conversationContextSchema.parse({
      ...context,
      priorMessages,
    });
  });

  return context;
}

function buildOrganizerReplyPrompt({
  context,
  replyPlan,
  latestMessage,
}: {
  context: ConversationContext;
  replyPlan: ReplyPlan;
  latestMessage: string;
}) {
  return `
Admin/dev mock organizer reply language only. The backend state machine has
already selected the stage and next question; rewrite only the reply language.
Do not change workflow state. Ask at most one clear question. Do not promise
bookings, payment, revenue, attendance, venue access, confirmed team members,
celebrity/influencer participation, or group-chat inclusion.

Latest organizer message:
${latestMessage}

ReplyPlan JSON:
${JSON.stringify({
  flow: replyPlan.flow,
  stage: replyPlan.stage,
  nextStage: replyPlan.nextStage,
  nextQuestion: replyPlan.nextQuestion,
  enoughInfoForBrief: replyPlan.enoughInfoForBrief,
  shouldEscalate: replyPlan.shouldEscalate,
  explanationForAudit: replyPlan.explanationForAudit,
})}

Known context JSON:
${JSON.stringify({
  knownFields: context.knownFields,
  missingRequiredFields: context.missingRequiredFields,
  missingOptionalFields: context.missingOptionalFields,
})}

Return JSON with message, confidence, needsAdmin, and reason.
  `.trim();
}

async function generateLiveReply({
  context,
  replyPlan,
  latestMessage,
  fallbackReply,
  apiKey,
}: {
  context: ConversationContext;
  replyPlan: ReplyPlan;
  latestMessage: string;
  fallbackReply: OrganizerGeneratedReply;
  apiKey: string;
}) {
  const response = await callOpenAiStructured({
    apiKey,
    baseUrl: process.env.OPENAI_BASE_URL || null,
    model: process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
    timeoutMs: Number.parseInt(process.env.LLM_TIMEOUT_MS || "", 10) || 8000,
    schema: intakeReplySchema,
    schemaName: "organizer_reply_language",
    instructions: LIVE_INSTRUCTIONS,
    prompt: buildOrganizerReplyPrompt({
      context,
      replyPlan,
      latestMessage,
    }),
  });

  if (!response.ok) {
    console.error("Web chat engine live reply failed", {
      errorCategory: response.errorCategory,
      statusCode: response.statusCode ?? null,
      responseId: response.responseId ?? null,
    });
    return null;
  }

  return response.data.message || fallbackReply.replyText;
}

async function generateReply({
  history,
  latestMessage,
  mode,
}: {
  history: ChatMessage[];
  latestMessage: string;
  mode: RouteLlmMode;
}) {
  const context = rebuildConversationContext(history);
  const evaluation = evaluateOrganizerIntakePolicy({
    context,
    latestMessage,
  });
  const fallbackReply = generateOrganizerReplyFromPlan({
    context,
    replyPlan: evaluation.replyPlan,
    latestMessage,
  });

  if (mode === "live") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return { error: "LLM not configured" as const, reply: null };
    }

    const liveReply = await generateLiveReply({
      context,
      replyPlan: evaluation.replyPlan,
      latestMessage,
      fallbackReply,
      apiKey,
    });

    if (!liveReply) {
      return { error: "Engine error" as const, reply: null };
    }

    return { error: null, reply: liveReply };
  }

  const reply = await generateAdminDevOrganizerReplyWithLlm({
    context,
    replyPlan: evaluation.replyPlan,
    latestMessage,
    fallbackReply,
    conversationEngineMode: "mock_active",
  });

  return { error: null, reply: reply.replyText };
}

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return json({ error: "Message must be a non-empty string." }, { status: 400 });
  }

  const { message, conversationId: rawConversationId } = body as {
    conversationId?: unknown;
    message?: unknown;
  };

  if (typeof message !== "string" || message.trim().length === 0) {
    return json({ error: "Message must be a non-empty string." }, { status: 400 });
  }

  const conversationId =
    typeof rawConversationId === "string" && rawConversationId.trim().length > 0
      ? rawConversationId.trim()
      : crypto.randomUUID();

  const state = conversations.get(conversationId) ?? { messages: [] };
  const assistantTurn = state.messages.filter(
    (entry) => entry.role === "assistant",
  ).length;
  const latestMessage = message.trim();
  const autonomousEnabled = autonomousResponsesEnabled(
    process.env.WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED,
  );

  if (!autonomousEnabled) {
    // TODO: PR-H - enqueue for human review when autonomous responses are disabled.
    state.messages.push(
      { role: "user", content: latestMessage },
      { role: "assistant", content: HOLDING_REPLY },
    );
    conversations.set(conversationId, state);

    return json({
      conversationId,
      reply: HOLDING_REPLY,
      turn: assistantTurn,
      mode: "holding" satisfies ReplyMode,
    });
  }

  const mode = normalizeRouteLlmMode(process.env.LLM_MODE);

  try {
    const result = await generateReply({
      history: state.messages,
      latestMessage,
      mode,
    });

    if (result.error === "LLM not configured") {
      return json({ error: "LLM not configured" }, { status: 503 });
    }

    if (result.error || !result.reply) {
      return json({ error: "Engine error" }, { status: 502 });
    }

    state.messages.push(
      { role: "user", content: latestMessage },
      { role: "assistant", content: result.reply },
    );
    conversations.set(conversationId, state);

    return json({
      conversationId,
      reply: result.reply,
      turn: assistantTurn,
      mode: "autonomous" satisfies ReplyMode,
    });
  } catch (error) {
    console.error("Web chat engine request failed", error);
    return json({ error: "Engine error" }, { status: 502 });
  }
}
```

### 2. `cat prisma/schema.prisma | head -120`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ProjectStatus {
  NEW_INBOUND
  INTAKE_IN_PROGRESS
  BRIEF_READY_FOR_REVIEW
  ROLE_MAPPING_READY
  OUTREACH_DRAFTED
  OUTREACH_IN_PROGRESS
  SHORTLIST_READY
  SHORTLIST_SENT
  GROUPCHAT_PENDING
  GROUPCHAT_ACTIVE
  PRODUCTION_IN_PROGRESS
  ARCHIVED
  NEEDS_ADMIN
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum MessageChannel {
  SMS
  GROUP_SMS
  ADMIN
}

enum InboundProcessingJobStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED
  SKIPPED_DUPLICATE
  BLOCKED
}

enum OutreachStatus {
  DRAFTED
  SENT
  INTERESTED
  NOT_INTERESTED
  MAYBE
  NO_RESPONSE
  APPROVED_FOR_GROUPCHAT
}

enum GroupChatStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  DONE
  BLOCKED
}

enum AuditActorType {
  SYSTEM
  ADMIN
  USER
  CONTACT
  LLM
}

enum PersonSource {
  SMS
  APP
  ADMIN
  IMPORT
  PUBLIC
}

enum ConsentStatus {
  UNKNOWN
  IMPLIED
  EXPLICIT
  OPTED_OUT
}

enum ProfileReviewStatus {
  PENDING_REVIEW
  APPROVED
  REJECTED
  NEEDS_MORE_INFO
}

enum NetworkProjectSource {
  SMS
  MOBILE_APP
  WEB_APP
  ADMIN
  INTEREST_CHECK
  IMPORT
}

enum NetworkProjectStatus {
  INTAKE
  BRIEF_READY
  ROLE_MAPPING
  RECRUITING
  SHORTLIST_READY
  TEAM_FORMING
  IN_PRODUCTION
  ARCHIVED
  NEEDS_ADMIN
}

enum CompensationType {
```

### 3. `ls prisma/migrations/ | tail -10`

```text
20260510050000_beta_cohort_simulation
20260510060000_talent_discovery_research_engine
20260510070000_talent_research_quality_review
20260510080000_public_web_research_shadow
20260510090000_public_web_research_live_dry_run
20260510100000_public_web_research_async_jobs
20260510110000_public_web_research_review_cleanup
20260510120000_candidate_graph_foundation
20260510130000_relationship_aware_matching
20260511010000_conversation_autonomy_settings
```

### 4. `grep -rE "cookies\(\)|setCookie|cookie:" src/app 2>/dev/null | head -20`

```text
```

### 5. `grep -rE "PrismaClient|prisma\." src/app | head -20`

```text
```

### 6. `cat .env.example`

```text
# Engine
ADMIN_PASSWORD=
APP_BASE_URL=
CONVERSATION_ENGINE_ACTIVE=
CONVERSATION_ENGINE_MODE=
DATABASE_URL=
INTERNAL_API_KEY=
LLM_DAILY_CALL_CAP=
LLM_LOG_OUTPUTS=
LLM_LOG_PROMPTS=
LLM_TIMEOUT_MS=
MESSAGE_PROCESSING_MODE=
MESSAGING_PROVIDER=
NODE_ENV=
# Required when LLM_MODE=live; ignored when LLM_MODE=active_mock
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=
PORT=
RAILWAY_ENVIRONMENT=

# Pilot
PILOT_MAX_ACTIVE_PARTICIPANTS=
PILOT_PRIVACY_URL=
PILOT_REPLY_MODE=
PILOT_STAGE=
PILOT_SUPPORT_CONTACT=
PILOT_TERMS_URL=
PRIVATE_BETA_MAX_ACTIVE_PARTICIPANTS=

# Public beta / launch
PUBLIC_BETA_ENABLED=
PUBLIC_BETA_LANDING_ENABLED=
PUBLIC_BETA_MAX_ACTIVE_PARTICIPANTS=
PUBLIC_BETA_NEW_USER_DAILY_CAP=
PUBLIC_BETA_PUBLIC_NUMBER_VISIBLE=
PUBLIC_BETA_REQUIRE_CONSENT=
PUBLIC_BETA_REQUIRE_INVITE_CODE=
PUBLIC_BETA_WAITLIST_ENABLED=
PUBLIC_LAUNCH_ENABLED=

# Public web research
PUBLIC_WEB_RESEARCH_ALLOWED_DOMAINS=
PUBLIC_WEB_RESEARCH_BLOCKED_DOMAINS=
PUBLIC_WEB_RESEARCH_ENABLED=
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED=
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_MAX_QUERIES=
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_TAG=
PUBLIC_WEB_RESEARCH_MAX_RESULTS=
PUBLIC_WEB_RESEARCH_MODE=
PUBLIC_WEB_RESEARCH_PROVIDER=
PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS=
PUBLIC_WEB_RESEARCH_STORE_RAW_RESULTS=

# SMS safety / runtime
SMS_ACCESS_MODE=
SMS_ALLOWED_NUMBERS=
SMS_AUTONOMOUS_REPLY_DAILY_CAP=
SMS_COMPLIANCE_APPROVED=
SMS_DAILY_INBOUND_CAP=
SMS_DAILY_SEND_CAP=
SMS_PER_NUMBER_DAILY_SEND_CAP=
SMS_REQUIRE_ALLOWLIST=
SMS_SENDS_DISABLED=

# active_mock | live - defaults to active_mock if unset
LLM_MODE=active_mock

# Master kill switch for autonomous web chat replies.
# When unset or any non-"true" value, the /api/web-chat endpoint accepts and stores
# messages but returns a fixed holding reply WITHOUT calling the LLM/engine.
# Leave disabled in production until human-in-the-loop review is in place.
WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED=false

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_API_CALLS_FORBIDDEN=
TWILIO_AUTH_TOKEN=
TWILIO_CONVERSATIONS_SERVICE_SID=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_PHONE_NUMBER=
TWILIO_STAGING_MODE=
TWILIO_VALIDATE_WEBHOOKS=
```

### 7. `grep -rE "credentials:\s*['\"]include['\"]|fetch\(['\"]\/api\/web-chat" src/components 2>/dev/null`

```text
src/components/web-chat/ChatWidget.tsx:      const response = await fetch("/api/web-chat", {
```

## Cookie Pattern Chosen

Pattern A: opaque random/opaque session id cookie.

Reason:
- there is no existing signed-cookie utility in the app
- the session is anonymous and carries no privileges
- the simplest safe thing is to store `WebSession.id` directly in an httpOnly cookie and treat missing/unknown ids as “create a fresh session”

Implementation detail:
- cookie name: `web_session_id`
- cookie value: `WebSession.id`
- `httpOnly`, `sameSite: "lax"`, `secure` only in production, `path=/`, `maxAge=30 days`

## Migration

Migration filename:

```text
prisma/migrations/20260514184642_add_web_session_and_web_chat_message/migration.sql
```

Summary:
- creates `WebSession`
- creates `WebChatMessage`
- adds one `createdAt` index on `WebSession`
- adds one `(sessionId, conversationId, createdAt)` index on `WebChatMessage`
- adds one FK from `WebChatMessage.sessionId -> WebSession.id`

Verified:
- migration touches no existing table

## New Session Store Module

Added:

```text
src/lib/webChatSessionStore.ts
```

Exports:
- `getOrCreateSession(req)`
- `appendTurn(...)`
- cookie name + max-age constants

Decision on `userAgent` / `ipHash`:
- `userAgent`: captured from the request and stored on session create, preserved/updated on reuse
- `ipHash`: left `null` in PR-H to avoid inventing hashing policy or secret material before it is needed

## `route.ts` Diff Summary

Before:
- module-scope in-memory `Map<string, Message[]>`
- no cookie identity
- no DB reads/writes
- PR-G kill switch stored holding/autonomous turns in memory only

After:
- imports `NextRequest` / `NextResponse`
- creates/loads an anonymous `WebSession` via cookie
- loads prior conversation history from `WebChatMessage`
- removes the in-memory `Map`
- persists both user + assistant rows via `appendTurn(...)`
- sets `web_session_id` cookie on the first successful valid POST without one
- replaces the PR-G TODO with a persistence comment in the holding branch
- preserves the locked response shape:
  - `{ conversationId, reply, turn, mode }`

Behavior notes:
- holding branch persists user + holding reply before returning
- autonomous branch persists user + engine reply only after the engine succeeds
- 400/502/503 behavior is preserved

## Verification

Temp database used:

```text
postgresql://saga@127.0.0.1:5433/saga_agency_relay_demo?schema=public
```

### Lint

```text
npm run lint
PASS
```

### Build

```text
npm run build
PASS
```

### Cookie set on first request

Command:

```bash
curl -s -c /tmp/web-chat-cookies.txt -X POST http://localhost:3000/api/web-chat \
  -H 'Content-Type: application/json' -d '{"message":"hello there"}' -i
```

Sample:

```text
HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json
set-cookie: web_session_id=cmp5ucqxk0000lwag2cy119gq; Path=/; Expires=Sat, 13 Jun 2026 18:48:02 GMT; Max-Age=2592000; HttpOnly; SameSite=lax
```

Body:

```json
{"conversationId":"2315ba1a-d177-46d4-bf69-943ce9c6b24b","reply":"Thanks - we've logged your message and will reply soon.","turn":0,"mode":"holding"}
```

Cookie jar evidence:

```text
#HttpOnly_localhost	FALSE	/	FALSE	1781376482	web_session_id	cmp5ucqxk0000lwag2cy119gq
```

### Cookie reused

Command:

```bash
curl -s -b /tmp/web-chat-cookies.txt -X POST http://localhost:3000/api/web-chat \
  -H 'Content-Type: application/json' -d '{"message":"second one"}'
```

Sample:

```json
{"conversationId":"9aa607bf-47b7-4c6c-8e35-c309566a0505","reply":"Thanks - we've logged your message and will reply soon.","turn":0,"mode":"holding"}
```

### Same conversationId increments turn

```text
conversationId=ac0382ac-f5bf-4e5b-9936-20dfc63023dd
{"conversationId":"ac0382ac-f5bf-4e5b-9936-20dfc63023dd","reply":"Thanks - we've logged your message and will reply soon.","turn":1,"mode":"holding"}
```

### DB row counts

After the first disabled-mode sequence:

```text
sessions 1
messages 8
```

Final counts after restart test + autonomous sample:

```text
sessions 2
messages 12
```

### Restart persistence

After stopping and restarting the dev server, reusing the same cookie jar and same `conversationId`:

```json
{"conversationId":"ac0382ac-f5bf-4e5b-9936-20dfc63023dd","reply":"Thanks - we've logged your message and will reply soon.","turn":2,"mode":"holding"}
```

This confirms the route is stateless across restarts and turn count comes from the DB.

### Autonomous path with persistence

Command:

```bash
DATABASE_URL='postgresql://saga@127.0.0.1:5433/saga_agency_relay_demo?schema=public' \
WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED=true \
LLM_MODE=active_mock \
npm run dev
```

Sample:

```json
{"conversationId":"c1eaafc5-63f9-42c3-a301-fab5ef359067","reply":"Great. What city or general location are you thinking for this?","turn":0,"mode":"autonomous"}
```

### Public + admin smoke

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
```

### Secret sweeps

```text
OK_AC
OK_SK
```

## TODOs Surfaced

- human-review queue/UI is still not implemented; PR-H only guarantees durable storage
- `ipHash` capture remains intentionally null
- no session cleanup / TTL / GC job yet
- no admin tooling yet for browsing `WebSession` / `WebChatMessage`

## Still Not Done

- no login / password / OAuth / non-anonymous identity
- no review queue UI or admin route
- no widget or test-page changes
- no engine-library modifications under `src/sms-engine/**`
- no change to kill-switch semantics
- no new npm dependencies

## Deviations

- Model ids use `cuid()` instead of `uuid()` to match the existing schema’s conventions.
- No new env var was added because the opaque-cookie pattern did not require a signing secret.
