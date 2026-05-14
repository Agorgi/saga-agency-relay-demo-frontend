import { getDb } from "@/lib/db";
import {
  canonicalizeProfileUrl,
  normalizeSourceUrl,
} from "@/lib/sourcing/sourceNormalization";

export type PublicWebDuplicateStatus =
  | "NO_DUPLICATE"
  | "POSSIBLE_DUPLICATE"
  | "LIKELY_DUPLICATE"
  | "MATCHES_INTERNAL_PROFILE"
  | "MATCHES_EXISTING_PUBLIC_RESULT";

export type PublicWebDuplicateResult = {
  duplicateStatus: PublicWebDuplicateStatus;
  matchedRecordType: string | null;
  matchedRecordId: string | null;
  confidence: number;
  reasons: string[];
  recommendedAction:
    | "CONTINUE_REVIEW"
    | "LINK_TO_INTERNAL_PROFILE"
    | "MARK_DUPLICATE"
    | "NEEDS_REVIEW";
};

function normalizedName(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function overlap(a: string[], b: string[]) {
  const set = new Set(a.map((item) => item.toLowerCase()));
  return b.filter((item) => set.has(item.toLowerCase())).length;
}

export function detectPublicWebDuplicateFromCandidates(input: {
  displayName: string;
  city?: string | null;
  role?: string | null;
  profileUrls?: string[];
  sourceUrls?: string[];
  existing: Array<{
    id: string;
    type: string;
    displayName?: string | null;
    city?: string | null;
    role?: string | null;
    profileUrls?: string[];
    sourceUrls?: string[];
    approvedInternal?: boolean;
  }>;
}): PublicWebDuplicateResult {
  const name = normalizedName(input.displayName);
  const urls = [
    ...(input.profileUrls || []).map(canonicalizeProfileUrl),
    ...(input.sourceUrls || []).map(normalizeSourceUrl),
  ].filter(Boolean);
  let best: PublicWebDuplicateResult = {
    duplicateStatus: "NO_DUPLICATE",
    matchedRecordType: null,
    matchedRecordId: null,
    confidence: 0,
    reasons: [],
    recommendedAction: "CONTINUE_REVIEW",
  };

  for (const candidate of input.existing) {
    const reasons: string[] = [];
    let confidence = 0;
    const existingName = normalizedName(candidate.displayName);
    if (name && existingName && name === existingName) {
      confidence += 0.35;
      reasons.push("normalized_name_match");
    }
    const existingUrls = [
      ...(candidate.profileUrls || []).map(canonicalizeProfileUrl),
      ...(candidate.sourceUrls || []).map(normalizeSourceUrl),
    ].filter(Boolean);
    const urlOverlap = overlap(urls, existingUrls);
    if (urlOverlap > 0) {
      confidence += 0.45;
      reasons.push("profile_or_source_url_match");
    }
    if (
      input.city &&
      candidate.city &&
      input.city.toLowerCase() === candidate.city.toLowerCase()
    ) {
      confidence += 0.1;
      reasons.push("city_match");
    }
    if (
      input.role &&
      candidate.role &&
      candidate.role.toLowerCase().includes(input.role.toLowerCase())
    ) {
      confidence += 0.1;
      reasons.push("role_overlap");
    }
    if (candidate.approvedInternal) confidence += 0.1;
    if (confidence > best.confidence) {
      const internal = ["Person", "CreatorProfile", "Contact"].includes(candidate.type);
      best = {
        duplicateStatus:
          internal && confidence >= 0.55
            ? "MATCHES_INTERNAL_PROFILE"
            : confidence >= 0.75
              ? "LIKELY_DUPLICATE"
              : confidence >= 0.45
                ? "POSSIBLE_DUPLICATE"
                : "NO_DUPLICATE",
        matchedRecordType: confidence >= 0.45 ? candidate.type : null,
        matchedRecordId: confidence >= 0.45 ? candidate.id : null,
        confidence: Number(confidence.toFixed(2)),
        reasons,
        recommendedAction:
          internal && confidence >= 0.55
            ? "LINK_TO_INTERNAL_PROFILE"
            : confidence >= 0.75
              ? "MARK_DUPLICATE"
              : confidence >= 0.45
                ? "NEEDS_REVIEW"
                : "CONTINUE_REVIEW",
      };
    }
  }

  return best;
}

export async function detectPublicWebDuplicate(input: {
  resultId?: string | null;
  displayName: string;
  city?: string | null;
  role?: string | null;
  profileUrls?: string[];
  sourceUrls?: string[];
}) {
  if (!process.env.DATABASE_URL) {
    return detectPublicWebDuplicateFromCandidates({ ...input, existing: [] });
  }

  const db = getDb();
  const [people, profiles, contacts, publicResults] = await Promise.all([
    db.person.findMany({
      take: 100,
      select: { id: true, name: true, city: true },
    }),
    db.creatorProfile.findMany({
      take: 100,
      select: {
        id: true,
        displayName: true,
        city: true,
        roles: true,
        portfolioUrls: true,
        socialUrls: true,
        reviewStatus: true,
      },
    }),
    db.contact.findMany({
      take: 100,
      select: { id: true, name: true, city: true, roles: true, portfolioUrl: true, instagramUrl: true },
    }),
    db.publicWebResearchResult.findMany({
      where: input.resultId ? { id: { not: input.resultId } } : undefined,
      take: 100,
      select: {
        id: true,
        displayName: true,
        city: true,
        role: true,
        publicProfileUrls: true,
        sourceUrls: true,
      },
    }),
  ]);

  return detectPublicWebDuplicateFromCandidates({
    ...input,
    existing: [
      ...people.map((person) => ({
        id: person.id,
        type: "Person",
        displayName: person.name,
        city: person.city,
        approvedInternal: true,
      })),
      ...profiles.map((profile) => ({
        id: profile.id,
        type: "CreatorProfile",
        displayName: profile.displayName,
        city: profile.city,
        role: profile.roles[0] || null,
        profileUrls: [...profile.portfolioUrls, ...profile.socialUrls],
        approvedInternal: profile.reviewStatus === "APPROVED",
      })),
      ...contacts.map((contact) => ({
        id: contact.id,
        type: "Contact",
        displayName: contact.name,
        city: contact.city,
        role: contact.roles[0] || null,
        profileUrls: [contact.portfolioUrl, contact.instagramUrl].filter(
          (item): item is string => Boolean(item),
        ),
        approvedInternal: true,
      })),
      ...publicResults.map((result) => ({
        id: result.id,
        type: "PublicWebResearchResult",
        displayName: result.displayName,
        city: result.city,
        role: result.role,
        profileUrls: Array.isArray(result.publicProfileUrls)
          ? result.publicProfileUrls.filter((item): item is string => typeof item === "string")
          : [],
        sourceUrls: Array.isArray(result.sourceUrls)
          ? result.sourceUrls.filter((item): item is string => typeof item === "string")
          : [],
      })),
    ],
  });
}
