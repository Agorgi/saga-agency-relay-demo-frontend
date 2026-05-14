import type { CandidateVerificationStatus } from "@prisma/client";
import { getDb } from "@/lib/db";
import type { ProjectUnderstanding, RoleMap } from "@/lib/producer/producerAgentTypes";
import { normalizeLocationText } from "@/lib/graph/locationNormalization";
import { normalizeTag } from "@/lib/graph/tagTaxonomy";

export type CandidatePoolSourceMode =
  | "INTERNAL_DB"
  | "PUBLIC_WEB_RESEARCH"
  | "MIXED"
  | "ADMIN_ADDED";

export type CandidatePoolProfile = {
  id: string;
  candidateSearchProfileId?: string | null;
  personId?: string | null;
  creatorProfileId?: string | null;
  contactId?: string | null;
  talentCandidateId?: string | null;
  candidateRecommendationId?: string | null;
  publicWebResearchResultId?: string | null;
  displayName: string;
  roleTags: string[];
  skillTags: string[];
  fandomTags: string[];
  communityTags: string[];
  city?: string | null;
  metro?: string | null;
  locationConfidence?: number;
  reviewStatus: CandidateVerificationStatus | string;
  sourceMode: CandidatePoolSourceMode;
  evidenceQualityScore: number;
  contactabilityScore: number;
  contactabilityRisk?: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED" | "UNKNOWN";
  recommendedContactPathForAdminReview?: string | null;
  doNotContact: boolean;
  optedOut: boolean;
};

export type CandidateRetrievalOptions = {
  poolCap?: number;
  perRolePoolCap?: number;
  publicWebUnverifiedCap?: number;
  minInternalCoverage?: number;
  profiles?: CandidatePoolProfile[];
};

const EXCLUDED_STATUSES = new Set(["REJECTED", "ARCHIVED", "DO_NOT_CONTACT", "DUPLICATE"]);
const UNVERIFIED_PUBLIC_WEB = new Set([
  "DISCOVERED",
  "NEEDS_IDENTITY_REVIEW",
  "NEEDS_CONTACTABILITY_REVIEW",
  "NEEDS_QUALITY_REVIEW",
]);

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function canonical(value: string) {
  return normalizeTag(value).canonical.toLowerCase();
}

function overlaps(left: string[], right: string[]) {
  const rightSet = new Set(right.map(canonical));
  return left.some((item) => rightSet.has(canonical(item)));
}

function roleTargets(roleMap: RoleMap) {
  return [...roleMap.requiredRoles, ...roleMap.optionalRoles].map((role) => ({
    role: role.roleType,
    roleTags: [role.roleType, role.title],
    skillTags: role.requiredSkills,
    fandomTags: role.preferredFandoms,
    localRequired: role.localRequired,
  }));
}

function profileMatches(profile: CandidatePoolProfile, project: ProjectUnderstanding, roleMap: RoleMap) {
  const targets = roleTargets(roleMap);
  const projectLocation = normalizeLocationText(project.city);
  return targets.some((target) =>
    overlaps(profile.roleTags, target.roleTags) ||
    overlaps(profile.skillTags, target.skillTags) ||
    overlaps([...profile.fandomTags, ...profile.communityTags], [
      ...target.fandomTags,
      ...project.fandoms,
      ...project.communities,
    ]) ||
    Boolean(
      projectLocation.city &&
        (profile.city === projectLocation.city || profile.metro === projectLocation.metro),
    ),
  );
}

function applyCaps(input: {
  profiles: CandidatePoolProfile[];
  roleMap: RoleMap;
  poolCap: number;
  perRolePoolCap: number;
  publicWebUnverifiedCap: number;
  minInternalCoverage: number;
}) {
  const byId = new Map<string, CandidatePoolProfile>();
  const internalCount = input.profiles.filter((profile) => profile.sourceMode !== "PUBLIC_WEB_RESEARCH").length;
  let unverifiedPublicWebCount = 0;
  for (const target of roleTargets(input.roleMap)) {
    const perRole = input.profiles
      .filter((profile) =>
        overlaps(profile.roleTags, target.roleTags) ||
        overlaps(profile.skillTags, target.skillTags),
      )
      .slice(0, input.perRolePoolCap);
    for (const profile of perRole) {
      const unverifiedPublic =
        profile.sourceMode === "PUBLIC_WEB_RESEARCH" &&
        UNVERIFIED_PUBLIC_WEB.has(String(profile.reviewStatus));
      if (unverifiedPublic && internalCount >= input.minInternalCoverage) continue;
      if (unverifiedPublic && unverifiedPublicWebCount >= input.publicWebUnverifiedCap) continue;
      if (unverifiedPublic) unverifiedPublicWebCount += 1;
      byId.set(profile.id, profile);
      if (byId.size >= input.poolCap) break;
    }
    if (byId.size >= input.poolCap) break;
  }
  if (byId.size < input.poolCap) {
    for (const profile of input.profiles) {
      const unverifiedPublic =
        profile.sourceMode === "PUBLIC_WEB_RESEARCH" &&
        UNVERIFIED_PUBLIC_WEB.has(String(profile.reviewStatus));
      if (unverifiedPublic && internalCount >= input.minInternalCoverage) continue;
      if (unverifiedPublic && unverifiedPublicWebCount >= input.publicWebUnverifiedCap) continue;
      if (unverifiedPublic) unverifiedPublicWebCount += 1;
      byId.set(profile.id, profile);
      if (byId.size >= input.poolCap) break;
    }
  }
  return [...byId.values()];
}

export async function retrieveCandidatePoolForProject(
  projectUnderstanding: ProjectUnderstanding,
  roleMap: RoleMap,
  options: CandidateRetrievalOptions = {},
) {
  const poolCap = options.poolCap ?? 250;
  const perRolePoolCap = options.perRolePoolCap ?? 50;
  const publicWebUnverifiedCap = options.publicWebUnverifiedCap ?? 25;
  const minInternalCoverage = options.minInternalCoverage ?? 5;
  const sourceProfiles: CandidatePoolProfile[] =
    options.profiles ||
    (process.env.DATABASE_URL
      ? await getDb().candidateSearchProfile.findMany({
          where: {
            doNotContact: false,
            optedOut: false,
            reviewStatus: { notIn: ["REJECTED", "ARCHIVED", "DO_NOT_CONTACT", "DUPLICATE"] },
          },
          orderBy: [{ evidenceQualityScore: "desc" }, { lastIndexedAt: "desc" }],
          take: poolCap,
        }).then((profiles) =>
          profiles.map((profile): CandidatePoolProfile => ({
            id: profile.id,
            candidateSearchProfileId: profile.id,
            personId: profile.personId,
            creatorProfileId: profile.creatorProfileId,
            contactId: profile.contactId,
            talentCandidateId: profile.talentCandidateId,
            displayName: profile.displayName,
            roleTags: strings(profile.roleTags),
            skillTags: strings(profile.skillTags),
            fandomTags: strings(profile.fandomTags),
            communityTags: strings(profile.communityTags),
            city: profile.city,
            metro: profile.metro,
            locationConfidence: profile.locationConfidence,
            reviewStatus: profile.reviewStatus,
            sourceMode:
              profile.sourceMode === "PUBLIC_WEB_RESEARCH"
                ? "PUBLIC_WEB_RESEARCH"
                : profile.sourceMode === "ADMIN_ADDED"
                  ? "ADMIN_ADDED"
                  : "INTERNAL_DB",
            evidenceQualityScore: profile.evidenceQualityScore,
            contactabilityScore: profile.contactabilityScore,
            doNotContact: profile.doNotContact,
            optedOut: profile.optedOut,
          })),
        )
      : []);

  const filtered = sourceProfiles.filter(
    (profile) =>
      !profile.doNotContact &&
      !profile.optedOut &&
      !EXCLUDED_STATUSES.has(String(profile.reviewStatus)) &&
      profileMatches(profile, projectUnderstanding, roleMap),
  );
  const capped = applyCaps({
    profiles: filtered,
    roleMap,
    poolCap,
    perRolePoolCap,
    publicWebUnverifiedCap,
    minInternalCoverage,
  });

  return {
    candidates: capped,
    filtersApplied: {
      poolCap,
      perRolePoolCap,
      publicWebUnverifiedCap,
      minInternalCoverage,
      excludedStatuses: [...EXCLUDED_STATUSES],
      retrievalOrder: [
        "role_tags",
        "skill_tags",
        "fandom_community_tags",
        "city_metro",
        "internal_reviewed_profiles",
        "reviewed_public_web_candidates",
        "unverified_public_web_when_internal_coverage_is_weak",
      ],
    },
    candidatePoolSize: capped.length,
  };
}
