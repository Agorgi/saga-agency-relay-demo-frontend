import { getDb } from "@/lib/db";
import {
  approveMockRecommendationOutreach,
  createFullDemoScenario,
  simulateCandidateReply,
} from "@/lib/networkCore";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function recommendationState(id: string) {
  return getDb().candidateRecommendation.findUniqueOrThrow({
    where: { id },
    include: { person: true },
  });
}

async function outreachState(recommendationId: string) {
  return getDb().outreach.findFirst({
    where: { candidateRecommendationId: recommendationId },
    orderBy: { updatedAt: "desc" },
  });
}

async function rearm(recommendationId: string) {
  const result = await approveMockRecommendationOutreach([recommendationId]);
  assert(result.sentCount === 1, "Expected one mock outreach send.");
  const recommendation = await recommendationState(recommendationId);
  const outreach = await outreachState(recommendationId);
  assert(recommendation.status === "CONTACTED", "Expected recommendation to be CONTACTED after re-arm.");
  assert(outreach?.status === "SENT", "Expected linked Outreach to be SENT after re-arm.");
  assert(outreach.adminApproved, "Expected linked Outreach to be admin-approved.");
  assert(!outreach.consentToGroupChat, "Expected re-armed Outreach consent to be false.");
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log(
      "Skipping contact reply demo-flow checks because DATABASE_URL is not set.",
    );
    return;
  }

  process.env.MESSAGING_PROVIDER = "MOCK";
  process.env.SMS_SENDS_DISABLED = "true";
  process.env.SMS_REQUIRE_ALLOWLIST = "true";

  const db = getDb();
  const scenario = await createFullDemoScenario();
  assert(
    scenario.recommendationIds.length >= 3,
    "Expected at least three demo recommendations.",
  );

  const recommendationIds = scenario.recommendationIds.slice(0, 3);
  const projectId = scenario.projectId;
  const groupCountBefore = await db.productionConversation.count({
    where: { projectId },
  });
  const teamMemberCountBefore = await db.teamMember.count({
    where: { team: { projectId } },
  });

  const approval = await approveMockRecommendationOutreach(recommendationIds);
  assert(approval.sentCount === 3, "Expected three mock outreach sends.");
  assert(
    approval.outreachCount === 3,
    "Expected three active legacy Outreach records.",
  );
  assert(
    approval.rearmedCount >= 1,
    "Expected full demo recommendations to be re-armed from prior demo state.",
  );

  for (const id of recommendationIds) {
    const recommendation = await recommendationState(id);
    const outreach = await outreachState(id);
    assert(recommendation.status === "CONTACTED", "Expected CONTACTED after approval.");
    assert(outreach?.status === "SENT", "Expected SENT Outreach after approval.");
  }

  const yesResult = await simulateCandidateReply({
    personId: (await recommendationState(recommendationIds[0])).personId,
    body: "YES",
  });
  assert(yesResult?.status === "INTERESTED", "Expected YES to mark candidate INTERESTED.");
  assert(
    (await outreachState(recommendationIds[0]))?.status === "INTERESTED",
    "Expected YES to mark Outreach INTERESTED.",
  );

  const consentYes = await simulateCandidateReply({
    personId: yesResult.personId,
    body: "Sure, you can introduce me",
  });
  assert(
    consentYes?.status === "SHORTLISTED",
    "Expected explicit consent to move candidate to SHORTLISTED.",
  );
  assert(
    (await outreachState(recommendationIds[0]))?.status === "APPROVED_FOR_GROUPCHAT",
    "Expected explicit consent to approve Outreach for group chat.",
  );
  assert(
    (await recommendationState(recommendationIds[0])).person.consentStatus ===
      "EXPLICIT",
    "Expected explicit consent to be recorded on Person.",
  );

  await rearm(recommendationIds[0]);
  const declined = await simulateCandidateReply({
    personId: (await recommendationState(recommendationIds[0])).personId,
    body: "NO",
  });
  assert(declined?.status === "DECLINED", "Expected NO to decline candidate.");
  assert(
    (await outreachState(recommendationIds[0]))?.status === "NOT_INTERESTED",
    "Expected NO to mark Outreach NOT_INTERESTED.",
  );

  await rearm(recommendationIds[1]);
  const maybe = await simulateCandidateReply({
    personId: (await recommendationState(recommendationIds[1])).personId,
    body: "MAYBE depending on the date",
  });
  assert(maybe?.status === "INTERESTED", "Expected MAYBE to keep candidate in consideration.");
  assert(
    (await outreachState(recommendationIds[1]))?.status === "MAYBE",
    "Expected MAYBE to mark Outreach MAYBE.",
  );

  await rearm(recommendationIds[1]);
  const payment = await simulateCandidateReply({
    personId: (await recommendationState(recommendationIds[1])).personId,
    body: "How much does it pay?",
  });
  assert(payment?.status === "CONTACTED", "Expected payment question to preserve CONTACTED.");
  assert(
    (await outreachState(recommendationIds[1]))?.status === "SENT",
    "Expected payment question to preserve SENT Outreach.",
  );

  const paymentAudit = await db.auditLog.findFirst({
    where: {
      action: "conversation.contact_reply_plan_applied",
      entityId: recommendationIds[1],
    },
    orderBy: { createdAt: "desc" },
  });
  assert(
    paymentAudit?.metadata &&
      typeof paymentAudit.metadata === "object" &&
      "shouldEscalate" in paymentAudit.metadata &&
      paymentAudit.metadata.shouldEscalate === true,
    "Expected payment question to audit shouldEscalate=true.",
  );

  await rearm(recommendationIds[1]);
  const clarifying = await simulateCandidateReply({
    personId: (await recommendationState(recommendationIds[1])).personId,
    body: "What is this?",
  });
  assert(
    clarifying?.status === "CONTACTED",
    "Expected clarifying question to preserve CONTACTED.",
  );

  await rearm(recommendationIds[2]);
  const yesForConsentNo = await simulateCandidateReply({
    personId: (await recommendationState(recommendationIds[2])).personId,
    body: "YES",
  });
  assert(
    yesForConsentNo?.status === "INTERESTED",
    "Expected YES before consent decline to mark INTERESTED.",
  );
  const consentNo = await simulateCandidateReply({
    personId: yesForConsentNo.personId,
    body: "Not yet, just send me info",
  });
  assert(
    consentNo?.status === "DECLINED",
    "Expected explicit consent refusal to decline candidate.",
  );

  await rearm(recommendationIds[2]);
  const yesForAmbiguousConsent = await simulateCandidateReply({
    personId: (await recommendationState(recommendationIds[2])).personId,
    body: "YES",
  });
  const ambiguousConsent = await simulateCandidateReply({
    personId: yesForAmbiguousConsent!.personId,
    body: "Maybe later",
  });
  assert(
    ambiguousConsent?.status === "INTERESTED",
    "Expected ambiguous consent to avoid confirming group consent.",
  );
  assert(
    (await recommendationState(recommendationIds[2])).person.consentStatus !==
      "EXPLICIT",
    "Expected ambiguous consent not to set explicit consent.",
  );

  const groupCountAfter = await db.productionConversation.count({
    where: { projectId },
  });
  const teamMemberCountAfter = await db.teamMember.count({
    where: { team: { projectId } },
  });
  assert(
    groupCountAfter === groupCountBefore,
    "Expected contact reply simulation not to create group conversations.",
  );
  assert(
    teamMemberCountAfter === teamMemberCountBefore,
    "Expected contact reply simulation not to add team members.",
  );

  console.log("Conversation contact reply demo-flow checks passed.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) {
      await getDb().$disconnect();
    }
  });
