import type {
  CandidateVerificationStatus,
  ContactabilityChannel,
  TalentCandidateSource,
  TalentCandidateStatus,
} from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { validateCitationSet } from "@/lib/sourcing/sourceNormalization";
import { detectPublicWebDuplicate } from "@/lib/sourcing/publicWebDeduplication";
import { buildCandidateSearchProfile, canPromotePersistedCandidate } from "@/lib/graph/candidateSearchProfile";

export const candidateGraphAuditEvents = {
  candidatePersisted: "candidate_graph.candidate_persisted",
  candidatePersistenceBlocked: "candidate_graph.persistence_blocked",
  searchProfileIndexed: "candidate_graph.search_profile_indexed",
  graphEdgeCreated: "candidate_graph.edge_created",
  promotionBlocked: "candidate_graph.promotion_blocked",
  promotionAllowed: "candidate_graph.promotion_allowed",
} as const;

export type CandidateProvenance = {
  source: TalentCandidateSource;
  sourceId?: string | null;
  sourceUrls?: string[];
  evidenceSummary: string;
};

export type IdentifiedCandidateInput = {
  searchRunId?: string | null;
  publicWebResearchResultId?: string | null;
  personId?: string | null;
  creatorProfileId?: string | null;
  contactId?: string | null;
  candidateRecommendationId?: string | null;
  displayName: string;
  role: string;
  city?: string | null;
  fandoms?: string[];
  skills?: string[];
  communities?: string[];
  portfolioUrls?: string[];
  publicSourceUrls?: string[];
  evidence?: Record<string, unknown>;
  source: TalentCandidateSource;
  provenance: CandidateProvenance;
  contactabilityEvidence?: Array<{
    channel: ContactabilityChannel;
    valueRedacted?: string | null;
    sourceUrl?: string | null;
    sourceTitle?: string | null;
    evidenceTextSummary?: string | null;
    isPubliclyVisible?: boolean;
    isBusinessFacing?: boolean;
    isPersonalContact?: boolean;
  }>;
  doNotContact?: boolean;
  optedOut?: boolean;
};

function publicWebNeedsSourceUrls(input: IdentifiedCandidateInput) {
  return input.source === "PUBLIC_WEB_RESEARCH" && (input.publicSourceUrls || []).length === 0;
}

function initialVerificationStatus(input: IdentifiedCandidateInput): CandidateVerificationStatus {
  if (input.doNotContact) return "DO_NOT_CONTACT";
  if (input.optedOut) return "DO_NOT_CONTACT";
  if (input.source === "PUBLIC_WEB_RESEARCH") {
    if ((input.contactabilityEvidence || []).length === 0) {
      return "NEEDS_CONTACTABILITY_REVIEW";
    }
    return "NEEDS_QUALITY_REVIEW";
  }
  return "DISCOVERED";
}

export async function persistIdentifiedCandidate(input: IdentifiedCandidateInput) {
  const sourceUrls = input.publicSourceUrls || [];
  if (publicWebNeedsSourceUrls(input)) {
    await logAudit({
      actorType: "SYSTEM",
      action: candidateGraphAuditEvents.candidatePersistenceBlocked,
      entityType: "TalentCandidate",
      entityId: "not_created",
      metadata: {
        source: input.source,
        reason: "public_web_source_url_required",
      },
    });
    return {
      ok: false,
      blocked: true,
      blockers: ["public_web_source_url_required"],
      noSmsSent: true,
      noOutreachSent: true,
      noGroupChatCreated: true,
    };
  }

  if (input.source === "PUBLIC_WEB_RESEARCH") {
    const citationValidation = validateCitationSet({
      candidate: {
        sourceUrls,
        sourceTitles: [],
        privateSourceDetected: false,
      },
    });
    if (!citationValidation.valid) {
      return {
        ok: false,
        blocked: true,
        blockers: citationValidation.blockers,
        noSmsSent: true,
        noOutreachSent: true,
        noGroupChatCreated: true,
      };
    }
  }

  const duplicate = await detectPublicWebDuplicate({
    displayName: input.displayName,
    city: input.city,
    role: input.role,
    profileUrls: input.portfolioUrls,
    sourceUrls,
  });
  const verificationStatus =
    duplicate.duplicateStatus === "MATCHES_INTERNAL_PROFILE" ||
    duplicate.duplicateStatus === "LIKELY_DUPLICATE"
      ? "DUPLICATE"
      : initialVerificationStatus(input);

  const status: TalentCandidateStatus =
    input.doNotContact || input.optedOut ? "DO_NOT_CONTACT" : "SUGGESTED";
  const plannedCandidate = {
    source: input.source,
    displayName: input.displayName,
    role: input.role,
    city: input.city || null,
    fandoms: input.fandoms || [],
    skills: input.skills || [],
    portfolioUrls: input.portfolioUrls || [],
    publicSourceUrls: sourceUrls,
    evidence: {
      ...(input.evidence || {}),
      provenance: input.provenance,
      duplicate,
    },
    status,
    verificationStatus,
  };

  if (!process.env.DATABASE_URL) {
    return {
      ok: true,
      persisted: false,
      plannedCandidate,
      duplicate,
      searchProfile: buildCandidateSearchProfile({
        displayName: input.displayName,
        roles: [input.role],
        skills: input.skills,
        fandoms: input.fandoms,
        communities: input.communities,
        city: input.city,
        sourceMode: input.source,
        reviewStatus: verificationStatus,
        doNotContact: input.doNotContact,
        optedOut: input.optedOut,
      }),
      promotion: canPromotePersistedCandidate({
        verificationStatus,
        doNotContact: input.doNotContact,
        optedOut: input.optedOut,
        hasSourceUrls: sourceUrls.length > 0,
        sourceMode: input.source,
        contactabilityReviewed: false,
        qualityReviewed: false,
        adminAction: false,
      }),
      noSmsSent: true,
      noOutreachSent: true,
      noGroupChatCreated: true,
      noProductionSagaData: true,
    };
  }

  const db = getDb();
  const searchRunId =
    input.searchRunId ||
    (
      await db.talentSearchRun.create({
        data: {
          querySummary: `Graph persistence for ${input.role}`,
          sourceMode:
            input.source === "PUBLIC_WEB_RESEARCH"
              ? "WEB_RESEARCH_SHADOW"
              : "INTERNAL_ONLY",
          warnings: ["candidate_graph_persistence_created_search_run"],
        },
      })
    ).id;

  const created = await db.talentCandidate.create({
    data: {
      searchRunId,
      publicWebResearchResultId: input.publicWebResearchResultId || null,
      personId: input.personId || null,
      creatorProfileId: input.creatorProfileId || null,
      contactId: input.contactId || null,
      candidateRecommendationId: input.candidateRecommendationId || null,
      source: input.source,
      displayName: input.displayName,
      role: input.role,
      city: input.city || null,
      fandoms: input.fandoms || [],
      skills: input.skills || [],
      portfolioUrls: input.portfolioUrls || [],
      publicSourceUrls: sourceUrls,
      evidence: plannedCandidate.evidence,
      status: plannedCandidate.status,
      verificationStatus,
      risks: input.doNotContact || input.optedOut ? ["do_not_contact_or_opted_out"] : [],
      missingInfo:
        verificationStatus === "NEEDS_CONTACTABILITY_REVIEW"
          ? ["contactability_review_required"]
          : [],
    },
  });

  for (const evidence of input.contactabilityEvidence || []) {
    await db.contactabilityEvidence.create({
      data: {
        talentCandidateId: created.id,
        channel: evidence.channel,
        valueRedacted: evidence.valueRedacted || null,
        sourceUrl: evidence.sourceUrl || null,
        sourceTitle: evidence.sourceTitle || null,
        evidenceTextSummary: evidence.evidenceTextSummary || null,
        isPubliclyVisible: Boolean(evidence.isPubliclyVisible),
        isBusinessFacing: Boolean(evidence.isBusinessFacing),
        isPersonalContact: Boolean(evidence.isPersonalContact),
        outreachAllowed: false,
      },
    });
  }

  const searchProfile = buildCandidateSearchProfile({
    talentCandidateId: created.id,
    personId: created.personId,
    creatorProfileId: created.creatorProfileId,
    contactId: created.contactId,
    displayName: created.displayName,
    roles: [created.role],
    skills: input.skills,
    fandoms: input.fandoms,
    communities: input.communities,
    city: created.city,
    sourceMode: created.source,
    reviewStatus: verificationStatus,
    doNotContact: created.status === "DO_NOT_CONTACT",
    optedOut: input.optedOut,
  });
  await db.candidateSearchProfile.create({
    data: {
      personId: searchProfile.personId,
      creatorProfileId: searchProfile.creatorProfileId,
      contactId: searchProfile.contactId,
      talentCandidateId: created.id,
      displayName: searchProfile.displayName,
      roleTags: searchProfile.roleTags,
      skillTags: searchProfile.skillTags,
      fandomTags: searchProfile.fandomTags,
      communityTags: searchProfile.communityTags,
      city: searchProfile.city,
      metro: searchProfile.metro,
      locationConfidence: searchProfile.locationConfidence,
      reviewStatus: searchProfile.reviewStatus,
      sourceMode: searchProfile.sourceMode,
      evidenceQualityScore: searchProfile.evidenceQualityScore,
      contactabilityScore: searchProfile.contactabilityScore,
      doNotContact: searchProfile.doNotContact,
      optedOut: searchProfile.optedOut,
      lastIndexedAt: searchProfile.lastIndexedAt,
    },
  });

  await logAudit({
    actorType: "SYSTEM",
    action: candidateGraphAuditEvents.candidatePersisted,
    entityType: "TalentCandidate",
    entityId: created.id,
    metadata: {
      source: created.source,
      verificationStatus,
      duplicateStatus: duplicate.duplicateStatus,
      sourceUrlCount: sourceUrls.length,
      noSmsSent: true,
      noOutreachSent: true,
      noGroupChatCreated: true,
    },
  });

  return {
    ok: true,
    persisted: true,
    candidateId: created.id,
    verificationStatus,
    duplicate,
    noSmsSent: true,
    noOutreachSent: true,
    noGroupChatCreated: true,
    noProductionSagaData: true,
  };
}
