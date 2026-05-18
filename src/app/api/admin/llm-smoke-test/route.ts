/**
 * POST /api/admin/llm-smoke-test
 *
 * Validation gate for flipping `LLM_ACTIVE_LIVE_DISABLED=false` in
 * production. Exercises the LLM-primary extraction contract (PR #65)
 * by running a fixed set of representative prompts against each
 * persona's structured-output operation, then reports pass/fail +
 * latency + the extracted signals payload per operation.
 *
 *   curl -X POST https://demo.try-saga.com/api/admin/llm-smoke-test \
 *     -H "x-saga-internal-key: $INTERNAL_API_KEY"
 *
 * Auth: gated by `requireInternalApiKey` (same secret as every other
 * /api/admin/* route). 401 if the header is missing or wrong.
 *
 * Behavior: forces `mode: "active_live"` regardless of the
 * `LLM_ACTIVE_LIVE_DISABLED` env flag. This is intentional — the
 * smoke test is what proves the LLM path is healthy before the env
 * flag gets flipped, so it must bypass the flag.
 *
 * Each fixture targets a specific extraction surface the LLM is
 * expected to handle better than the regex layer:
 *   - host_love_and_deepspace: cultural fandom reference + city + scale
 *   - creative_anime_illustrator: role + fandom + interest
 *   - venue_nightclub: regex-gap venue type (PR #65 motivating case)
 *   - venue_speakeasy: another regex-gap venue type
 *   - fan_kpop_brooklyn: identity-graph fandoms across persona
 *
 * Response shape (always 200 unless misconfigured):
 *   {
 *     "model": "gpt-4o-mini",
 *     "apiKeyConfigured": true,
 *     "operations": [
 *       { "name": "venue_nightclub", "persona": "venue",
 *         "ok": true, "latencyMs": 800, "extractedSignals": {...},
 *         "errorCategory": null },
 *       ...
 *     ],
 *     "summary": { "passed": 5, "failed": 0, "totalLatencyMs": 4200 }
 *   }
 *
 * 400 when `OPENAI_API_KEY` is missing — without it the smoke test
 * can't exercise the LLM and pretending otherwise would hide the
 * real configuration error.
 */

import { generateAgentReply, getConfiguredModel } from "@/lib/sagasanAgent";
import type {
  AgentReply,
  LiveAgentExtractedSignals,
} from "@/lib/sagasanAgent";
import type { Persona } from "@/lib/sagasanPersonas";
import { requireInternalApiKey } from "@/sms-engine/internalApiAuth";

export const dynamic = "force-dynamic";

type SmokeFixture = {
  name: string;
  persona: Persona;
  message: string;
};

const FIXTURES: SmokeFixture[] = [
  {
    name: "host_love_and_deepspace",
    persona: "host",
    message:
      "I'm planning a Love and Deepspace formal ball in LA for about 150 people in July.",
  },
  {
    name: "creative_anime_illustrator",
    persona: "creative",
    message: "I'm an illustrator in LA. I make art for anime and cosplay events.",
  },
  {
    name: "venue_nightclub",
    persona: "venue",
    message: "I run a nightclub in Brooklyn, capacity around 200.",
  },
  {
    name: "venue_speakeasy",
    persona: "venue",
    message: "I run a speakeasy in Silver Lake, ~80 capacity.",
  },
  {
    name: "fan_kpop_brooklyn",
    persona: "fan",
    message:
      "I'm in Brooklyn, looking for more K-pop and anime nights around the city.",
  },
];

type SmokeOperationResult = {
  name: string;
  persona: Persona;
  ok: boolean;
  latencyMs: number;
  errorCategory: string | null;
  errorMessage: string | null;
  reply: string;
  extractedSignals: LiveAgentExtractedSignals | null;
};

async function runFixture(
  fixture: SmokeFixture,
  apiKey: string,
): Promise<SmokeOperationResult> {
  const start = Date.now();
  let result: Awaited<ReturnType<typeof generateAgentReply>>;
  try {
    result = await generateAgentReply({
      persona: fixture.persona,
      history: [],
      latestMessage: fixture.message,
      mode: "active_live",
      apiKey,
    });
  } catch (error) {
    return {
      name: fixture.name,
      persona: fixture.persona,
      ok: false,
      latencyMs: Date.now() - start,
      errorCategory: "uncaught_exception",
      errorMessage: error instanceof Error ? error.message : String(error),
      reply: "",
      extractedSignals: null,
    };
  }
  const latencyMs = Date.now() - start;
  const reply: AgentReply = result.data;
  const extractedSignals = reply.llmExtractedSignals ?? null;
  // An operation is "ok" when the LLM call succeeded AND returned a
  // non-null extractedSignals envelope. Empty envelopes (all-null
  // fields) still count as passing — the model decided nothing was
  // worth extracting from this turn, which is valid.
  const ok = result.ok && extractedSignals !== null;
  return {
    name: fixture.name,
    persona: fixture.persona,
    ok,
    latencyMs,
    errorCategory: result.ok ? null : result.errorCategory,
    errorMessage: result.ok ? null : result.errorMessage,
    reply: reply.reply,
    extractedSignals,
  };
}

export async function POST(request: Request) {
  const unauthorized = await requireInternalApiKey(request);
  if (unauthorized) return unauthorized;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        error: "openai_api_key_missing",
        message:
          "OPENAI_API_KEY is not set on this deployment. The smoke test cannot exercise the LLM until it is configured.",
        model: getConfiguredModel(),
        apiKeyConfigured: false,
      },
      { status: 400 },
    );
  }

  const operations: SmokeOperationResult[] = [];
  for (const fixture of FIXTURES) {
    operations.push(await runFixture(fixture, apiKey));
  }

  const passed = operations.filter((op) => op.ok).length;
  const failed = operations.length - passed;
  const totalLatencyMs = operations.reduce(
    (sum, op) => sum + op.latencyMs,
    0,
  );

  return Response.json({
    ok: failed === 0,
    model: getConfiguredModel(),
    apiKeyConfigured: true,
    operations,
    summary: {
      passed,
      failed,
      total: operations.length,
      totalLatencyMs,
    },
  });
}
