import assert from "node:assert/strict";
import type {
  ProducerRole,
  ProjectUnderstanding,
  RoleMap,
} from "@/lib/producer/producerAgentTypes";
import {
  canPromoteTalentCandidateToShortlist,
  searchInternalTalentForProject,
} from "@/lib/sourcing/internalTalentSearch";
import { generatePublicResearchPlan } from "@/lib/sourcing/publicResearchPlan";
import { runPublicWebResearch } from "@/lib/sourcing/publicWebResearchProvider";
import { generateSourcingStrategy } from "@/lib/sourcing/sourcingStrategy";
import { scoreTalentCandidate } from "@/lib/sourcing/talentScoring";
import {
  candidateCardSchema,
  sourcingAuditEvents,
  type CandidateCard,
  type TalentCandidateInput,
} from "@/lib/sourcing/talentTypes";

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
}

function setSafeEnv() {
  process.env = { ...originalEnv };
  process.env.DATABASE_URL = "";
  process.env.SMS_SENDS_DISABLED = "true";
  process.env.LLM_MODE = "fallback";
  process.env.MESSAGE_PROCESSING_MODE = "sync";
  process.env.PUBLIC_WEB_RESEARCH_ENABLED = "false";
  process.env.PUBLIC_WEB_RESEARCH_MODE = "disabled";
  process.env.PUBLIC_WEB_RESEARCH_PROVIDER = "none";
  process.env.OPENAI_API_KEY = "sk-test-secret";
  process.env.TWILIO_AUTH_TOKEN = "twilio-secret-token";
  process.env.INTERNAL_API_KEY = "internal-secret-key";
}

function assertSafe(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const unsafe of [
    "+15551234567",
    "555-123-4567",
    "person@example.com",
    "sk-test-secret",
    "twilio-secret-token",
    "internal-secret-key",
    "production_saga",
  ]) {
    assert.equal(serialized.includes(unsafe), false, `Unsafe value leaked: ${unsafe}`);
  }
  assert.equal(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized),
    false,
    "Raw email leaked",
  );
}

function role(overrides: Partial<ProducerRole> = {}): ProducerRole {
  return {
    roleType: "photographer",
    title: "Photographer",
    priority: "required",
    description: "Capture creator and community moments.",
    requiredSkills: ["photography", "event photography"],
    preferredFandoms: ["anime", "cosplay"],
    localRequired: true,
    whyThisRoleMatters: "Good photos help the project feel real and shareable.",
    roleFitCriteria: ["event portfolio", "anime/cosplay context", "LA availability"],
    missingInfoForRole: [],
    confidence: 0.9,
    ...overrides,
  };
}

function understanding(overrides: Partial<ProjectUnderstanding> = {}): ProjectUnderstanding {
  return {
    title: "Anime Picnic LA",
    projectType: "fan picnic",
    city: "Los Angeles",
    fandoms: ["anime", "cosplay"],
    communities: ["anime creators"],
    format: "picnic",
    scope: "small",
    vibe: "friendly and polished",
    targetDate: null,
    timing: "summer",
    budgetRange: null,
    expectedAudienceSize: "30-50",
    audience: "anime fans",
    helpNeeded: "photographer and host",
    riskFlags: [],
    missingInfo: [],
    sourceKind: "organizer_project",
    confidence: 0.88,
    explanationForAudit: ["Synthetic test project understanding."],
    ...overrides,
  };
}

function roleMap(roles: ProducerRole[] = [role()]): RoleMap {
  return {
    requiredRoles: roles,
    optionalRoles: [
      role({
        roleType: "host",
        title: "Community host",
        requiredSkills: ["hosting", "community"],
        preferredFandoms: ["anime"],
        localRequired: true,
        priority: "optional",
      }),
    ],
    rolePriority: roles.map((item) => item.roleType),
    roleDescriptions: Object.fromEntries(roles.map((item) => [item.roleType, item.description])),
    roleFitCriteria: Object.fromEntries(roles.map((item) => [item.roleType, item.roleFitCriteria])),
    localRequired: Object.fromEntries(roles.map((item) => [item.roleType, item.localRequired])),
    whyThisRoleMatters: Object.fromEntries(
      roles.map((item) => [item.roleType, item.whyThisRoleMatters]),
    ),
    missingInfoForRole: Object.fromEntries(roles.map((item) => [item.roleType, []])),
    confidence: 0.86,
    humanReviewRequired: true,
    explanationForAudit: ["Synthetic role map."],
  };
}

function candidate(overrides: Partial<TalentCandidateInput> = {}): TalentCandidateInput {
  return {
    personId: "person_la_photo",
    creatorProfileId: "profile_la_photo",
    source: "INTERNAL_DB",
    displayName: "LA anime photographer",
    role: "photographer",
    city: "Los Angeles",
    fandoms: ["anime", "cosplay"],
    skills: ["photography", "event photography", "portrait photography"],
    portfolioUrls: ["https://example.com/la-photo"],
    publicSourceUrls: [],
    evidence: {
      roleEvidence: ["anime event photography"],
      communities: ["anime creators"],
    },
    relationshipTier: "COMMUNITY",
    reviewStatus: "APPROVED",
    availabilityNotes: "Available notes are admin-unverified.",
    optedOut: false,
    doNotContact: false,
    consentStatus: "OPTED_IN",
    privateNotes: "private note with +15551234567 and person@example.com should not surface",
    ...overrides,
  };
}

function publicCandidateCard(): CandidateCard {
  return {
    displayName: "Public portfolio photographer",
    likelyRole: "photographer",
    city: "Los Angeles",
    publicProfileUrls: ["https://example.com/public-profile"],
    portfolioEvidence: ["Public portfolio includes cosplay event albums."],
    fandomFitEvidence: ["Public page references anime convention work."],
    roleFitEvidence: ["Shows event photography portfolio."],
    locationEvidence: ["Profile lists Los Angeles service area."],
    whyTheyMayFit: ["Portfolio appears relevant for an anime picnic."],
    risks: ["Availability, rates, and interest are unverified."],
    missingInfo: ["Human review required before any contact."],
    confidence: 0.72,
    sourceUrls: ["https://example.com/public-profile"],
    sourceSummary: "Synthetic public source with citation.",
    requiresHumanReview: true,
  };
}

async function main() {
  try {
    setSafeEnv();

    const project = understanding();
    const map = roleMap();
    const pool: TalentCandidateInput[] = [
      candidate(),
      candidate({
        personId: "person_nyc_photo",
        creatorProfileId: "profile_nyc_photo",
        displayName: "NYC cosplay photographer",
        city: "New York",
        relationshipTier: "PUBLIC",
        reviewStatus: "PENDING_REVIEW",
      }),
      candidate({
        personId: "person_la_host",
        creatorProfileId: "profile_la_host",
        displayName: "LA community host",
        role: "host",
        skills: ["hosting", "community"],
        fandoms: ["anime"],
        relationshipTier: "MUTUAL",
      }),
      candidate({
        personId: "person_opted_out",
        displayName: "Opted out photographer",
        optedOut: true,
      }),
      candidate({
        personId: "person_do_not_contact",
        displayName: "Do-not-contact photographer",
        doNotContact: true,
      }),
    ];

    const internal = await searchInternalTalentForProject(project, map, {
      candidatePool: pool,
      persist: false,
      maxPerRole: 5,
    });
    assert.equal(internal.noSmsSent, true);
    assert.equal(internal.noOutreachSent, true);
    assert.equal(internal.rolesSearched.includes("photographer"), true);
    assert(internal.candidates.some((item) => item.displayName === "LA anime photographer"));
    assert.equal(
      internal.candidates.some((item) => item.displayName === "Opted out photographer"),
      false,
    );
    assert.equal(
      internal.candidates.some((item) => item.displayName === "Do-not-contact photographer"),
      false,
    );
    const la = internal.candidates.find((item) => item.displayName === "LA anime photographer");
    const nyc = internal.candidates.find((item) => item.displayName === "NYC cosplay photographer");
    assert(la && nyc);
    assert(la.score > nyc.score, "same-city approved profile should outrank weaker public/proximity fit");
    assert.equal(la.privateNotes, undefined, "private notes must not surface in scored candidates");
    assert(la.matchingReasons.some((reason) => /Role fit/i.test(reason)));
    assert(la.scoreBreakdown.roleFit > 0);
    assert(la.scoreBreakdown.locationFit > nyc.scoreBreakdown.locationFit);
    assert(la.scoreBreakdown.fandomFit > 0);

    const approved = candidate({ reviewStatus: "APPROVED", relationshipTier: "COMMUNITY" });
    const pending = candidate({
      personId: "person_pending",
      displayName: "Pending photographer",
      reviewStatus: "PENDING_REVIEW",
      relationshipTier: "COMMUNITY",
    });
    const approvedScore = scoreTalentCandidate({ candidate: approved, role: map.requiredRoles[0], understanding: project });
    const pendingScore = scoreTalentCandidate({ candidate: pending, role: map.requiredRoles[0], understanding: project });
    assert(approvedScore && pendingScore);
    assert(approvedScore.score > pendingScore.score, "approved/reviewed profiles should rank higher");

    const strategy = generateSourcingStrategy(project, map, {
      internalCandidateCount: internal.candidates.length,
    });
    assert.equal(strategy.humanReviewRequired, true);
    assert.match(strategy.internalSearchPriorities.join(" "), /Search approved creator profiles/i);
    assert.match(strategy.proximityStrategy.join(" "), /not confirmation of availability/i);

    const weakStrategy = generateSourcingStrategy(project, map, { internalCandidateCount: 0 });
    assert.equal(weakStrategy.publicResearchNeeded, true);
    const researchPlan = generatePublicResearchPlan(project, map, weakStrategy);
    assert.equal(researchPlan.researchNeeded, true);
    assert.equal(researchPlan.sourceCitationRequired, true);
    assert.equal(researchPlan.adminReviewRequired, true);
    assert(researchPlan.disallowedSources.some((source) => /logged-in/i.test(source)));
    assert(researchPlan.warnings.some((warning) => /Do not contact/i.test(warning)));

    let providerCalled = false;
    const disabledResearch = await runPublicWebResearch({
      request: {
        queryPlan: researchPlan.queryPlan,
        roleTargets: researchPlan.roleTargets,
      },
      provider: async () => {
        providerCalled = true;
        return [publicCandidateCard()];
      },
    });
    assert.equal(disabledResearch.calledProvider, false);
    assert.equal(providerCalled, false);
    assert.equal(disabledResearch.skippedReason, "public_web_research_disabled");

    process.env.PUBLIC_WEB_RESEARCH_ENABLED = "true";
    process.env.PUBLIC_WEB_RESEARCH_MODE = "shadow";
    process.env.PUBLIC_WEB_RESEARCH_PROVIDER = "openai_web_search";
    const shadowResearch = await runPublicWebResearch({
      request: {
        queryPlan: researchPlan.queryPlan,
        roleTargets: researchPlan.roleTargets,
      },
      provider: async () => [publicCandidateCard()],
    });
    assert.equal(shadowResearch.calledProvider, false);
    assert.equal(shadowResearch.skippedReason, "shadow_mode_no_live_web_call");
    assert.equal(shadowResearch.persistedCandidates, false);
    assert.equal(shadowResearch.candidates.length, 0);

    const invalidPublicCard = candidateCardSchema.safeParse({
      ...publicCandidateCard(),
      sourceUrls: [],
    });
    assert.equal(invalidPublicCard.success, false, "public candidates require source URLs");

    const publicScored = scoreTalentCandidate({
      candidate: {
        source: "PUBLIC_WEB_RESEARCH",
        displayName: "Public candidate",
        role: "photographer",
        city: "Los Angeles",
        fandoms: ["anime"],
        skills: ["photography"],
        portfolioUrls: ["https://example.com/public"],
        publicSourceUrls: ["https://example.com/public"],
        evidence: { roleEvidence: ["portfolio photography"] },
      },
      role: map.requiredRoles[0],
      understanding: project,
    });
    assert(publicScored);
    assert.equal(publicScored.status, "NEEDS_MORE_INFO");
    assert(publicScored.risks.some((risk) => /human verification/i.test(risk)));
    assert.equal(publicScored.scoreBreakdown.proximityInternalRelationship, 0);

    assert.equal(
      canPromoteTalentCandidateToShortlist({
        status: "APPROVED_FOR_SHORTLIST",
        personId: "person_1",
        source: "INTERNAL_DB",
      }),
      true,
    );
    assert.equal(
      canPromoteTalentCandidateToShortlist({
        status: "REJECTED",
        personId: "person_1",
        source: "INTERNAL_DB",
      }),
      false,
    );
    assert.equal(
      canPromoteTalentCandidateToShortlist({
        status: "APPROVED_FOR_SHORTLIST",
        personId: null,
        source: "PUBLIC_WEB_RESEARCH",
      }),
      false,
    );

    assert.equal(
      sourcingAuditEvents.publicWebResearchSkipped,
      "sourcing.public_web_research_skipped",
    );
    assert.equal(sourcingAuditEvents.candidateApproved, "sourcing.candidate_approved");
    assert.equal(process.env.SMS_SENDS_DISABLED, "true");
    assert.notEqual(process.env.LLM_MODE, "active_live");
    assert.notEqual(process.env.MESSAGE_PROCESSING_MODE, "async_active");

    assertSafe({
      internal,
      strategy,
      researchPlan,
      disabledResearch,
      shadowResearch,
      publicScored,
    });

    console.log(
      "Talent discovery checks passed without SMS, Twilio, real web calls, outreach, or production data.",
    );
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  restoreEnv();
  console.error(error);
  process.exit(1);
});
