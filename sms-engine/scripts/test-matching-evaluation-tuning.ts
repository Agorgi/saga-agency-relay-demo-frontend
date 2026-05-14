import assert from "node:assert/strict";
import { formatMatchingEvaluationReport, runMatchingEvaluation } from "@/sms-engine/matchingEval/runMatchingEvaluation";
import { matchingEvalCandidates } from "@/sms-engine/matchingEval/matchingEvalCandidates";
import { matchingEvalFixtures } from "@/sms-engine/matchingEval/matchingEvalFixtures";
import { matchingGoldenExpectations } from "@/sms-engine/matchingEval/goldenExpectations";
import { getRelationshipAwareMatchingWeights } from "@/sms-engine/graph/matchingWeights";
import { scoreCandidateForRole } from "@/sms-engine/graph/relationshipAwareScoring";
import { computeRoleAwareLocationFit } from "@/sms-engine/graph/roleLocationRequirements";

function candidate(id: string) {
  const found = matchingEvalCandidates.find((item) => item.id === id);
  assert.ok(found, `missing candidate fixture ${id}`);
  return found;
}

function fixture(id: string) {
  const found = matchingEvalFixtures.find((item) => item.id === id);
  assert.ok(found, `missing project fixture ${id}`);
  return found;
}

async function main() {
  assert.ok(matchingEvalFixtures.length >= 12, "at least 12 project fixtures should exist");
  assert.ok(matchingEvalCandidates.length >= 40, "candidate pool should contain at least 40 fake candidates");
  assert.equal(matchingGoldenExpectations.length, matchingEvalFixtures.length);

  const suite = await runMatchingEvaluation();
  assert.equal(suite.fixturesRun, matchingEvalFixtures.length);
  assert.equal(suite.noSmsSent, true);
  assert.equal(suite.noTwilioRequired, true);
  assert.equal(suite.noLiveWebCallRequired, true);
  assert.equal(suite.noProductionSagaAppDataRequired, true);
  assert.ok(suite.fixturePassCount >= 10, "overall suite should pass at least 10/12 fixtures");
  assert.equal(suite.safetyViolationCount, 0, "no safety-critical explanation violations");
  assert.ok(suite.averageScore >= 80, "average score should meet pass threshold");

  const animePicnic = fixture("anime-picnic-la");
  const strongInternal = candidate("candidate-la-anime-photo-direct");
  const publicUnreviewed = candidate("candidate-public-la-photo-unreviewed");
  const scoredInternal = scoreCandidateForRole({
    project: animePicnic.projectUnderstanding,
    role: animePicnic.roleMap.requiredRoles[0],
    candidate: strongInternal,
    requesterId: animePicnic.requesterId,
    graphContext: {
      edges: [
        {
          fromEntityType: "PERSON",
          fromEntityId: animePicnic.requesterId,
          toEntityType: "PERSON",
          toEntityId: String(strongInternal.personId),
          edgeType: "WORKED_TOGETHER",
          sourceType: "INTERNAL_DB",
          isInferred: false,
        },
      ],
      requesterFandomTags: animePicnic.fandoms,
      requesterCity: animePicnic.city,
    },
  });
  const scoredUnreviewed = scoreCandidateForRole({
    project: animePicnic.projectUnderstanding,
    role: animePicnic.roleMap.requiredRoles[0],
    candidate: publicUnreviewed,
    requesterId: animePicnic.requesterId,
    graphContext: {
      requesterFandomTags: animePicnic.fandoms,
      requesterCity: animePicnic.city,
    },
  });
  assert.equal(scoredInternal.proximityTier, "P1_DIRECT");
  assert.ok(scoredInternal.totalScore > scoredUnreviewed.totalScore);
  assert.ok(scoredUnreviewed.riskFlags.includes("unverified_public_web_candidate"));

  const maidFixture = fixture("maid-cafe-la");
  const maidResult = suite.results.find((item) => item.fixtureId === maidFixture.id);
  assert.ok(maidResult?.topCandidatesByRole.host.includes("candidate-la-maid-host-mutual"));

  const sameFandomResult = suite.results.find((item) => item.fixtureId === "low-budget-casual-meetup");
  assert.ok(sameFandomResult);
  const serializedLowBudget = JSON.stringify(sameFandomResult);
  assert.doesNotMatch(serializedLowBudget, /same fandom.*mutual|same city.*mutual/i);

  const publicReviewedResult = suite.results.find((item) => item.fixtureId === "artist-alley-market-la");
  assert.ok(publicReviewedResult?.topCandidatesByRole.illustrator.includes("candidate-public-illustrator-reviewed"));

  const excludedIds = JSON.stringify(suite.results);
  assert.doesNotMatch(excludedIds, /candidate-do-not-contact.*topCandidatesByRole/);
  assert.doesNotMatch(excludedIds, /candidate-opted-out.*topCandidatesByRole/);

  const remoteLocation = computeRoleAwareLocationFit({
    role: "illustrator",
    candidateLocation: "San Francisco",
    projectLocation: "Los Angeles",
  });
  const venueLocation = computeRoleAwareLocationFit({
    role: "venue owner",
    candidateLocation: "New York City",
    projectLocation: "Los Angeles",
  });
  assert.ok(remoteLocation.score > venueLocation.score, "remote-friendly roles should tolerate non-local better than venue roles");
  assert.equal(venueLocation.score, 0, "local-required venue role should strongly penalize non-local venue");

  const noContact = candidate("candidate-no-contact-photo");
  const withContact = candidate("candidate-la-anime-photo-approved");
  const scoredNoContact = scoreCandidateForRole({
    project: animePicnic.projectUnderstanding,
    role: animePicnic.roleMap.requiredRoles[0],
    candidate: noContact,
  });
  const scoredWithContact = scoreCandidateForRole({
    project: animePicnic.projectUnderstanding,
    role: animePicnic.roleMap.requiredRoles[0],
    candidate: withContact,
  });
  assert.ok(scoredWithContact.scoreBreakdown.contactabilityReadiness > scoredNoContact.scoreBreakdown.contactabilityReadiness);
  assert.match(scoredWithContact.contactabilitySummary.note, /not permission/i);

  const weakEvidence = candidate("candidate-weak-evidence-photo");
  const scoredWeak = scoreCandidateForRole({
    project: animePicnic.projectUnderstanding,
    role: animePicnic.roleMap.requiredRoles[0],
    candidate: weakEvidence,
  });
  assert.ok(scoredWeak.riskFlags.includes("weak_evidence"));
  assert.ok(scoredWeak.totalScore < scoredWithContact.totalScore);

  const markdown = formatMatchingEvaluationReport(suite);
  assert.match(markdown, /Matching Evaluation Report/);
  assert.doesNotMatch(markdown, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  assert.doesNotMatch(markdown, /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/);
  assert.doesNotMatch(markdown, /DATABASE_URL|OPENAI_API_KEY|TWILIO_AUTH_TOKEN|ADMIN_PASSWORD/);
  assert.ok(suite.tuningRecommendations.length >= 1, "tuning recommendations should be generated");
  assert.equal(getRelationshipAwareMatchingWeights().baseWeights.roleFit, 25);

  for (const result of suite.results) {
    assert.ok(result.performanceBudgetRespected, `${result.fixtureId} should respect performance budget`);
    assert.ok(result.candidatePoolSize <= 250, `${result.fixtureId} should respect candidate pool cap`);
    assert.equal(result.publicWebGatingCorrect, true);
    assert.equal(result.contactabilityHandlingCorrect, true);
  }

  console.log("matching evaluation tuning tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
