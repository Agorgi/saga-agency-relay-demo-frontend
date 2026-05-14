import "dotenv/config";
import { execFileSync } from "node:child_process";
import { getDb } from "@/lib/db";
import {
  addInterestToCheck,
  classifyCandidateReply,
  convertInterestCheckToProject,
  createFullDemoScenario,
  createInterestCheckFromForm,
} from "@/lib/networkCore";
import { runCandidateRecommendations } from "@/lib/networkMatching";
import { redactForLog } from "@/lib/safeLogging";

const demoScenarioEventId = "evt_demo_full_scenario";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runScript(script: string) {
  execFileSync("npm", ["run", script], {
    stdio: "inherit",
    env: {
      ...process.env,
      MESSAGING_PROVIDER: process.env.MESSAGING_PROVIDER || "MOCK",
    },
  });
}

async function demoSnapshot(projectId: string | null) {
  const db = getDb();
  const project = await db.project.findUnique({
    where: { existingSagaEventId: demoScenarioEventId },
    include: {
      projectBrief: { include: { messages: true } },
      roleOpenings: { include: { opportunities: true } },
      conversations: true,
      tasks: true,
    },
  });
  const scopedProjectId = projectId || project?.id || "";

  return {
    project,
    projectCount: await db.project.count({
      where: { existingSagaEventId: demoScenarioEventId },
    }),
    projectBriefCount: await db.projectBrief.count({
      where: { id: "demo-project-brief" },
    }),
    recommendations: scopedProjectId
      ? await db.candidateRecommendation.count({
          where: {
            opportunity: { roleOpening: { projectId: scopedProjectId } },
          },
        })
      : 0,
    replyMessages: scopedProjectId
      ? await db.message.count({
          where: {
            AND: [
              { metadata: { path: ["flow"], equals: "network_candidate_reply" } },
              { metadata: { path: ["projectId"], equals: scopedProjectId } },
            ],
          },
        })
      : 0,
    auditLogs: scopedProjectId
      ? await db.auditLog.count({
          where: {
            OR: [
              { entityId: scopedProjectId },
              {
                metadata: {
                  path: ["projectId"],
                  equals: scopedProjectId,
                },
              },
            ],
          },
        })
      : 0,
  };
}

function checklistComplete(snapshot: Awaited<ReturnType<typeof demoSnapshot>>) {
  const project = snapshot.project;
  if (!project) return false;

  const inboundCount =
    project.projectBrief?.messages.filter((message) => message.direction === "INBOUND")
      .length || 0;
  const outboundCount =
    project.projectBrief?.messages.filter((message) => message.direction === "OUTBOUND")
      .length || 0;
  const intakeCompleted = Boolean(
    project.projectBrief &&
      (project.legacyProjectBriefId ||
        project.projectBrief.status === "BRIEF_READY_FOR_REVIEW" ||
        (inboundCount > 0 && outboundCount > 0)),
  );
  const hasRoleOpenings = project.roleOpenings.length > 0;
  const hasOpportunities = project.roleOpenings.some(
    (role) => role.opportunities.length > 0,
  );
  const hasMockConversation = project.conversations.length > 0;

  const checks = [
    intakeCompleted,
    true,
    hasRoleOpenings,
    hasOpportunities,
    snapshot.recommendations > 0,
    snapshot.recommendations > 0,
    snapshot.recommendations > 0,
    snapshot.auditLogs > 0,
    hasMockConversation,
    project.tasks.length > 0 || hasMockConversation,
  ];

  return checks.filter(Boolean).length === checks.length;
}

async function runDatabaseRepeatabilityChecks() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "Skipping database-backed repeatability checks because DATABASE_URL is not set.",
    );
    return;
  }

  process.env.MESSAGING_PROVIDER ||= "MOCK";
  const db = getDb();

  try {
    const before = await demoSnapshot(null);
    const scenarios = [];
    for (let index = 0; index < 3; index += 1) {
      scenarios.push(await createFullDemoScenario());
    }

    const projectIds = new Set(scenarios.map((scenario) => scenario.projectId));
    const briefIds = new Set(scenarios.map((scenario) => scenario.projectBriefId));
    assert(projectIds.size === 1, "Full demo scenario should reuse one Project.");
    assert(briefIds.size === 1, "Full demo scenario should reuse one ProjectBrief.");

    const projectId = scenarios[0].projectId;
    const afterScenario = await demoSnapshot(projectId);
    assert(afterScenario.projectCount === 1, "Demo scenario Project duplicated.");
    assert(
      afterScenario.projectBriefCount === 1,
      "Demo scenario ProjectBrief duplicated.",
    );
    assert(afterScenario.project, "Demo scenario Project was not found.");
    assert(
      checklistComplete(afterScenario),
      "Demo checklist did not remain complete for the scoped scenario.",
    );

    const conversationsAdded =
      (afterScenario.project?.conversations.length || 0) -
      (before.project?.conversations.length || 0);
    const tasksAdded =
      (afterScenario.project?.tasks.length || 0) -
      (before.project?.tasks.length || 0);
    assert(
      conversationsAdded <= 3,
      `Expected at most one mock conversation per scenario refresh, got ${conversationsAdded}.`,
    );
    assert(
      tasksAdded <= 12,
      `Expected at most four tasks per scenario refresh, got ${tasksAdded}.`,
    );

    await db.project.create({
      data: {
        source: "IMPORT",
        existingSagaEventId: `evt_repeatability_unrelated_${Date.now()}`,
        title: "Repeatability Unrelated Project",
        city: "Los Angeles",
        status: "BRIEF_READY",
      },
    });
    const afterUnrelatedProject = await demoSnapshot(projectId);
    assert(
      checklistComplete(afterUnrelatedProject),
      "Unrelated staging project changed the scoped demo checklist.",
    );

    const opportunities = await db.opportunity.findMany({
      where: { roleOpening: { projectId } },
      select: { id: true },
    });
    assert(opportunities.length > 0, "Expected demo opportunities for matching.");
    for (const opportunity of opportunities) {
      await runCandidateRecommendations(opportunity.id);
    }
    const afterFirstMatching = await demoSnapshot(projectId);
    for (const opportunity of opportunities) {
      await runCandidateRecommendations(opportunity.id);
    }
    const afterSecondMatching = await demoSnapshot(projectId);
    assert(
      afterSecondMatching.recommendations === afterFirstMatching.recommendations,
      "Repeated matching should update existing recommendations, not duplicate them.",
    );

    const formData = new FormData();
    formData.set("phone", `+1415999${String(Date.now()).slice(-4)}`);
    formData.set("title", `Repeatability Interest Check ${Date.now()}`);
    formData.set("description", "Would people join a staging-only fandom meetup?");
    formData.set("city", "Los Angeles");
    formData.set("fandoms", "anime, cosplay");
    formData.set("proposedTiming", "staging only");
    formData.set("thresholdValue", "1");
    const interestCheck = await createInterestCheckFromForm(formData);
    await addInterestToCheck(interestCheck.id);
    const firstProjectId = await convertInterestCheckToProject(interestCheck.id);
    const secondProjectId = await convertInterestCheckToProject(interestCheck.id);
    assert(
      firstProjectId === secondProjectId,
      "Interest check conversion should be idempotent.",
    );

    console.log(
      JSON.stringify(
        {
          databaseRepeatability: "passed",
          projectId,
          scenarioRuns: scenarios.length,
          recommendations: afterSecondMatching.recommendations,
          conversationsAdded,
          tasksAdded,
          convertedInterestCheckProject: firstProjectId,
        },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
  }
}

function runRemoteInternalApiRepeatabilityChecks() {
  if (!process.env.APP_BASE_URL || !process.env.INTERNAL_API_KEY) {
    console.log(
      "Skipping repeated internal API smoke flow: APP_BASE_URL and INTERNAL_API_KEY are required.",
    );
    return;
  }

  runScript("test:internal-api");
  runScript("test:internal-api");
}

function runLocalNoDbChecks() {
  const replies = [
    ["YES", "YES"],
    ["no thanks", "NO"],
    ["maybe send info", "MAYBE"],
    ["what is this", "UNKNOWN"],
  ] as const;

  for (const [body, expected] of replies) {
    const actual = classifyCandidateReply(body);
    assert(actual === expected, `Expected ${body} to classify as ${expected}.`);
  }
}

async function main() {
  process.env.MESSAGING_PROVIDER ||= "MOCK";
  runLocalNoDbChecks();
  await runDatabaseRepeatabilityChecks();

  if (process.env.DATABASE_URL) {
    runScript("test:seed-idempotency");
  } else {
    console.log("Skipping seed idempotency repeatability check: DATABASE_URL is not set.");
  }

  runRemoteInternalApiRepeatabilityChecks();
  console.log("Staging repeatability checks passed.");
}

main().catch((error) => {
  console.error(redactForLog(error));
  process.exit(1);
});
