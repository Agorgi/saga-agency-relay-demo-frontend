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
    projectId?: string | null;
  };

  assert.equal(response.status, 200);
  assert.equal(data.mode, "autonomous");
  assert.ok(data.reply.length > 0);
  // The before-each hook configures DATABASE_URL, so persistence
  // succeeds and bindNextStepToProject rewrites /projects/new →
  // /projects/<cuid>.
  assert.match(data.nextStep?.route || "", /^\/projects\/[a-z0-9]{8,}$/);
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
                    // PR #65: every field in the extractedSignals schema
                    // is nullable per OpenAI strict-mode rules. The
                    // mock has to fill all of them (most as null) for
                    // Zod's responses.parse to accept the response.
                    extractedSignals: {
                      personaSignal: null,
                      fandoms: ["anime"],
                      interests: ["pop-ups"],
                      city: "Los Angeles",
                      projectIdea: "100-person anime pop-up",
                      timing: null,
                      format: "Pop-up / activation",
                      themeVibe: "Anime pop-up",
                      expectedAttendance: "100 people",
                      lineupStatus: null,
                      helpNeeded: null,
                      budget: null,
                      desiredTalentRoles: ["Producer", "Photographer"],
                      inspirationReferences: null,
                      creativeRole: null,
                      portfolioStatus: null,
                      availability: null,
                      rates: null,
                      venueType: null,
                      venueCapacity: null,
                      venueOpenDates: null,
                      venueNeighborhood: null,
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
      projectId?: string | null;
    };

    assert.equal(response.status, 200);
    assert.equal(data.mode, "autonomous");
    // DB present → bindNextStepToProject rewrites /projects/new → /projects/<cuid>
    assert.match(data.nextStep?.route || "", /^\/projects\/[a-z0-9]{8,}$/);
    assert.match(data.reply, /event draft/i);
    assert.equal(requestCount, 1);
    assert.match(receivedBody, /Reply with Sagasan's next message/);

    // PR #67: the LLM's extractedSignals (`fandoms: ["anime"]`,
    // `interests: ["pop-ups"]`) must reach the session's Person row,
    // not just live in the response payload. This is the identity-
    // graph wire — without it, the cross-fandom matching in PR #68
    // has nothing to match against.
    const prisma = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
    try {
      const person = await prisma.person.findFirst({
        where: { source: "APP" },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(person, "LLM-mode chat must create a session Person");
      const fandoms = (person.fandoms ?? []).map((f) => f.toLowerCase());
      const interests = (person.interests ?? []).map((i) => i.toLowerCase());
      assert.ok(
        fandoms.includes("anime"),
        `Person.fandoms missing 'anime' from LLM signals — got ${JSON.stringify(person.fandoms)}`,
      );
      assert.ok(
        interests.includes("pop-ups"),
        `Person.interests missing 'pop-ups' from LLM signals — got ${JSON.stringify(person.interests)}`,
      );
    } finally {
      await prisma.$disconnect();
    }
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
    nextStep?: { route?: string; prefill?: Record<string, string | string[]> };
    projectId?: string | null;
  };

  assert.equal(response.status, 200);
  assert.equal(data.mode, "holding");
  // With a DB present, persistence succeeds and bindNextStepToProject
  // rewrites /projects/new → /projects/<cuid>. Prefill is stripped
  // because the brief review page reads from the Project row, not
  // from URL params.
  assert.ok(data.projectId, "persistence should yield a projectId");
  assert.equal(data.nextStep?.route, `/projects/${data.projectId}`);
  assert.match(data.nextStep?.route || "", /^\/projects\/[a-z0-9]{8,}$/);
  assert.deepEqual(data.nextStep?.prefill, {});
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
    nextStep?: { route?: string; prefill?: Record<string, string | string[]> };
    projectId?: string | null;
  };

  assert.equal(response.status, 200);
  assert.equal(data.mode, "autonomous");
  assert.match(data.reply, /partial brief|production plan|crew search/i);
  // Legacy DB mode still drives upsertProjectFromBrief → projectId
  // → bindNextStepToProject rewrite. Route lands on the cuid form.
  assert.ok(data.projectId, "legacy DB path should still persist a Project");
  assert.equal(data.nextStep?.route, `/projects/${data.projectId}`);
  assert.match(data.nextStep?.route || "", /^\/projects\/[a-z0-9]{8,}$/);
  assert.deepEqual(data.nextStep?.prefill, {});

  const assistantMessage = await readLatestAssistantMessage();
  assert.ok(assistantMessage);
  assert.equal(assistantMessage?.role, "assistant");
  assert.equal(assistantMessage?.content.length > 0, true);
});

test("web chat persistence regression — nextStep route uses the persisted projectId, not /projects/new", async () => {
  // Locks in the Cowork-reported regression fix from PR #34's QA pass:
  // before this fix the chat CTA still pointed at /projects/new, which
  // 404'd the entire downstream tracer (/crew, /outreach). The
  // bindNextStepToProject helper rewrites the route to /projects/<id>
  // once persistence succeeds. This test would have caught the
  // missing rewrite immediately.
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;
  process.env.LLM_MODE = "mock_active";
  process.env.OPENAI_API_KEY = "";
  process.env.WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED = "true";

  const response = await POST(
    createRequest({
      message:
        "I want to throw a formal ball inspired by Love and Deepspace in Los Angeles in July. Probably 150 people. I don't have a venue yet. I have one photographer friend but no production crew. Budget is maybe $15k. Here's a Pinterest board. I want Saga to help find a producer, stylist, venue lead, and maybe performers.",
      persona: "host",
    }),
  );

  const data = (await response.json()) as {
    nextStep?: { route?: string; prefill?: Record<string, string | string[]> };
    projectId?: string | null;
  };

  // The fix the regression demanded:
  assert.ok(data.projectId, "host brief should persist and return projectId");
  assert.notEqual(data.nextStep?.route, "/projects/new");
  assert.equal(data.nextStep?.route, `/projects/${data.projectId}`);
  // Cuid form — at least 8 base36 chars after /projects/. (The real
  // cuid is 25 chars; the regex is loose enough to survive cuid2
  // length changes.)
  assert.match(data.nextStep?.route || "", /^\/projects\/[a-z0-9]{8,}$/);

  // Codex caught a deeper subset of the same regression: even with
  // the POST response correctly rewritten, if the BOUND nextStep
  // isn't persisted into the WebChatMessage metadata, a session
  // reload reconstructs history from the DB and serves the stale
  // /projects/new route. The bind must happen BEFORE appendTurn.
  const assistantMessage = await readLatestAssistantMessage();
  assert.ok(assistantMessage);
  const storedNextStep = assistantMessage?.nextStep as
    | { route?: string }
    | null
    | undefined;
  assert.equal(
    storedNextStep?.route,
    `/projects/${data.projectId}`,
    "stored assistantMessage.nextStep must carry the bound route, not /projects/new",
  );
  // Same for the route column (used by some legacy session-restore paths).
  assert.equal(
    assistantMessage?.route,
    `/projects/${data.projectId}`,
    "stored assistantMessage.route must carry the bound route",
  );
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

test("GET returns empty conversation when the session's project was archived (PR #56 guard)", async () => {
  // Edge case: user briefs a project, chats with Sagasan, archives,
  // then navigates to /chat directly (no ?fresh=1). Before this guard,
  // the GET handler returned the latest conversation — which still
  // referenced the now-archived project — so the user saw the brief
  // they just discarded.
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;
  process.env.LLM_MODE = "mock_active";
  process.env.OPENAI_API_KEY = "";
  process.env.WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED = "true";

  // Submit a brief — produces a Project + an assistant message with
  // a bound /projects/<cuid> route in the assistantMessage.route /
  // nextStep.route fields.
  const postResponse = await POST(
    createRequest({
      message:
        "I want to throw a formal ball inspired by Love and Deepspace in Los Angeles in July. Probably 150 people. I don't have a venue yet. I have one photographer friend but no production crew. Budget is maybe $15k. Here's a Pinterest board. I want Saga to help find a producer, stylist, venue lead, and maybe performers.",
      persona: "host",
    }),
  );
  const postData = (await postResponse.json()) as {
    projectId: string | null;
    conversationId: string;
  };
  const sessionCookie = postResponse.cookies.get("web_session_id")?.value ?? null;
  assert.ok(sessionCookie);
  assert.ok(postData.projectId);

  // Archive the project. archiveProject also clears the session's
  // projectId — the exact state the guard is supposed to detect.
  const { archiveProject } = await import("@/lib/projectArchive");
  await archiveProject(postData.projectId!);

  // Without the ?fresh=1 flag, the chat client calls GET on /chat
  // visit. The guard should kick in: session.projectId is null,
  // the latest conversation has a bound /projects/<cuid> route,
  // so the response is an empty conversation.
  const getResponse = await GET(createGetRequest({ sessionId: sessionCookie }));
  const getData = (await getResponse.json()) as {
    conversationId: string | null;
    messages: unknown[];
  };

  assert.equal(getResponse.status, 200);
  assert.equal(
    getData.conversationId,
    null,
    "post-archive GET must not restore the discarded brief's conversation",
  );
  assert.deepEqual(getData.messages, []);
});

test("GET still restores a conversation that doesn't reference any bound project (guard false-positive check)", async () => {
  // Defensive: a session that has no project AND no bound-route
  // messages should still get its conversation restored. This
  // covers the (rare) "casual chat that never produced a brief"
  // case — we don't want to wipe a user's chat just because
  // session.projectId happens to be null.
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;
  process.env.LLM_MODE = "mock_active";
  process.env.OPENAI_API_KEY = "";

  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  try {
    const session = await db.webSession.create({ data: {} });
    // Insert a message with no bound-project route. Sagasan emits
    // /projects/new (unbound) in early intake turns; that should NOT
    // trip the guard.
    await db.webChatMessage.create({
      data: {
        sessionId: session.id,
        conversationId: "conv-no-project",
        role: "user",
        content: "Hello Sagasan",
        turn: 0,
      },
    });
    await db.webChatMessage.create({
      data: {
        sessionId: session.id,
        conversationId: "conv-no-project",
        role: "assistant",
        content: "Hi, what would you like to make?",
        turn: 1,
        route: "/projects/new", // unbound — pre-persistence
      },
    });

    const getResponse = await GET(createGetRequest({ sessionId: session.id }));
    const getData = (await getResponse.json()) as {
      conversationId: string | null;
      messages: Array<{ role: string }>;
    };
    assert.equal(getResponse.status, 200);
    assert.equal(getData.conversationId, "conv-no-project");
    assert.ok(getData.messages.length >= 1);
  } finally {
    await db.$disconnect();
  }
});
