import type { CandidatePoolProfile } from "@/lib/graph/candidateRetrieval";
import { getRelationshipAwareMatchingWeights } from "@/lib/graph/matchingWeights";
import { rankCandidatesForProject } from "@/lib/graph/projectCandidateMatcher";
import {
  matchingEvalCandidates,
  matchingEvalRelationshipEdges,
} from "@/lib/matchingEval/matchingEvalCandidates";
import {
  getGoldenExpectation,
  matchingGoldenExpectations,
  type MatchingGoldenExpectation,
} from "@/lib/matchingEval/goldenExpectations";
import {
  matchingEvalFixtures,
  type MatchingEvalFixture,
} from "@/lib/matchingEval/matchingEvalFixtures";
import { generateMatchingTuningRecommendations } from "@/lib/matchingEval/matchingTuningRecommendations";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/i;

export type MatchingEvaluationFixtureResult = {
  fixtureId: string;
  projectType: string;
  passed: boolean;
  score: number;
  topKPrecision: number;
  excludedCorrectly: boolean;
  safetyViolations: string[];
  explanationQuality: number;
  roleCoverage: number;
  publicWebGatingCorrect: boolean;
  proximityLabelsCorrect: boolean;
  contactabilityHandlingCorrect: boolean;
  performanceBudgetRespected: boolean;
  failures: string[];
  warnings: string[];
  recommendedTuning: string[];
  topCandidatesByRole: Record<string, string[]>;
  candidatePoolSize: number;
  resultCount: number;
  durationMs: number;
};

export type MatchingEvaluationSuiteResult = {
  generatedAt: string;
  passed: boolean;
  averageScore: number;
  fixturesRun: number;
  fixturePassCount: number;
  fixtureFailCount: number;
  safetyViolationCount: number;
  results: MatchingEvaluationFixtureResult[];
  tuningRecommendations: string[];
  weights: ReturnType<typeof getRelationshipAwareMatchingWeights>;
  noSmsSent: true;
  noTwilioRequired: true;
  noLiveWebCallRequired: true;
  noProductionSagaAppDataRequired: true;
};

export type RunMatchingEvaluationOptions = {
  fixtureId?: string;
  poolCap?: number;
  perRolePoolCap?: number;
  publicWebUnverifiedCap?: number;
  candidates?: CandidatePoolProfile[];
};

function graphContextFor(fixture: MatchingEvalFixture) {
  return {
    edges: matchingEvalRelationshipEdges,
    requesterCity: fixture.city,
    requesterMetro: fixture.metro,
    requesterFandomTags: fixture.fandoms,
    requesterCommunityTags: fixture.communities,
  };
}

function resultCandidateId(result: { candidate: CandidatePoolProfile }) {
  return result.candidate.id;
}

function idsByRole(results: Array<{ candidate: CandidatePoolProfile; role: { roleType: string } }>) {
  const map: Record<string, string[]> = {};
  for (const result of results) {
    map[result.role.roleType] ||= [];
    if (!map[result.role.roleType].includes(result.candidate.id)) {
      map[result.role.roleType].push(result.candidate.id);
    }
  }
  return map;
}

function topIds(results: Array<{ candidate: CandidatePoolProfile }>, k: number) {
  return [...new Set(results.slice(0, k).map(resultCandidateId))];
}

function roleCoverageScore(
  fixture: MatchingEvalFixture,
  actualByRole: Record<string, string[]>,
) {
  const expectedRoles = fixture.roleMap.requiredRoles.map((role) => role.roleType);
  if (expectedRoles.length === 0) return 1;
  const covered = expectedRoles.filter((role) => (actualByRole[role] || []).length > 0);
  return covered.length / expectedRoles.length;
}

function safeExplanationChecks(
  results: Array<{
    candidate: CandidatePoolProfile;
    organizerSafeSummary: string;
    matchReasons: string[];
    relationshipPath: {
      pathSummary?: string;
      shouldCallThisMutual?: boolean;
      pathType?: string;
    } | null;
    contactabilitySummary: { note?: string };
  }>,
) {
  const violations: string[] = [];
  for (const result of results) {
    const text = [
      result.organizerSafeSummary,
      ...result.matchReasons,
      result.relationshipPath?.pathSummary || "",
      result.contactabilitySummary.note || "",
    ].join(" ");
    if (EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text)) {
      violations.push(`${result.candidate.id}: raw contact detail leaked`);
    }
    if (/\bavailable\b|\bconfirmed\b|\bbooked\b/i.test(text)) {
      violations.push(`${result.candidate.id}: unsupported availability/booking claim`);
    }
    if (
      /\bmutual\b/i.test(text) &&
      !/\bnot (?:a )?mutual\b/i.test(text) &&
      result.relationshipPath?.shouldCallThisMutual !== true &&
      result.relationshipPath?.pathType !== "MUTUAL"
    ) {
      violations.push(`${result.candidate.id}: mutual overclaim`);
    }
    if (
      result.candidate.sourceMode === "PUBLIC_WEB_RESEARCH" &&
      /direct internal relationship|two-hop internal relationship|connected/i.test(text)
    ) {
      violations.push(`${result.candidate.id}: public-web connection overclaim`);
    }
    if (/\bpermission\b/i.test(text) && !/\bnot permission\b/i.test(text)) {
      violations.push(`${result.candidate.id}: contactability permission overclaim`);
    }
    if (/private note|admin-only/i.test(text)) {
      violations.push(`${result.candidate.id}: private note leak risk`);
    }
  }
  return violations;
}

function evaluateGoldenExpectations(input: {
  fixture: MatchingEvalFixture;
  expectation: MatchingGoldenExpectation;
  ranked: Awaited<ReturnType<typeof rankCandidatesForProject>>;
  durationMs: number;
  poolCap: number;
}) {
  const results = input.ranked.results;
  const candidateIds = new Set(results.map((result) => result.candidate.id));
  const topFive = topIds(results, 5);
  const topTen = topIds(results, 10);
  const actualByRole = idsByRole(results);
  const failures: string[] = [];
  const warnings = [...input.expectation.expectedWarnings];

  const highHits = input.expectation.candidatesWhoShouldRankHigh.filter((id) =>
    topTen.includes(id),
  );
  const topKPrecision =
    input.expectation.candidatesWhoShouldRankHigh.length === 0
      ? 1
      : highHits.length / input.expectation.candidatesWhoShouldRankHigh.length;
  if (topKPrecision < 0.5) {
    failures.push("strong expected candidates missing from top 10");
  }

  const lowInTopFive = input.expectation.candidatesWhoShouldRankLow.filter((id) =>
    topFive.includes(id),
  );
  if (lowInTopFive.length > 0) {
    failures.push(`low-confidence candidates ranked too high: ${lowInTopFive.join(", ")}`);
  }

  const excludedFailures = input.expectation.candidatesWhoMustBeExcluded.filter((id) =>
    candidateIds.has(id),
  );
  const excludedCorrectly = excludedFailures.length === 0;
  if (!excludedCorrectly) {
    failures.push(`excluded candidates appeared: ${excludedFailures.join(", ")}`);
  }

  const publicWebGatingFailures = results
    .slice(0, 5)
    .filter(
      (result) =>
        result.candidate.sourceMode === "PUBLIC_WEB_RESEARCH" &&
        !["APPROVED_FOR_INTERNAL_REVIEW", "APPROVED_FOR_SHORTLIST"].includes(
          String(result.candidate.reviewStatus),
        ),
    )
    .map((result) => result.candidate.id);
  const publicWebGatingCorrect = publicWebGatingFailures.length === 0;
  if (!publicWebGatingCorrect) {
    failures.push(`unreviewed public-web candidate ranked too high: ${publicWebGatingFailures.join(", ")}`);
  }

  const proximityFailures = Object.entries(input.expectation.expectedProximityTiers).filter(
    ([candidateId, tier]) => {
      const result = results.find((item) => item.candidate.id === candidateId);
      return result ? result.proximityTier !== tier : false;
    },
  );
  const proximityLabelsCorrect = proximityFailures.length === 0;
  if (!proximityLabelsCorrect) {
    failures.push(
      `proximity tier mismatch: ${proximityFailures
        .map(([candidateId, tier]) => `${candidateId} expected ${tier}`)
        .join(", ")}`,
    );
  }

  const explanationViolations = safeExplanationChecks(results);
  const safetyViolations = [...explanationViolations];
  if (input.fixture.expectedSafetyBehavior.includes("safety_escalation_expected")) {
    warnings.push("safety-sensitive fixture requires human review before real launch");
  }
  if (input.fixture.maxRolesToSource) {
    const uniqueRoles = Object.keys(actualByRole);
    if (uniqueRoles.length > input.fixture.maxRolesToSource) {
      warnings.push("overstaffing risk: too many roles ranked for small/interest-check fixture");
    }
  }

  const contactabilityPermissionClaims = results.filter((result) => {
    const note = result.contactabilitySummary.note || "";
    return /\bpermission\b/i.test(note) && !/\bnot permission\b/i.test(note);
  });
  const contactabilityHandlingCorrect = contactabilityPermissionClaims.length === 0;
  if (!contactabilityHandlingCorrect) {
    failures.push("contactability described as permission");
  }

  const roleCoverage = roleCoverageScore(input.fixture, actualByRole);
  if (roleCoverage < 0.75) {
    failures.push("required role coverage below threshold");
  }

  const performanceBudgetRespected =
    input.ranked.candidatePoolSize <= input.poolCap && input.durationMs < 2500;
  if (!performanceBudgetRespected) {
    failures.push("candidate pool cap or runtime budget exceeded");
  }

  const explanationQuality =
    results.length === 0
      ? 0
      : Math.max(0, 1 - explanationViolations.length / Math.max(results.length, 1));
  let score = 100;
  score -= Math.round((1 - topKPrecision) * 20);
  score -= excludedCorrectly ? 0 : 25;
  score -= publicWebGatingCorrect ? 0 : 15;
  score -= proximityLabelsCorrect ? 0 : 10;
  score -= Math.round((1 - roleCoverage) * 15);
  score -= Math.round((1 - explanationQuality) * 20);
  score -= performanceBudgetRespected ? 0 : 10;
  score -= warnings.filter((warning) => /overstaffing/i.test(warning)).length * 4;
  score = Math.max(0, Math.min(100, score));

  const passed = score >= 80 && safetyViolations.length === 0 && failures.length === 0;
  return {
    fixtureId: input.fixture.id,
    projectType: input.fixture.projectType,
    passed,
    score,
    topKPrecision: Number(topKPrecision.toFixed(2)),
    excludedCorrectly,
    safetyViolations,
    explanationQuality: Number(explanationQuality.toFixed(2)),
    roleCoverage: Number(roleCoverage.toFixed(2)),
    publicWebGatingCorrect,
    proximityLabelsCorrect,
    contactabilityHandlingCorrect,
    performanceBudgetRespected,
    failures,
    warnings,
    recommendedTuning: [],
    topCandidatesByRole: Object.fromEntries(
      Object.entries(actualByRole).map(([role, ids]) => [role, ids.slice(0, 5)]),
    ),
    candidatePoolSize: input.ranked.candidatePoolSize,
    resultCount: input.ranked.resultCount,
    durationMs: input.durationMs,
  } satisfies MatchingEvaluationFixtureResult;
}

export async function runSingleMatchingEvaluation(
  fixture: MatchingEvalFixture,
  options: RunMatchingEvaluationOptions = {},
): Promise<MatchingEvaluationFixtureResult> {
  const start = Date.now();
  const expectation = getGoldenExpectation(fixture.id);
  const ranked = await rankCandidatesForProject(fixture.id, {
    projectUnderstanding: fixture.projectUnderstanding,
    roleMap: fixture.roleMap,
    requesterId: fixture.requesterId,
    graphContext: graphContextFor(fixture),
    profiles: options.candidates || matchingEvalCandidates,
    persist: false,
    poolCap: options.poolCap ?? 250,
    perRolePoolCap: options.perRolePoolCap ?? 50,
    publicWebUnverifiedCap: options.publicWebUnverifiedCap ?? 25,
    minInternalCoverage: 5,
  });
  const result = evaluateGoldenExpectations({
    fixture,
    expectation,
    ranked,
    durationMs: Date.now() - start,
    poolCap: options.poolCap ?? 250,
  });
  return {
    ...result,
    recommendedTuning: generateMatchingTuningRecommendations([result]),
  };
}

export async function runMatchingEvaluation(
  options: RunMatchingEvaluationOptions = {},
): Promise<MatchingEvaluationSuiteResult> {
  const fixtures = options.fixtureId
    ? matchingEvalFixtures.filter((fixture) => fixture.id === options.fixtureId)
    : matchingEvalFixtures;
  if (options.fixtureId && fixtures.length === 0) {
    throw new Error(`unknown_matching_eval_fixture:${options.fixtureId}`);
  }
  const results = [];
  for (const fixture of fixtures) {
    results.push(await runSingleMatchingEvaluation(fixture, options));
  }
  const averageScore =
    results.length === 0
      ? 0
      : Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length);
  const safetyViolationCount = results.reduce(
    (sum, result) => sum + result.safetyViolations.length,
    0,
  );
  const fixturePassCount = results.filter((result) => result.passed).length;
  const tuningRecommendations = generateMatchingTuningRecommendations(results);
  return {
    generatedAt: new Date().toISOString(),
    passed:
      fixturePassCount >= Math.min(10, results.length) &&
      safetyViolationCount === 0 &&
      averageScore >= 80,
    averageScore,
    fixturesRun: results.length,
    fixturePassCount,
    fixtureFailCount: results.length - fixturePassCount,
    safetyViolationCount,
    results,
    tuningRecommendations,
    weights: getRelationshipAwareMatchingWeights(),
    noSmsSent: true,
    noTwilioRequired: true,
    noLiveWebCallRequired: true,
    noProductionSagaAppDataRequired: true,
  };
}

export function getMatchingEvaluationFixtureSummary() {
  return {
    fixtureCount: matchingEvalFixtures.length,
    candidateCount: matchingEvalCandidates.length,
    expectationCount: matchingGoldenExpectations.length,
  };
}

export function formatMatchingEvaluationReport(report: MatchingEvaluationSuiteResult) {
  const lines = [
    "# Matching Evaluation Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Overall: ${report.passed ? "PASS" : "FAIL"}`,
    `Average score: ${report.averageScore}`,
    `Fixtures run: ${report.fixturesRun}`,
    `Fixture pass count: ${report.fixturePassCount}`,
    `Fixture fail count: ${report.fixtureFailCount}`,
    `Safety violations: ${report.safetyViolationCount}`,
    "",
    "## Weight Config",
    `- Version: ${report.weights.scoringVersion}`,
    `- Role fit: ${report.weights.baseWeights.roleFit}`,
    `- Fandom/community fit: ${report.weights.baseWeights.fandomCommunityFit}`,
    `- Location fit: ${report.weights.baseWeights.locationFit}`,
    `- Relationship proximity: ${report.weights.baseWeights.relationshipProximity}`,
    `- Evidence quality: ${report.weights.baseWeights.evidenceQuality}`,
    `- Contactability readiness: ${report.weights.baseWeights.contactabilityReadiness}`,
    `- Review trust: ${report.weights.baseWeights.reviewTrust}`,
    "",
    "## Tuning Recommendations",
    ...report.tuningRecommendations.map((item) => `- ${item}`),
    "",
    "## Fixture Results",
  ];
  for (const result of report.results) {
    lines.push(
      "",
      `### ${result.fixtureId}`,
      `- Project type: ${result.projectType}`,
      `- Status: ${result.passed ? "PASS" : "FAIL"}`,
      `- Score: ${result.score}`,
      `- Top-K quality: ${result.topKPrecision}`,
      `- Role coverage: ${result.roleCoverage}`,
      `- Explanation quality: ${result.explanationQuality}`,
      `- Candidate pool size: ${result.candidatePoolSize}`,
      `- Result count: ${result.resultCount}`,
      `- Duration ms: ${result.durationMs}`,
      `- Public web gating correct: ${result.publicWebGatingCorrect}`,
      `- Proximity labels correct: ${result.proximityLabelsCorrect}`,
      `- Contactability handling correct: ${result.contactabilityHandlingCorrect}`,
      `- Performance budget respected: ${result.performanceBudgetRespected}`,
      `- Failures: ${result.failures.join("; ") || "none"}`,
      `- Warnings: ${result.warnings.join("; ") || "none"}`,
      `- Safety violations: ${result.safetyViolations.join("; ") || "none"}`,
    );
  }
  lines.push(
    "",
    "## Safety",
    "- No SMS sent.",
    "- No Twilio required.",
    "- No live web calls.",
    "- No outreach, email, DM, group chat, public launch, or production Saga app data.",
    "- Candidate names are synthetic fixture labels only; no raw phone numbers or emails are included.",
    "",
  );
  return lines.join("\n");
}
