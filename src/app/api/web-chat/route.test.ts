import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/web-chat/route";
import { __setLegacyWebChatDbModeForTests } from "@/lib/webChatSessionStore";

const TEST_DATABASE_URL =
  process.env.PR_L_TEST_DATABASE_URL ||
  "postgresql://saga@127.0.0.1:5433/saga_agency_relay_demo?schema=public";

async function resetWebChatTables() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;

  const prisma = new PrismaClient({
    datasourceUrl: TEST_DATABASE_URL,
  });

  await prisma.webChatMessage.deleteMany();
  await prisma.webSession.deleteMany();
  await prisma.webChatRuntimeSettingAudit.deleteMany();
  await prisma.webChatRuntimeSetting.deleteMany();
  await prisma.$disconnect();
}

async function readLatestAssistantMessage() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const prisma = new PrismaClient({
    datasourceUrl: TEST_DATABASE_URL,
  });

  const message = await prisma.webChatMessage.findFirst({
    where: { role: "assistant" },
    orderBy: { createdAt: "desc" },
  });

  await prisma.$disconnect();
  return message;
}

function createRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/web-chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createGetRequest({
  conversationId,
  sessionId,
  persona,
}: {
  conversationId?: string | null;
  sessionId?: string | null;
  persona?: string | null;
} = {}) {
  const url = new URL("http://localhost:3000/api/web-chat");
  if (conversationId) {
    url.searchParams.set("conversationId", conversationId);
  }

  const cookies = [
    sessionId ? `web_session_id=${sessionId}` : null,
    persona ? `saga_persona=${persona}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  return new NextRequest(url, {
    method: "GET",
    headers: cookies ? { cookie: cookies } : undefined,
  });
}

test.beforeEach(async () => {
  await resetWebChatTables();
  __setLegacyWebChatDbModeForTests(null);
  process.env.WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED = "true";
  delete process.env.OPENAI_BASE_URL;
  delete process.env.OPENAI_MODEL;
});

test("web chat POST returns an autonomous mock reply in mock mode", async () => {
  process.env.LLM_MODE = "mock_active";
  process.env.OPENAI_API_KEY = "";

  const response = await POST(
    createRequest({
      message:
        "I want to throw a formal ball inspired by Love and Deepspace in Los Angeles in July. Probably 150 people. I don't have a venue yet. I have one photographer friend but no production crew. Budget is maybe $15k. Here's a Pinterest board. I want Saga to help find a producer, stylist, venue lead, and maybe performers.",
      persona: "host",
    }),
  );

  const data = (await response.json()) as {
    reply: string;
    mode: string;
    nextStep?: { route?: string };
  };

  assert.equal(response.status, 200);
  assert.equal(data.mode, "autonomous");
  assert.ok(data.reply.length > 0);
  assert.match(data.nextStep?.route ?? "", /^\/projects\/(new|c[a-z0-9]+)$/, "host nextStep should target /projects/new (legacy) or /projects/<cuid> (PR #31 binding to persisted Project)");
});

test("host nextStep gets rewritten to /projects/<projectId> when the brief persists as a Project", async () => {
  // Closes the missing tracer-handoff piece flagged by Cowork QA:
  // when the chat persists a Project row, the chat API should rewrite
  // the agent's legacy /projects/new?prefill=base64 handoff to
  // /projects/<projectId> so the client reaches the new DB-backed
  // brief review page (PR #19).
  process.env.LLM_MODE = "mock_active";
  process.env.OPENAI_API_KEY = "";

  const response = await POST(
    createRequest({
      message:
        "I want to throw a formal ball inspired by Love and Deepspace in Los Angeles in July. Probably 150 people. I don't have a venue yet. I have one photographer friend but no production crew. Budget is maybe $15k. Here's a Pinterest board. I want Saga to help find a producer, stylist, venue lead, and maybe performers.",
      persona: "host",
    }),
  );

  const data = (await response.json()) as {
    nextStep?: { route?: string; prefill?: Record<string, unknown> };
    projectId?: string | null;
    journey?: { step?: string } | null;
  };

  assert.equal(response.status, 200);
  // Project was created.
  assert.ok(data.projectId, "expected projectId to be set");
  assert.match(data.projectId || "", /^c[a-z0-9]+$/);
  // Journey advanced past intake.
  assert.equal(data.journey?.step, "brief_ready");
  // nextStep is now bound to the new tracer surface.
  assert.equal(data.nextStep?.route, `/projects/${data.projectId}`);
  // Prefill is empty for the DB-backed page (no base64 needed).
  assert.deepEqual(data.nextStep?.prefill ?? {}, {});
});

test("persona chips pass structured hints through the route", async () => {
  process.env.LLM_MODE = "mock_active";
  process.env.OPENAI_API_KEY = "";

  const cases = [
    {
      label: "host",
      personaHint: "host",
      message: "I want to host something.",
      expectedPersona: "host",
      expectedOperation: "sagasan_host_intake",
    },
    {
      label: "creative",
      personaHint: "creative",
      message: "I'm a creative looking for work.",
      expectedPersona: "creative",
      expectedOperation: "sagasan_creative_intake",
    },
    {
      label: "venue",
      personaHint: "venue",
      message: "I run a space.",
      expectedPersona: "venue",
      expectedOperation: "sagasan_venue_intake",
    },
    {
      label: "fan",
      personaHint: "fan",
      message: "I'm here to find cool stuff.",
      expectedPersona: "fan",
      expectedOperation: "sagasan_fan_intake",
    },
  ] as const;

  for (const scenario of cases) {
    await resetWebChatTables();
    const response = await POST(
      createRequest({
        message: scenario.message,
        personaHint: scenario.personaHint,
      }),
    );

    const data = (await response.json()) as {
      persona: string | null;
      reply: string;
    };

    assert.equal(response.status, 200, scenario.label);
    assert.equal(data.persona, scenario.expectedPersona, scenario.label);

    const assistantMessage = await readLatestAssistantMessage();
    assert.ok(assistantMessage, scenario.label);
    assert.equal(assistantMessage?.persona, scenario.expectedPersona, scenario.label);
    assert.equal(assistantMessage?.operation, scenario.expectedOperation, scenario.label);
  }
});

test("free-form first turns classify correctly without persona hints", async () => {
  process.env.LLM_MODE = "mock_active";
  process.env.OPENAI_API_KEY = "";

  const cases = [
    {
      label: "host",
      message: "I want to throw an anime picnic in Silver Lake next month.",
      expectedPersona: "host",
    },
    {
      label: "creative",
      message: "I'm a photographer in LA looking for anime event gigs.",
      expectedPersona: "creative",
    },
    {
      label: "venue",
      message: "I run a small venue in Brooklyn.",
      expectedPersona: "venue",
    },
    {
      label: "fan",
      message: "I want to find cool anime events near me.",
      expectedPersona: "fan",
    },
  ] as const;

  for (const scenario of cases) {
    await resetWebChatTables();
    const response = await POST(
      createRequest({
        message: scenario.message,
      }),
    );

    const data = (await response.json()) as {
      persona: string | null;
    };

    assert.equal(response.status, 200, scenario.label);
    assert.equal(data.persona, scenario.expectedPersona, scenario.label);
  }
});

test("web chat POST hits OpenAI in live mode when a key is present", async () => {
  process.env.LLM_MODE = "active_live";
  process.env.OPENAI_API_KEY = "test-key";

  let requestCount = 0;
  let receivedBody = "";

  const server = createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/responses") {
      res.statusCode = 404;
      res.end();
      return;
    }

    requestCount += 1;
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      receivedBody = Buffer.concat(chunks).toString("utf8");
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          id: "resp_test_live",
          object: "response",
          created_at: Math.floor(Date.now() / 1000),
          status: "completed",
          error: null,
          incomplete_details: null,
          model: "gpt-4o-mini",
          output: [
            {
              id: "msg_test_live",
              type: "message",
              role: "assistant",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    message: "That is enough to build your event draft.",
                    nextStep: {
                      label: "Build my event",
                      route: "/projects/new",
                      prefill: {
                        eventType: "Pop-up / activation",
                        city: "Los Angeles",
                        scale: "100 people",
                        vibe: "Anime pop-up",
                        projectType: "Pop-up / activation",
                        suggestedRoles: ["Producer", "Photographer"],
                      },
                    },
                  }),
                  annotations: [],
                },
              ],
            },
          ],
          temperature: 0.6,
          max_output_tokens: 400,
        }),
      );
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;

  try {
    const response = await POST(
      createRequest({
        message:
          "I want to host a 100-person anime pop-up in Los Angeles with a playful neon vibe.",
        persona: "host",
      }),
    );

    const data = (await response.json()) as {
      reply: string;
      mode: string;
      nextStep?: { route?: string };
    };

    assert.equal(response.status, 200);
    assert.equal(data.mode, "autonomous");
    assert.match(data.nextStep?.route ?? "", /^\/projects\/(new|c[a-z0-9]+)$/, "host nextStep should target /projects/new (legacy) or /projects/<cuid> (PR #31 binding to persisted Project)");
    assert.match(data.reply, /event draft/i);
    assert.equal(requestCount, 1);
    assert.match(receivedBody, /Reply with Sagasan's next message/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("live mode without a key falls back to deterministic Sagasan copy", async () => {
  process.env.LLM_MODE = "active_live";
  process.env.OPENAI_API_KEY = "";

  const response = await POST(
    createRequest({
      message: "I want to throw an anime picnic in Silver Lake next month.",
      personaHint: "host",
    }),
  );

  const data = (await response.json()) as {
    reply: string;
    mode: string;
  };

  assert.equal(response.status, 200);
  assert.equal(data.mode, "autonomous");
  assert.match(data.reply, /budget|venue status|help/i);
  assert.doesNotMatch(data.reply, /we['’]ve logged your message/i);
});

test("web chat POST stays up without database env vars", async () => {
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL_NON_POOLING;
  process.env.LLM_MODE = "mock_active";
  process.env.OPENAI_API_KEY = "";
  process.env.WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED = "";

  const response = await POST(
    createRequest({
      message: "I want to host something.",
      personaHint: "host",
    }),
  );

  const data = (await response.json()) as {
    reply: string;
    mode: string;
  };

  assert.equal(response.status, 200);
  assert.equal(data.mode, "holding");
  assert.match(data.reply, /project idea|city|timing|budget/i);
});

test("holding mode keeps the next-step handoff when the brief is routeable", async () => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;
  process.env.LLM_MODE = "mock_active";
  process.env.OPENAI_API_KEY = "";
  process.env.WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED = "";

  const response = await POST(
    createRequest({
      message:
        "I want to throw a formal ball inspired by Love and Deepspace in Los Angeles in July. Probably 150 people. I don't have a venue yet. I have one photographer friend but no production crew. Budget is maybe $15k. Here's a Pinterest board. I want Saga to help find a producer, stylist, venue lead, and maybe performers.",
    }),
  );

  const data = (await response.json()) as {
    mode: string;
    nextStep?: { route?: string; prefill?: { city?: string; projectIdea?: string } };
  };

  assert.equal(response.status, 200);
  assert.equal(data.mode, "holding");
  assert.match(data.nextStep?.route ?? "", /^\/projects\/(new|c[a-z0-9]+)$/, "host nextStep should target /projects/new (legacy) or /projects/<cuid> (PR #31 binding to persisted Project)");
  // When PR #31 rebinds the route to /projects/<cuid>, the page reads
  // from the DB so prefill is empty. The legacy /projects/new path
  // still carries the prefill (city + projectIdea).
  if (data.nextStep?.route === "/projects/new") {
    assert.equal(data.nextStep?.prefill?.city, "Los Angeles");
    assert.match(data.nextStep?.prefill?.projectIdea || "", /formal ball/i);
  }
});

test("production-like legacy DB mode still returns reply and nextStep", async () => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;
  process.env.LLM_MODE = "mock_active";
  process.env.OPENAI_API_KEY = "";
  process.env.WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED = "true";
  __setLegacyWebChatDbModeForTests(true);

  const response = await POST(
    createRequest({
      message:
        "I want to throw a formal ball inspired by Love and Deepspace in Los Angeles in July. Probably 150 people. I don't have a venue yet. I have one photographer friend but no production crew. Budget is maybe $15k. Here's a Pinterest board. I want Saga to help find a producer, stylist, venue lead, and maybe performers.",
    }),
  );

  const data = (await response.json()) as {
    reply: string;
    mode: string;
    nextStep?: { route?: string; prefill?: { city?: string } };
  };

  assert.equal(response.status, 200);
  assert.equal(data.mode, "autonomous");
  assert.match(data.reply, /partial brief|production plan|crew search/i);
  assert.match(data.nextStep?.route ?? "", /^\/projects\/(new|c[a-z0-9]+)$/, "host nextStep should target /projects/new (legacy) or /projects/<cuid> (PR #31 binding to persisted Project)");
  // Prefill only present on the legacy /projects/new fallback;
  // /projects/<cuid> reads from the DB.
  if (data.nextStep?.route === "/projects/new") {
    assert.equal(data.nextStep?.prefill?.city, "Los Angeles");
  }

  const assistantMessage = await readLatestAssistantMessage();
  assert.ok(assistantMessage);
  assert.equal(assistantMessage?.role, "assistant");
  assert.equal(assistantMessage?.content.length > 0, true);
});

test("legacy GET session payload keeps assistant content even when metadata columns are unavailable", async () => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;
  process.env.LLM_MODE = "mock_active";
  process.env.OPENAI_API_KEY = "";
  process.env.WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED = "true";
  __setLegacyWebChatDbModeForTests(true);

  const postResponse = await POST(
    createRequest({
      message:
        "I want to throw a formal ball inspired by Love and Deepspace in Los Angeles in July. Probably 150 people. I don't have a venue yet. I have one photographer friend but no production crew. Budget is maybe $15k. Here's a Pinterest board. I want Saga to help find a producer, stylist, venue lead, and maybe performers.",
    }),
  );
  const postData = (await postResponse.json()) as {
    conversationId: string;
    persona: string | null;
  };

  const sessionCookie = postResponse.cookies.get("web_session_id")?.value ?? null;
  assert.ok(sessionCookie);

  const getResponse = await GET(
    createGetRequest({
      conversationId: postData.conversationId,
      sessionId: sessionCookie,
      persona: postData.persona,
    }),
  );
  const getData = (await getResponse.json()) as {
    persona: string | null;
    messages: Array<{
      role: string;
      content: string;
      nextStep: unknown;
    }>;
  };

  assert.equal(getResponse.status, 200);
  assert.equal(getData.persona, "host");
  const assistantMessage = getData.messages.find((message) => message.role === "assistant");
  assert.ok(assistantMessage);
  assert.match(assistantMessage?.content || "", /partial brief|production plan|crew search/i);
  assert.equal(assistantMessage?.nextStep ?? null, null);
});
