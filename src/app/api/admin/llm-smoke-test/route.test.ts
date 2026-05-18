import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { POST } from "@/app/api/admin/llm-smoke-test/route";

const INTERNAL_KEY = "test-internal-api-key-value";

const NULL_SIGNALS = {
  personaSignal: null,
  fandoms: null,
  interests: null,
  city: null,
  projectIdea: null,
  timing: null,
  format: null,
  themeVibe: null,
  expectedAttendance: null,
  lineupStatus: null,
  helpNeeded: null,
  budget: null,
  desiredTalentRoles: null,
  inspirationReferences: null,
  creativeRole: null,
  portfolioStatus: null,
  availability: null,
  rates: null,
  venueType: null,
  venueCapacity: null,
  venueOpenDates: null,
  venueNeighborhood: null,
};

function buildRequest(opts: { withAuth: boolean }): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (opts.withAuth) {
    headers.set("x-saga-internal-key", INTERNAL_KEY);
  }
  return new Request("http://localhost:3000/api/admin/llm-smoke-test", {
    method: "POST",
    headers,
  });
}

type EnvSnapshot = {
  internalKey: string | undefined;
  apiKey: string | undefined;
  baseUrl: string | undefined;
  llmMode: string | undefined;
  llmTimeout: string | undefined;
};

function snapshotEnv(): EnvSnapshot {
  return {
    internalKey: process.env.INTERNAL_API_KEY,
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL,
    llmMode: process.env.LLM_MODE,
    llmTimeout: process.env.LLM_TIMEOUT_MS,
  };
}

function restoreEnv(snap: EnvSnapshot) {
  const restore = (name: keyof EnvSnapshot, envKey: string) => {
    const value = snap[name];
    if (value === undefined) {
      delete process.env[envKey];
    } else {
      process.env[envKey] = value;
    }
  };
  restore("internalKey", "INTERNAL_API_KEY");
  restore("apiKey", "OPENAI_API_KEY");
  restore("baseUrl", "OPENAI_BASE_URL");
  restore("llmMode", "LLM_MODE");
  restore("llmTimeout", "LLM_TIMEOUT_MS");
}

async function startMockOpenAi(
  handler: (
    requestBody: string,
  ) => { status: number; body: unknown } | Promise<{ status: number; body: unknown }>,
): Promise<{ server: Server; baseUrl: string; requestCount: () => number }> {
  let count = 0;
  const server = createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/responses") {
      res.statusCode = 404;
      res.end();
      return;
    }
    count += 1;
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", async () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const result = await handler(body);
      res.statusCode = result.status;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(result.body));
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    requestCount: () => count,
  };
}

function buildOpenAiResponse(opts: {
  message: string;
  signalsOverride?: Record<string, unknown>;
}) {
  const extractedSignals = { ...NULL_SIGNALS, ...(opts.signalsOverride || {}) };
  return {
    id: "resp_test_smoke",
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status: "completed",
    error: null,
    incomplete_details: null,
    model: "gpt-4o-mini",
    output: [
      {
        id: "msg_test_smoke",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              message: opts.message,
              nextStep: null,
              extractedSignals,
            }),
            annotations: [],
          },
        ],
      },
    ],
    temperature: 0.6,
    max_output_tokens: 400,
  };
}

test("llm-smoke-test: 401 when no internal key header", async () => {
  const snap = snapshotEnv();
  process.env.INTERNAL_API_KEY = INTERNAL_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  try {
    const response = await POST(buildRequest({ withAuth: false }));
    assert.equal(response.status, 401);
    const body = (await response.json()) as { ok?: boolean };
    assert.equal(body.ok, false);
  } finally {
    restoreEnv(snap);
  }
});

test("llm-smoke-test: 400 when authorized but OPENAI_API_KEY missing", async () => {
  const snap = snapshotEnv();
  process.env.INTERNAL_API_KEY = INTERNAL_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const response = await POST(buildRequest({ withAuth: true }));
    assert.equal(response.status, 400);
    const body = (await response.json()) as {
      ok: boolean;
      error: string;
      apiKeyConfigured: boolean;
    };
    assert.equal(body.ok, false);
    assert.equal(body.error, "openai_api_key_missing");
    assert.equal(body.apiKeyConfigured, false);
  } finally {
    restoreEnv(snap);
  }
});

test("llm-smoke-test: returns per-operation results when LLM is healthy", async () => {
  const snap = snapshotEnv();
  process.env.INTERNAL_API_KEY = INTERNAL_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.LLM_TIMEOUT_MS = "5000";
  delete process.env.LLM_MODE;

  // Return persona-shaped signals so the response is realistic enough
  // to spot regressions in the merge layer if they show up here.
  let callIndex = 0;
  const responsesByPersona: Array<{
    message: string;
    signals: Record<string, unknown>;
  }> = [
    {
      message: "Got a Love and Deepspace ball in mind — that's a strong start.",
      signals: {
        fandoms: ["Love and Deepspace"],
        city: "Los Angeles",
        projectIdea: "Love and Deepspace formal ball",
        expectedAttendance: "150 people",
        timing: "July",
      },
    },
    {
      message: "An illustrator in LA working on anime and cosplay — got it.",
      signals: {
        creativeRole: "Illustrator",
        city: "Los Angeles",
        fandoms: ["Anime"],
        interests: ["Cosplay"],
      },
    },
    {
      message: "A 200-cap nightclub in Brooklyn — got it.",
      signals: {
        venueType: "Nightclub",
        city: "Brooklyn",
        venueCapacity: "200",
      },
    },
    {
      message: "An 80-cap speakeasy in Silver Lake — got it.",
      signals: {
        venueType: "Speakeasy",
        venueNeighborhood: "Silver Lake",
        venueCapacity: "80",
      },
    },
    {
      message: "K-pop and anime nights in Brooklyn — adding that to your feed.",
      signals: {
        city: "Brooklyn",
        fandoms: ["K-pop", "Anime"],
      },
    },
  ];

  const mock = await startMockOpenAi(() => {
    const slot = responsesByPersona[callIndex] || responsesByPersona[0];
    callIndex += 1;
    return {
      status: 200,
      body: buildOpenAiResponse({
        message: slot.message,
        signalsOverride: slot.signals,
      }),
    };
  });
  process.env.OPENAI_BASE_URL = mock.baseUrl;

  try {
    const response = await POST(buildRequest({ withAuth: true }));
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      ok: boolean;
      model: string;
      apiKeyConfigured: boolean;
      operations: Array<{
        name: string;
        persona: string;
        ok: boolean;
        latencyMs: number;
        errorCategory: string | null;
        reply: string;
        extractedSignals: Record<string, unknown> | null;
      }>;
      summary: { passed: number; failed: number; total: number };
    };

    assert.equal(body.ok, true);
    assert.equal(body.apiKeyConfigured, true);
    assert.equal(body.operations.length, 5);
    assert.equal(body.summary.passed, 5);
    assert.equal(body.summary.failed, 0);
    assert.equal(body.summary.total, 5);

    // Every operation should report a non-null extractedSignals payload
    // — the whole point of the smoke test is to prove the LLM-primary
    // extraction contract from PR #65 fires across personas.
    for (const op of body.operations) {
      assert.equal(op.ok, true, `${op.name} should be ok`);
      assert.equal(op.errorCategory, null, `${op.name} should have no error`);
      assert.ok(op.reply.length > 0, `${op.name} reply should be non-empty`);
      assert.ok(
        op.extractedSignals !== null,
        `${op.name} should have extractedSignals`,
      );
      assert.ok(typeof op.latencyMs === "number" && op.latencyMs >= 0);
    }

    // Spot-check the regex-gap motivating cases for PR #65: the LLM
    // is supposed to be the brain here. If the merge wiring is broken,
    // these fields disappear before the response is serialized.
    const nightclub = body.operations.find((op) => op.name === "venue_nightclub");
    assert.ok(nightclub);
    assert.equal(nightclub?.extractedSignals?.venueType, "Nightclub");

    const speakeasy = body.operations.find((op) => op.name === "venue_speakeasy");
    assert.ok(speakeasy);
    assert.equal(speakeasy?.extractedSignals?.venueType, "Speakeasy");

    // OpenAI was called once per fixture — no caching, no double-calls.
    assert.equal(mock.requestCount(), 5);
  } finally {
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
    restoreEnv(snap);
  }
});

test("llm-smoke-test: reports operations as failed when OpenAI errors", async () => {
  const snap = snapshotEnv();
  process.env.INTERNAL_API_KEY = INTERNAL_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.LLM_TIMEOUT_MS = "2000";
  delete process.env.LLM_MODE;

  const mock = await startMockOpenAi(() => ({
    status: 500,
    body: { error: { message: "internal server error" } },
  }));
  process.env.OPENAI_BASE_URL = mock.baseUrl;

  // The OpenAI SDK logs retry warnings to stderr; silence so test
  // output stays clean.
  const originalWarn = console.warn;
  console.warn = () => undefined;

  try {
    const response = await POST(buildRequest({ withAuth: true }));
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      ok: boolean;
      operations: Array<{
        name: string;
        ok: boolean;
        errorCategory: string | null;
        extractedSignals: Record<string, unknown> | null;
      }>;
      summary: { passed: number; failed: number };
    };

    assert.equal(body.ok, false);
    assert.equal(body.summary.passed, 0);
    assert.equal(body.summary.failed, 5);
    for (const op of body.operations) {
      assert.equal(op.ok, false);
      assert.ok(op.errorCategory, `${op.name} should report an errorCategory`);
      assert.equal(op.extractedSignals, null);
    }
  } finally {
    console.warn = originalWarn;
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
    restoreEnv(snap);
  }
});
