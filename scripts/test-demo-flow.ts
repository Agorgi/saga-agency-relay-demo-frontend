import { getDb } from "@/lib/db";
import { handleOrganizerInbound } from "@/lib/intake";
import { ensureProjectForProjectBrief } from "@/lib/networkBridge";
import {
  approveMockRecommendationOutreach,
  classifyCandidateReply,
  createFullDemoScenario,
  simulateCandidateReply,
} from "@/lib/networkCore";
import { redactForLog } from "@/lib/safeLogging";

const cases = [
  ["YES", "YES"],
  ["yeah sounds good", "YES"],
  ["maybe send info", "MAYBE"],
  ["no thanks", "NO"],
  ["what is this", "UNKNOWN"],
] as const;

for (const [input, expected] of cases) {
  const actual = classifyCandidateReply(input);
  console.log(`${input} -> ${actual}`);
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

async function runDatabaseDemoChecks() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "Skipping database-backed demo flow checks because DATABASE_URL is not set.",
    );
    return;
  }

  process.env.MESSAGING_PROVIDER ||= "MOCK";

  const db = getDb();
  try {
    const scenario = await createFullDemoScenario();
    const firstBridgeProject = await ensureProjectForProjectBrief(
      scenario.projectBriefId,
    );
    const secondBridgeProject = await ensureProjectForProjectBrief(
      scenario.projectBriefId,
    );
    if (firstBridgeProject.id !== secondBridgeProject.id) {
      throw new Error("Expected ProjectBrief bridge to reuse the same Project.");
    }
    const bridgeProjectCount = await db.project.count({
      where: { legacyProjectBriefId: scenario.projectBriefId },
    });
    if (bridgeProjectCount !== 1) {
      throw new Error(
        `Expected one canonical Project for demo brief, got ${bridgeProjectCount}.`,
      );
    }

    const recommendations = await db.candidateRecommendation.findMany({
      where: { id: { in: scenario.recommendationIds } },
      include: { person: true },
      orderBy: { createdAt: "asc" },
    });

    if (recommendations.length < 3) {
      throw new Error(
        `Expected at least 3 demo recommendations, got ${recommendations.length}.`,
      );
    }

    const outreach = await approveMockRecommendationOutreach(
      scenario.recommendationIds,
    );
    if (outreach.sentCount < 3) {
      throw new Error(`Expected 3 mock outreach sends, got ${outreach.sentCount}.`);
    }

    for (const [index, body] of ["YES", "NO", "MAYBE"].entries()) {
      const result = await simulateCandidateReply({
        personId: recommendations[index].personId,
        body,
      });
      if (!result) {
        throw new Error(`Expected simulated ${body} reply to be recorded.`);
      }
    }

    await simulateCandidateReply({
      personId: recommendations[0].personId,
      body: "YES, you can introduce me in the group",
    });
    const consentedPerson = await db.person.findUnique({
      where: { id: recommendations[0].personId },
    });
    if (consentedPerson?.consentStatus !== "EXPLICIT") {
      throw new Error("Expected explicit consent after group-intro reply.");
    }

    const replyCount = await db.message.count({
      where: {
        AND: [
          { metadata: { path: ["flow"], equals: "network_candidate_reply" } },
          { metadata: { path: ["projectId"], equals: scenario.projectId } },
        ],
      },
    });
    if (replyCount < 3) {
      throw new Error("Expected fake candidate replies to be persisted.");
    }

    const organizerPhone = `+1415555${Math.floor(1000 + Math.random() * 9000)}`;
    await handleOrganizerInbound({
      from: organizerPhone,
      body: "I want to host a creator photoshoot in LA.",
      twilioMessageSid: `test-demo-${crypto.randomUUID()}`,
      provider: "MOCK",
      metadata: { simulated: true, test: "demo-flow" },
    });
    const organizer = await db.user.findUnique({
      where: { phone: organizerPhone },
      include: {
        projectBriefs: {
          include: { messages: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });
    const projectBrief = organizer?.projectBriefs[0];
    const manualIntakeCompleted = Boolean(
      projectBrief?.messages.some((message) => message.direction === "INBOUND") &&
        projectBrief.messages.some((message) => message.direction === "OUTBOUND"),
    );
    if (!manualIntakeCompleted) {
      throw new Error("Expected manual organizer intake to persist both sides.");
    }

    console.log("Database-backed demo flow checks passed.");
  } finally {
    await db.$disconnect();
  }
}

runDatabaseDemoChecks()
  .then(() => {
    console.log("Demo flow checks passed.");
  })
  .catch((error) => {
    console.error(redactForLog(error));
    process.exit(1);
  });
