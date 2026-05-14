import type {
  CandidateRecommendationStatus,
  Prisma,
  TalentCandidateStatus,
} from "@prisma/client";
import { logAudit } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";
import { ensureProjectForProjectBrief } from "@/sms-engine/networkBridge";
import type {
  ProjectUnderstanding,
  RoleMap,
} from "@/sms-engine/producer/producerAgentTypes";
import {
  scoreTalentCandidate,
  sortTalentCandidates,
} from "@/sms-engine/sourcing/talentScoring";
import {
  sourcingAuditEvents,
  safeStringArray,
  type ScoredTalentCandidate,
  type TalentCandidateInput,
  type TalentSourceMode,
} from "@/sms-engine/sourcing/talentTypes";

export type InternalTalentSearchOptions = {
  projectBriefId?: string | null;
  projectId?: string | null;
  roleOpeningId?: string | null;
  candidatePool?: TalentCandidateInput[];
  maxPerRole?: number;
  persist?: boolean;
  sourceMode?: TalentSourceMode;
};

export type InternalTalentSearchResult = {
  searchRunId?: string | null;
  sourceMode: TalentSourceMode;
  querySummary: string;
  rolesSearched: string[];
  candidates: ScoredTalentCandidate[];
  resultCount: number;
  warnings: string[];
  publicResearchSuggested: boolean;
  noSmsSent: true;
  noOutreachSent: true;
};

type ProfileWithPerson = Prisma.CreatorProfileGetPayload<{
  include: { person: { include: { legacyContact: true } } };
}>;

type ContactWithPerson = Prisma.ContactGetPayload<{
  include: { person: { include: { creatorProfile: true } } };
}>;

function unique(items: Array<string | null | undefined>) {
  return [...new Set(items.filter((item): item is string => Boolean(item)))];
}

function jsonObject(value: unknown): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Prisma.JsonObject)
    : {};
}

function querySummary(understanding: ProjectUnderstanding, roles: string[]) {
  return [
    understanding.title || understanding.projectType || "Untitled project",
    understanding.city ? `in ${understanding.city}` : null,
    roles.length ? `roles: ${roles.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function candidateFromProfile(profile: ProfileWithPerson): TalentCandidateInput {
  const person = profile.person;
  return {
    personId: person.id,
    creatorProfileId: profile.id,
    contactId: person.legacyContact?.id || null,
    source: "INTERNAL_DB",
    displayName: profile.displayName || person.name || "Internal candidate",
    role: profile.roles[0] || profile.skills[0] || "creative collaborator",
    city: profile.city || person.city,
    fandoms: unique([...profile.fandoms, ...profile.communities]),
    skills: unique([...profile.roles, ...profile.skills]),
    portfolioUrls: unique([...profile.portfolioUrls, ...profile.socialUrls]),
    publicSourceUrls: [],
    evidence: {
      reviewStatus: profile.reviewStatus,
      hasPortfolio: profile.portfolioUrls.length > 0 || profile.socialUrls.length > 0,
    },
    reviewStatus: profile.reviewStatus,
    availabilityNotes: profile.availabilityNotes,
    optedOut: person.optedOut || person.consentStatus === "OPTED_OUT",
    consentStatus: person.consentStatus,
  };
}

function candidateFromContact(contact: ContactWithPerson): TalentCandidateInput {
  const profile = contact.person?.creatorProfile || null;
  return {
    personId: contact.personId || null,
    creatorProfileId: profile?.id || null,
    contactId: contact.id,
    source: "INTERNAL_DB",
    displayName: contact.name,
    role: contact.roles[0] || contact.tags[0] || "creative collaborator",
    city: contact.city || contact.person?.city || null,
    fandoms: unique([...(profile?.fandoms || []), ...contact.tags]),
    skills: unique([...(profile?.skills || []), ...contact.roles, ...contact.tags]),
    portfolioUrls: unique([
      contact.portfolioUrl,
      contact.instagramUrl,
      ...(profile?.portfolioUrls || []),
      ...(profile?.socialUrls || []),
    ]),
    publicSourceUrls: [],
    evidence: {
      contactRecord: true,
      hasPortfolio: Boolean(contact.portfolioUrl || contact.instagramUrl),
    },
    reviewStatus: profile?.reviewStatus || "PENDING_REVIEW",
    availabilityNotes: profile?.availabilityNotes || null,
    optedOut:
      Boolean(contact.smsOptedOutAt) ||
      Boolean(contact.person?.optedOut) ||
      contact.person?.consentStatus === "OPTED_OUT",
    consentStatus: contact.person?.consentStatus || null,
  };
}

async function loadInternalCandidatePool(): Promise<TalentCandidateInput[]> {
  if (!process.env.DATABASE_URL) return [];
  const db = getDb();
  const [profiles, contacts] = await Promise.all([
    db.creatorProfile.findMany({
      include: { person: { include: { legacyContact: true } } },
      take: 500,
    }),
    db.contact.findMany({
      include: { person: { include: { creatorProfile: true } } },
      take: 500,
    }),
  ]);

  const byKey = new Map<string, TalentCandidateInput>();
  for (const item of profiles.map(candidateFromProfile)) {
    byKey.set(item.personId || item.creatorProfileId || item.displayName, item);
  }
  for (const item of contacts.map(candidateFromContact)) {
    const key = item.personId || item.creatorProfileId || item.contactId || item.displayName;
    if (!byKey.has(key)) byKey.set(key, item);
  }
  return Array.from(byKey.values());
}

function auditMetadata(input: {
  projectBriefId?: string | null;
  projectId?: string | null;
  roleOpeningId?: string | null;
  searchRunId?: string | null;
  sourceMode: TalentSourceMode;
  counts?: number;
  warnings?: string[];
}) {
  return {
    projectBriefId: input.projectBriefId || null,
    projectId: input.projectId || null,
    roleOpeningId: input.roleOpeningId || null,
    searchRunId: input.searchRunId || null,
    sourceMode: input.sourceMode,
    count: input.counts ?? 0,
    warningCount: input.warnings?.length ?? 0,
    noSmsSent: true,
    noOutreachSent: true,
    noPrivateNotes: true,
  };
}

async function persistSearchRun(input: {
  options: InternalTalentSearchOptions;
  sourceMode: TalentSourceMode;
  querySummary: string;
  rolesSearched: string[];
  candidates: ScoredTalentCandidate[];
  warnings: string[];
}) {
  if (!process.env.DATABASE_URL || !input.options.persist) return null;
  const db = getDb();
  const run = await db.talentSearchRun.create({
    data: {
      projectBriefId: input.options.projectBriefId || null,
      projectId: input.options.projectId || null,
      roleOpeningId: input.options.roleOpeningId || null,
      status: "COMPLETED",
      sourceMode: input.sourceMode,
      querySummary: input.querySummary,
      rolesSearched: input.rolesSearched,
      resultCount: input.candidates.length,
      warnings: input.warnings,
      candidates: {
        create: input.candidates.map((candidate) => ({
          personId: candidate.personId || null,
          creatorProfileId: candidate.creatorProfileId || null,
          contactId: candidate.contactId || null,
          candidateRecommendationId: candidate.candidateRecommendationId || null,
          source: candidate.source || "INTERNAL_DB",
          displayName: candidate.displayName,
          role: candidate.role,
          city: candidate.city || null,
          fandoms: candidate.fandoms || [],
          skills: candidate.skills || [],
          portfolioUrls: candidate.portfolioUrls || [],
          publicSourceUrls: candidate.publicSourceUrls || [],
          evidence: {
            matchingReasons: candidate.matchingReasons,
            publicSourceUrls: candidate.publicSourceUrls || [],
            ...candidate.evidence,
          },
          score: candidate.score,
          scoreBreakdown: candidate.scoreBreakdown,
          status: candidate.status,
          risks: candidate.risks,
          missingInfo: candidate.missingInfo,
        })),
      },
    },
  });
  await logAudit({
    actorType: "ADMIN",
    action: sourcingAuditEvents.internalSearchRunCreated,
    entityType: "TalentSearchRun",
    entityId: run.id,
    metadata: auditMetadata({
      ...input.options,
      searchRunId: run.id,
      sourceMode: input.sourceMode,
      counts: input.candidates.length,
      warnings: input.warnings,
    }),
  });
  await logAudit({
    actorType: "ADMIN",
    action: sourcingAuditEvents.internalSearchCompleted,
    entityType: "TalentSearchRun",
    entityId: run.id,
    metadata: auditMetadata({
      ...input.options,
      searchRunId: run.id,
      sourceMode: input.sourceMode,
      counts: input.candidates.length,
      warnings: input.warnings,
    }),
  });
  return run.id;
}

export async function searchInternalTalentForProject(
  understanding: ProjectUnderstanding,
  roleMap: RoleMap,
  options: InternalTalentSearchOptions = {},
): Promise<InternalTalentSearchResult> {
  const sourceMode = options.sourceMode || "INTERNAL_ONLY";
  const roles = [...roleMap.requiredRoles, ...roleMap.optionalRoles];
  const rolesSearched = roles.map((role) => role.roleType);
  const pool = options.candidatePool || (await loadInternalCandidatePool());
  const maxPerRole = options.maxPerRole ?? 5;
  const warnings: string[] = [];
  if (pool.length === 0) {
    warnings.push("No internal talent records were available for search.");
  }

  const candidates = sortTalentCandidates(
    roles.flatMap((role) =>
      pool
        .map((candidate) => scoreTalentCandidate({ candidate, role, understanding }))
        .filter((candidate): candidate is ScoredTalentCandidate => Boolean(candidate))
        .slice(0, 50),
    ),
  ).slice(0, Math.max(maxPerRole, roles.length * maxPerRole));

  const publicResearchSuggested =
    roles.length > 0 &&
    candidates.filter((candidate) => candidate.status === "SUGGESTED").length <
      Math.min(roles.length, 3);
  if (publicResearchSuggested) {
    warnings.push("Internal coverage is thin; generate a public research plan for admin review.");
  }

  const summary = querySummary(understanding, rolesSearched);
  const searchRunId = await persistSearchRun({
    options,
    sourceMode,
    querySummary: summary,
    rolesSearched,
    candidates,
    warnings,
  });

  return {
    searchRunId,
    sourceMode,
    querySummary: summary,
    rolesSearched,
    candidates,
    resultCount: candidates.length,
    warnings,
    publicResearchSuggested,
    noSmsSent: true,
    noOutreachSent: true,
  };
}

export function canPromoteTalentCandidateToShortlist(candidate: {
  status: string;
  personId?: string | null;
  source?: string | null;
}) {
  return (
    candidate.status === "APPROVED_FOR_SHORTLIST" &&
    Boolean(candidate.personId) &&
    candidate.source !== "PUBLIC_WEB_RESEARCH"
  );
}

export async function updateTalentCandidateStatus(input: {
  candidateId: string;
  status: TalentCandidateStatus;
  adminNotes?: string | null;
}) {
  const db = getDb();
  const current = await db.talentCandidate.findUniqueOrThrow({
    where: { id: input.candidateId },
    include: {
      researchReviews: { orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });
  const latestReview = current.researchReviews[0];
  if (
    input.status === "APPROVED_FOR_SHORTLIST" &&
    current.source === "PUBLIC_WEB_RESEARCH" &&
    latestReview?.reviewStatus !== "APPROVED_FOR_SHORTLIST"
  ) {
    throw new Error(
      "Public-web candidates require an approved talent research quality review before shortlist approval.",
    );
  }

  const updated = await db.talentCandidate.update({
    where: { id: input.candidateId },
    data: {
      status: input.status,
      adminNotes: input.adminNotes || undefined,
    },
  });
  const actionByStatus: Record<TalentCandidateStatus, string> = {
    SUGGESTED: sourcingAuditEvents.candidateScored,
    APPROVED_FOR_SHORTLIST: sourcingAuditEvents.candidateApproved,
    REJECTED: sourcingAuditEvents.candidateRejected,
    NEEDS_MORE_INFO: sourcingAuditEvents.candidateMarkedNeedsMoreInfo,
    DO_NOT_CONTACT: sourcingAuditEvents.candidateMarkedDoNotContact,
  };
  await logAudit({
    actorType: "ADMIN",
    action: actionByStatus[input.status],
    entityType: "TalentCandidate",
    entityId: updated.id,
    metadata: {
      candidateId: updated.id,
      searchRunId: updated.searchRunId,
      status: updated.status,
      sourceMode: updated.source,
      noSmsSent: true,
      noOutreachSent: true,
      noPrivateNotes: true,
    },
  });
  return updated;
}

export async function promoteTalentCandidateToRecommendation(input: {
  candidateId: string;
  opportunityId: string;
}) {
  const db = getDb();
  const candidate = await db.talentCandidate.findUniqueOrThrow({
    where: { id: input.candidateId },
  });
  if (!canPromoteTalentCandidateToShortlist(candidate)) {
    throw new Error("Candidate must be internal, approved, and linked to a person before promotion.");
  }
  const recommendation = await db.candidateRecommendation.upsert({
    where: {
      opportunityId_personId: {
        opportunityId: input.opportunityId,
        personId: candidate.personId!,
      },
    },
    create: {
      opportunityId: input.opportunityId,
      personId: candidate.personId!,
      score: candidate.score,
      scoreBreakdown: candidate.scoreBreakdown as Prisma.InputJsonValue,
      proximityTier: "UNKNOWN",
      matchingReasons:
        safeStringArray(jsonObject(candidate.evidence).matchingReasons).length > 0
          ? safeStringArray(jsonObject(candidate.evidence).matchingReasons)
          : [
          "Approved through Talent Discovery admin review.",
        ],
      risks: safeStringArray(candidate.risks),
      status: "APPROVED_FOR_SHORTLIST" as CandidateRecommendationStatus,
    },
    update: {
      score: candidate.score,
      scoreBreakdown: candidate.scoreBreakdown as Prisma.InputJsonValue,
      status: "APPROVED_FOR_SHORTLIST",
      updatedAt: new Date(),
    },
  });
  await db.talentCandidate.update({
    where: { id: candidate.id },
    data: { candidateRecommendationId: recommendation.id },
  });
  return recommendation;
}

export async function runInternalTalentSearchForProjectBrief(projectBriefId: string) {
  const { buildProjectUnderstanding } = await import("@/sms-engine/producer/projectUnderstanding");
  const { generateRoleMap } = await import("@/sms-engine/producer/roleMap");
  const projectBrief = await getDb().projectBrief.findUniqueOrThrow({
    where: { id: projectBriefId },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  const project = await ensureProjectForProjectBrief(projectBriefId);
  const understanding = buildProjectUnderstanding({
    projectBrief,
    project,
    recentMessages: projectBrief.messages,
  });
  const roleMap = generateRoleMap(understanding);
  return searchInternalTalentForProject(understanding, roleMap, {
    projectBriefId,
    projectId: project.id,
    persist: true,
    sourceMode: "INTERNAL_PLUS_RESEARCH_PLAN",
  });
}
