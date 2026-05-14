import type { PublicResearchCandidateCard } from "@/sms-engine/sourcing/talentTypes";

const PRIVATE_SOURCE_PATTERNS = [
  /\/login\b/i,
  /\/signin\b/i,
  /\/sign-in\b/i,
  /\/account\b/i,
  /\/messages?\b/i,
  /\/direct\b/i,
  /private/i,
  /discord\.com/i,
  /slack\.com/i,
  /facebook\.com\/groups/i,
];

export type PublicWebSourceType =
  | "INTERNAL_CREATOR_PROFILE"
  | "INTERNAL_CONTACT"
  | "INTERNAL_RELATIONSHIP_EDGE"
  | "USER_PROVIDED_PORTFOLIO"
  | "PUBLIC_PERSONAL_WEBSITE"
  | "PUBLIC_SOCIAL_PROFILE"
  | "PUBLIC_EVENT_PAGE"
  | "PUBLIC_VENDOR_DIRECTORY"
  | "PUBLIC_CONVENTION_DIRECTORY"
  | "PUBLIC_PRESS_OR_ARTICLE"
  | "PUBLIC_MARKETPLACE_PROFILE"
  | "ADMIN_ADDED"
  | "UNKNOWN";

export type CitationValidationResult = {
  valid: boolean;
  normalizedSourceUrls: string[];
  blockers: string[];
  warnings: string[];
};

export function normalizeSourceUrl(url: string) {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./i, "");
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_|^fbclid$|^gclid$/i.test(key)) parsed.searchParams.delete(key);
    }
    const normalized = parsed.toString().replace(/\/$/, "");
    return normalized;
  } catch {
    return "";
  }
}

export function canonicalizeProfileUrl(url: string) {
  const normalized = normalizeSourceUrl(url);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    parsed.pathname = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return normalized.toLowerCase();
  }
}

export function extractDomain(url: string) {
  try {
    return new URL(normalizeSourceUrl(url)).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function domainMatches(domain: string, configured: string[]) {
  return configured.some((item) => {
    const normalized = item.trim().replace(/^www\./i, "").toLowerCase();
    return domain === normalized || domain.endsWith(`.${normalized}`);
  });
}

export function isBlockedDomain(url: string, blockedDomains: string[] = []) {
  const domain = extractDomain(url);
  return Boolean(domain) && domainMatches(domain, blockedDomains);
}

export function isAllowedDomain(url: string, allowedDomains: string[] = []) {
  if (allowedDomains.length === 0) return true;
  const domain = extractDomain(url);
  return Boolean(domain) && domainMatches(domain, allowedDomains);
}

export function isPrivateOrLoginGatedSource(
  url: string,
  metadata?: { privateSourceDetected?: boolean | null },
) {
  return (
    Boolean(metadata?.privateSourceDetected) ||
    PRIVATE_SOURCE_PATTERNS.some((pattern) => pattern.test(url))
  );
}

export function classifySourceType(url: string, title?: string | null): PublicWebSourceType {
  const value = `${url} ${title || ""}`.toLowerCase();
  if (/instagram|tiktok|youtube|linkedin|x\.com|twitter|threads/.test(value)) {
    return "PUBLIC_SOCIAL_PROFILE";
  }
  if (/portfolio|personal|website|behance|dribbble|carrd|squarespace|wix/.test(value)) {
    return "PUBLIC_PERSONAL_WEBSITE";
  }
  if (/vendor|directory|artist alley|marketplace/.test(value)) {
    return /etsy|fiverr|upwork|marketplace/.test(value)
      ? "PUBLIC_MARKETPLACE_PROFILE"
      : "PUBLIC_VENDOR_DIRECTORY";
  }
  if (/convention|anime expo|comic con|artist alley/.test(value)) {
    return "PUBLIC_CONVENTION_DIRECTORY";
  }
  if (/event|festival|showcase|lineup/.test(value)) return "PUBLIC_EVENT_PAGE";
  if (/press|article|interview|magazine|news/.test(value)) {
    return "PUBLIC_PRESS_OR_ARTICLE";
  }
  return "UNKNOWN";
}

export function validateCitationSet(input: {
  candidate: Pick<PublicResearchCandidateCard, "sourceUrls" | "sourceTitles" | "privateSourceDetected">;
  allowedDomains?: string[];
  blockedDomains?: string[];
}): CitationValidationResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const normalizedSourceUrls = [
    ...new Set(input.candidate.sourceUrls.map(normalizeSourceUrl).filter(Boolean)),
  ];

  if (normalizedSourceUrls.length === 0) {
    blockers.push("missing_source_urls");
  }
  for (const url of normalizedSourceUrls) {
    if (isPrivateOrLoginGatedSource(url, input.candidate)) {
      blockers.push("private_or_login_gated_source");
    }
    if (isBlockedDomain(url, input.blockedDomains)) {
      blockers.push("blocked_domain");
    }
    if (!isAllowedDomain(url, input.allowedDomains)) {
      warnings.push("outside_allowed_domains");
    }
  }
  if ((input.candidate.sourceTitles || []).length === 0) {
    warnings.push("missing_source_titles");
  }

  return {
    valid: blockers.length === 0,
    normalizedSourceUrls,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
  };
}
