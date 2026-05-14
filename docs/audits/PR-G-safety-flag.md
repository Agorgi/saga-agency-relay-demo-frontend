# PR-G Audit — Master Kill Switch For Autonomous Web Chat Replies

**Date:** 2026-05-14  
**Branch:** `feature/web-chat/pr-g-safety-flag`  
**Base:** `main` @ `1013b8db25f4d947e8ae951ff9347768c5f450e3`

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

const conversations = new Map<string, ConversationState>();

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
    });
  } catch (error) {
    console.error("Web chat engine request failed", error);
    return json({ error: "Engine error" }, { status: 502 });
  }
}
```

### 2. `cat .env.example`

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

### 3. `grep -rE "WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED" src 2>/dev/null`

```text
```

### 4. `grep -rE "process\.env\." src/app/api/web-chat | sort -u`

```text
src/app/api/web-chat/route.ts:    baseUrl: process.env.OPENAI_BASE_URL || null,
src/app/api/web-chat/route.ts:    const apiKey = process.env.OPENAI_API_KEY?.trim();
src/app/api/web-chat/route.ts:    model: process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
src/app/api/web-chat/route.ts:    timeoutMs: Number.parseInt(process.env.LLM_TIMEOUT_MS || "", 10) || 8000,
src/app/api/web-chat/route.ts:  const mode = normalizeRouteLlmMode(process.env.LLM_MODE);
```

## Holding Reply Chosen

Holding reply text:

```text
Thanks - we've logged your message and will reply soon.
```

Why:
- concise and product-like
- clearly acknowledges receipt
- avoids implying an autonomous reply is underway
- fits the current public app tone without sounding like internal tooling copy

## Diff Summary

### `src/app/api/web-chat/route.ts`

Before:
- validated input
- always called the PR-F route logic after validation
- always returned `{ conversationId, reply, turn }`

After:
- adds `autonomousResponsesEnabled()` helper
- reads `WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED` once in the handler
- gates *before* the engine call
- when disabled:
  - stores user message
  - stores deterministic holding reply
  - returns `{ conversationId, reply, turn, mode: "holding" }`
- when enabled:
  - preserves PR-F behavior
  - returns `{ conversationId, reply, turn, mode: "autonomous" }`
- leaves the `503` and `502` paths intact once autonomous mode is enabled
- adds a TODO seam for future human-review queue wiring

### `.env.example`

Added:

```text
# Master kill switch for autonomous web chat replies.
# When unset or any non-"true" value, the /api/web-chat endpoint accepts and stores
# messages but returns a fixed holding reply WITHOUT calling the LLM/engine.
# Leave disabled in production until human-in-the-loop review is in place.
WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED=false
```

## Mode Field Contract

Route responses now include:

```ts
mode: "autonomous" | "holding"
```

Semantics:
- `"holding"`: endpoint accepted and stored the message, but skipped the engine and returned the deterministic holding reply
- `"autonomous"`: endpoint ran the existing PR-F engine path and returned the autonomous organizer reply

## Verification

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

Build note:
- existing Turbopack NFT tracing warning from `next.config.js` via `/api/health` still appears
- no new warnings from PR-G beyond that

### Disabled (default safe mode)

Command:

```bash
WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED= npm run dev
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
empty 400
bad-json 400
```

Holding reply sample:

```json
{"conversationId":"d4665168-f9b4-41ba-a153-20a9953cd22e","reply":"Thanks - we've logged your message and will reply soon.","turn":0,"mode":"holding"}
```

Multi-turn while disabled:

```text
conversationId=7dbfb201-3e47-4d4d-a46e-a5fe76117d6b
{"conversationId":"7dbfb201-3e47-4d4d-a46e-a5fe76117d6b","reply":"Thanks - we've logged your message and will reply soon.","turn":1,"mode":"holding"}
```

### Enabled (autonomous)

Command:

```bash
WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED=true LLM_MODE=active_mock npm run dev
```

Autonomous sample:

```json
{"conversationId":"19570532-acf4-45fe-b932-e39280822235","reply":"Great. What city or general location are you thinking for this?","turn":0,"mode":"autonomous"}
```

### Enabled + live + no key

Command:

```bash
WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED=true LLM_MODE=live OPENAI_API_KEY= npm run dev
```

Result:

```text
live-no-key 503
```

### Secret sweeps

```text
OK_AC
OK_SK
```

## Still Deferred

- no session or identity model (`PR-H`)
- no DB persistence for chat turns (`PR-H`)
- no human-review queue yet (`PR-H` or later)
- no widget/test-page changes
- no engine-library changes under `src/sms-engine/**`
- no internal-demo UI or downstream operational flow (`PR-I`)

## TODOs Surfaced

- `route.ts` now includes:
  - `TODO: PR-H - enqueue for human review when autonomous responses are disabled.`
- Admin contact route still logs the existing `DATABASE_URL is required before using the database` server-side error before redirecting `307`; PR-G does not change that behavior.

## Deviations

- None functionally. The gate fit cleanly above the PR-F engine call, so no refactor of the engine wiring was needed.
