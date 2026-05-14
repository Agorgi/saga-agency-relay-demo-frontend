import type {
  ProjectUnderstanding,
  ProducerRole,
} from "@/lib/producer/producerAgentTypes";
import type {
  ScoredTalentCandidate,
  TalentCandidateInput,
  TalentScoreBreakdown,
} from "@/lib/sourcing/talentTypes";
import { safeStringArray } from "@/lib/sourcing/talentTypes";

function canonical(value?: string | null) {
  return (value || "").toLowerCase().trim();
}

function includesAny(haystack: string[], needles: string[]) {
  const text = haystack.map(canonical);
  return needles.filter((needle) =>
    text.some((item) => item.includes(canonical(needle)) || canonical(needle).includes(item)),
  );
}

function unique(items: Array<string | null | undefined>) {
  return [...new Set(items.filter((item): item is string => Boolean(item)))];
}

function roleAliases(role: string) {
  const normalized = canonical(role);
  const aliases: Record<string, string[]> = {
    photographer: ["photographer", "photography", "photo", "content", "camera"],
    videographer: ["videographer", "video", "content", "camera"],
    dj: ["dj", "music", "audio", "sound", "nightlife"],
    host: ["host", "hosting", "emcee", "community"],
    cosplayer: ["cosplayer", "cosplay", "costume", "appearance"],
    illustrator: ["illustrator", "illustration", "artist", "art"],
    designer: ["designer", "design", "graphics", "branding"],
    vendor: ["vendor", "market", "booth", "seller"],
    producer: ["producer", "production", "operations", "logistics"],
    venue: ["venue", "space", "location"],
  };
  const matched = Object.entries(aliases).find(([key]) =>
    normalized.includes(key),
  );
  return matched ? matched[1] : [normalized];
}

function cityMatches(left?: string | null, right?: string | null) {
  if (!left || !right) return false;
  const a = canonical(left);
  const b = canonical(right);
  return a.includes(b) || b.includes(a);
}

function clamp(value: number, max: number) {
  return Math.max(0, Math.min(max, value));
}

export function scoreTalentCandidate(input: {
  candidate: TalentCandidateInput;
  role: ProducerRole | { roleType: string; title?: string; requiredSkills?: string[]; preferredFandoms?: string[]; localRequired?: boolean };
  understanding: ProjectUnderstanding;
}): ScoredTalentCandidate | null {
  const candidate = input.candidate;
  if (
    candidate.optedOut ||
    candidate.doNotContact ||
    candidate.consentStatus === "OPTED_OUT" ||
    candidate.reviewStatus === "REJECTED"
  ) {
    return null;
  }

  const role = input.role;
  const roleText = [role.roleType, role.title || "", ...roleAliases(role.roleType)];
  const candidateRoleText = [
    candidate.role,
    ...(candidate.skills || []),
    ...safeStringArray(candidate.evidence?.roleEvidence),
  ];
  const roleMatches = includesAny(candidateRoleText, roleText);
  const skillMatches = includesAny(
    candidate.skills || [],
    role.requiredSkills || [],
  );
  const fandomMatches = includesAny(
    [...(candidate.fandoms || []), ...safeStringArray(candidate.evidence?.communities)],
    [...input.understanding.fandoms, ...(role.preferredFandoms || [])],
  );
  const sameCity = cityMatches(candidate.city, input.understanding.city);
  const hasPortfolio = (candidate.portfolioUrls || []).length > 0;
  const hasPublicSources = (candidate.publicSourceUrls || []).length > 0;
  const relationshipTier = candidate.relationshipTier || "UNKNOWN";

  const breakdown: TalentScoreBreakdown = {
    roleFit: clamp(
      (roleMatches.length ? 14 : 0) + Math.min(11, skillMatches.length * 4),
      25,
    ),
    fandomFit: clamp(fandomMatches.length * 7, 20),
    locationFit: sameCity ? 15 : role.localRequired ? 0 : 6,
    evidenceQuality: clamp(
      (hasPortfolio ? 8 : 0) +
        (hasPublicSources ? 5 : 0) +
        (candidate.evidence && Object.keys(candidate.evidence).length ? 2 : 0),
      15,
    ),
    proximityInternalRelationship: clamp(
      {
        FRIEND: 15,
        MUTUAL: 12,
        COMMUNITY: 9,
        LOCAL: 6,
        EXTENDED: 3,
        PUBLIC: 0,
        UNKNOWN: 0,
      }[relationshipTier] ?? 0,
      15,
    ),
    availabilityReviewStatus: clamp(
      (candidate.reviewStatus === "APPROVED" ? 7 : 0) +
        (candidate.availabilityNotes ? 2 : 0) +
        (candidate.responsivenessScore ? Math.min(1, candidate.responsivenessScore) : 0),
      10,
    ),
  };
  const score = Object.values(breakdown).reduce((sum, item) => sum + item, 0);
  const matchingReasons = unique([
    roleMatches[0] ? `Role fit: ${roleMatches.slice(0, 3).join(", ")}` : null,
    skillMatches[0] ? `Skill fit: ${skillMatches.slice(0, 3).join(", ")}` : null,
    fandomMatches[0] ? `Fandom/community fit: ${fandomMatches.slice(0, 3).join(", ")}` : null,
    sameCity ? `Same city: ${input.understanding.city}` : null,
    relationshipTier !== "UNKNOWN" && relationshipTier !== "PUBLIC"
      ? `Internal proximity: ${relationshipTier.toLowerCase()}`
      : null,
    candidate.reviewStatus === "APPROVED" ? "Profile reviewed by Saga" : null,
    hasPortfolio || hasPublicSources ? "Has public proof or portfolio evidence" : null,
  ]);
  const risks = unique([
    candidate.source === "PUBLIC_WEB_RESEARCH"
      ? "Public-web candidate requires human verification before any shortlist or outreach."
      : null,
    role.localRequired && !sameCity ? "Local requirement needs review." : null,
    !hasPortfolio && !hasPublicSources ? "Evidence is thin." : null,
    candidate.reviewStatus && candidate.reviewStatus !== "APPROVED"
      ? "Profile needs review."
      : null,
  ]);
  const missingInfo = unique([
    !hasPortfolio && !hasPublicSources ? "Portfolio or public source evidence" : null,
    !candidate.city ? "City" : null,
    !candidate.availabilityNotes ? "Availability is unverified" : null,
  ]);

  const status =
    candidate.source === "PUBLIC_WEB_RESEARCH" || score < 35 || missingInfo.length > 1
      ? "NEEDS_MORE_INFO"
      : "SUGGESTED";

  return {
    ...candidate,
    score,
    scoreBreakdown: breakdown,
    matchingReasons:
      matchingReasons.length > 0
        ? matchingReasons
        : ["Possible fit, but human review needs stronger evidence."],
    risks,
    missingInfo,
    status,
    confidence: Math.min(0.95, 0.35 + score / 120),
    privateNotes: undefined,
  };
}

export function sortTalentCandidates(candidates: ScoredTalentCandidate[]) {
  return [...candidates].sort((left, right) => {
    if (left.status === "SUGGESTED" && right.status !== "SUGGESTED") return -1;
    if (right.status === "SUGGESTED" && left.status !== "SUGGESTED") return 1;
    return right.score - left.score;
  });
}
