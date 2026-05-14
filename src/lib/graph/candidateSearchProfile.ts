import type { CandidateVerificationStatus } from "@prisma/client";
import { evaluateContactabilityEvidence } from "@/lib/sourcing/contactabilityEvidence";
import { normalizeLocationText } from "@/lib/graph/locationNormalization";
import { normalizeTag, type TagCategory } from "@/lib/graph/tagTaxonomy";

type ContactabilityLike = {
  channel: Parameters<typeof evaluateContactabilityEvidence>[0]["channel"];
  sourceUrl?: string | null;
  value?: string | null;
  isPubliclyVisible?: boolean;
  isBusinessFacing?: boolean;
  isPersonalContact?: boolean;
};

export type CandidateSearchProfileInput = {
  personId?: string | null;
  creatorProfileId?: string | null;
  contactId?: string | null;
  talentCandidateId?: string | null;
  displayName: string;
  roles?: string[];
  skills?: string[];
  fandoms?: string[];
  communities?: string[];
  city?: string | null;
  sourceMode: string;
  reviewStatus?: CandidateVerificationStatus;
  evidenceQualityScore?: number;
  contactabilityEvidence?: ContactabilityLike[];
  doNotContact?: boolean;
  optedOut?: boolean;
  privateNotes?: string | null;
};

function normalizeTags(values: string[], categoryHint: TagCategory) {
  return [...new Set(values.map((value) => normalizeTag(value, { categoryHint }).canonical))];
}

export function buildCandidateSearchProfile(input: CandidateSearchProfileInput) {
  const location = normalizeLocationText(input.city);
  const contactabilityScores = (input.contactabilityEvidence || []).map(
    (evidence) => evaluateContactabilityEvidence(evidence).score,
  );
  const contactabilityScore =
    contactabilityScores.length > 0
      ? Math.round(
          contactabilityScores.reduce((sum, score) => sum + score, 0) /
            contactabilityScores.length,
        )
      : 0;

  return {
    personId: input.personId || null,
    creatorProfileId: input.creatorProfileId || null,
    contactId: input.contactId || null,
    talentCandidateId: input.talentCandidateId || null,
    displayName: input.displayName,
    roleTags: normalizeTags(input.roles || [], "role"),
    skillTags: normalizeTags(input.skills || [], "skill"),
    fandomTags: normalizeTags(input.fandoms || [], "fandom"),
    communityTags: normalizeTags(input.communities || [], "community"),
    city: location.city,
    metro: location.metro,
    locationConfidence: location.confidence,
    reviewStatus: input.reviewStatus || "DISCOVERED",
    sourceMode: input.sourceMode,
    evidenceQualityScore: input.evidenceQualityScore || 0,
    contactabilityScore,
    doNotContact: Boolean(input.doNotContact),
    optedOut: Boolean(input.optedOut),
    lastIndexedAt: new Date(),
    organizerSafe: {
      displayName: input.displayName,
      roleTags: normalizeTags(input.roles || [], "role"),
      fandomTags: normalizeTags(input.fandoms || [], "fandom"),
      city: location.city,
      metro: location.metro,
      reviewStatus: input.reviewStatus || "DISCOVERED",
      sourceMode: input.sourceMode,
    },
    privateNotesRedacted: input.privateNotes ? "[redacted]" : null,
  };
}

export function canPromotePersistedCandidate(input: {
  verificationStatus: string;
  doNotContact?: boolean;
  optedOut?: boolean;
  hasSourceUrls?: boolean;
  sourceMode?: string;
  contactabilityReviewed?: boolean;
  qualityReviewed?: boolean;
  adminAction?: boolean;
}) {
  const publicWeb = input.sourceMode === "PUBLIC_WEB_RESEARCH";
  const blockers = [
    input.doNotContact ? "do_not_contact" : null,
    input.optedOut ? "opted_out" : null,
    publicWeb && !input.hasSourceUrls ? "public_web_source_url_required" : null,
    publicWeb && !input.contactabilityReviewed ? "contactability_review_required" : null,
    publicWeb && !input.qualityReviewed ? "quality_review_required" : null,
    !input.adminAction ? "admin_action_required" : null,
    input.verificationStatus === "REJECTED" ||
    input.verificationStatus === "DUPLICATE" ||
    input.verificationStatus === "ARCHIVED"
      ? "candidate_status_not_promotable"
      : null,
  ].filter((item): item is string => Boolean(item));
  return {
    allowed: blockers.length === 0,
    blockers,
    noSmsSent: true,
    noOutreachSent: true,
    noGroupChatCreated: true,
  };
}
