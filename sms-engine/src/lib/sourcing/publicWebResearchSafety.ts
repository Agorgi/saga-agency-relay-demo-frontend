import {
  publicResearchCandidateCardSchema,
  type PublicResearchCandidateCard,
} from "@/lib/sourcing/talentTypes";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN =
  /(?:whatsapp:)?(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/gi;

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

const UNSUPPORTED_AVAILABILITY_PATTERNS =
  /\b(available|willing|confirmed|booked|ready to work|can do it|will do it)\b/i;
const UNSUPPORTED_RATE_PATTERNS =
  /\b(rate is|rates are|charges|costs|will charge|payment confirmed|fee is)\b/i;
const SENSITIVE_PERSON_PATTERNS = /\b(minor|underage|child|student at high school)\b/i;

export type PublicWebResearchSafetyResult = {
  safe: boolean;
  blockers: string[];
  warnings: string[];
  requiredActions: string[];
  sanitizedCard: PublicResearchCandidateCard | null;
};

function redactContactText(value: string) {
  return value
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(PHONE_PATTERN, "[redacted-phone]");
}

function sanitizeStringArray(items: string[]) {
  return items.map(redactContactText).filter(Boolean);
}

function hasContactInfo(value: unknown) {
  const serialized = JSON.stringify(value || "");
  const hasEmail = EMAIL_PATTERN.test(serialized);
  EMAIL_PATTERN.lastIndex = 0;
  const hasPhone = PHONE_PATTERN.test(serialized);
  PHONE_PATTERN.lastIndex = 0;
  return hasEmail || hasPhone;
}

function domainFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function domainMatches(domain: string, configured: string[]) {
  return configured.some(
    (item) => domain === item || domain.endsWith(`.${item}`),
  );
}

function privateSourceDetected(urls: string[]) {
  return urls.some((url) => PRIVATE_SOURCE_PATTERNS.some((pattern) => pattern.test(url)));
}

function containsUnsupportedClaim(items: string[], pattern: RegExp) {
  return items.some((item) => pattern.test(item));
}

export function sanitizePublicResearchCandidateCard(
  candidate: PublicResearchCandidateCard,
): PublicResearchCandidateCard {
  return {
    ...candidate,
    publicProfileUrls: candidate.publicProfileUrls.filter((url) => !hasContactInfo(url)),
    sourceUrls: candidate.sourceUrls.filter((url) => !hasContactInfo(url)),
    sourceTitles: sanitizeStringArray(candidate.sourceTitles || []),
    roleFitEvidence: sanitizeStringArray(candidate.roleFitEvidence),
    fandomFitEvidence: sanitizeStringArray(candidate.fandomFitEvidence),
    locationEvidence: sanitizeStringArray(candidate.locationEvidence),
    portfolioEvidence: sanitizeStringArray(candidate.portfolioEvidence),
    recentActivityEvidence: sanitizeStringArray(candidate.recentActivityEvidence || []),
    whyTheyMayFit: sanitizeStringArray(candidate.whyTheyMayFit),
    missingEvidence: sanitizeStringArray(candidate.missingEvidence),
    riskFlags: sanitizeStringArray(candidate.riskFlags),
    displayName: redactContactText(candidate.displayName),
    likelyRole: redactContactText(candidate.likelyRole),
    city: candidate.city ? redactContactText(candidate.city) : null,
    region: candidate.region ? redactContactText(candidate.region) : null,
  };
}

export function evaluatePublicWebResearchSafety(input: {
  candidate: unknown;
  citationsRequired?: boolean;
  blockedDomains?: string[];
}): PublicWebResearchSafetyResult {
  const parsed = publicResearchCandidateCardSchema.safeParse(input.candidate);
  if (!parsed.success) {
    return {
      safe: false,
      blockers: ["candidate_schema_invalid"],
      warnings: [],
      requiredActions: ["Regenerate or manually rebuild the candidate card with citations."],
      sanitizedCard: null,
    };
  }

  const sanitizedCard = sanitizePublicResearchCandidateCard(parsed.data);
  const sourceUrls = sanitizedCard.sourceUrls;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const requiredActions: string[] = [];
  const blockedDomains = input.blockedDomains || [];
  const allUrls = [...sourceUrls, ...sanitizedCard.publicProfileUrls];
  const textEvidence = [
    ...sanitizedCard.roleFitEvidence,
    ...sanitizedCard.fandomFitEvidence,
    ...sanitizedCard.locationEvidence,
    ...sanitizedCard.portfolioEvidence,
    ...sanitizedCard.recentActivityEvidence,
    ...sanitizedCard.whyTheyMayFit,
    ...sanitizedCard.riskFlags,
  ];

  if ((input.citationsRequired ?? true) && sourceUrls.length === 0) {
    blockers.push("citations_required");
    requiredActions.push("Add at least one public source URL before review.");
  }
  if (privateSourceDetected(allUrls) || sanitizedCard.privateSourceDetected) {
    blockers.push("private_or_login_gated_source_detected");
    requiredActions.push("Discard private/login-gated evidence and use public sources only.");
  }
  if (
    blockedDomains.length > 0 &&
    sourceUrls.some((url) => domainMatches(domainFromUrl(url), blockedDomains))
  ) {
    blockers.push("blocked_domain_detected");
    requiredActions.push("Remove blocked-domain evidence or discard the result.");
  }
  if (hasContactInfo(parsed.data)) {
    warnings.push("raw_contact_info_redacted");
    requiredActions.push("Confirm no raw phone or email is shown in organizer-facing fields.");
  }
  if (containsUnsupportedClaim(textEvidence, UNSUPPORTED_AVAILABILITY_PATTERNS)) {
    blockers.push("unsupported_availability_or_willingness_claim");
    requiredActions.push("Replace availability/willingness claims with unknown unless directly sourced.");
  }
  if (containsUnsupportedClaim(textEvidence, UNSUPPORTED_RATE_PATTERNS)) {
    blockers.push("unsupported_rate_or_payment_claim");
    requiredActions.push("Remove unsupported rates/payment claims.");
  }
  if (
    containsUnsupportedClaim(textEvidence, SENSITIVE_PERSON_PATTERNS) ||
    sanitizedCard.sensitiveDataDetected
  ) {
    blockers.push("sensitive_or_minor_risk_detected");
    requiredActions.push("Escalate to admin review and do not promote the candidate.");
  }
  if (sanitizedCard.roleFitEvidence.length === 0) {
    blockers.push("missing_role_fit_evidence");
    requiredActions.push("Add source-backed role-fit evidence.");
  }
  if (!sanitizedCard.requiresHumanReview) {
    blockers.push("human_review_required");
    requiredActions.push("Mark the result as human-review required.");
  }
  if (sanitizedCard.availabilityKnown) {
    warnings.push("availability_claim_requires_manual_source_review");
  }
  if (sanitizedCard.willingnessKnown) {
    warnings.push("willingness_claim_requires_manual_source_review");
  }
  if (sanitizedCard.ratesKnown) {
    warnings.push("rates_claim_requires_manual_source_review");
  }

  return {
    safe: blockers.length === 0,
    blockers,
    warnings,
    requiredActions,
    sanitizedCard,
  };
}

export function publicWebResearchRiskLevel(input: {
  blockers: string[];
  warnings: string[];
}) {
  if (input.blockers.length > 0) return "red";
  if (input.warnings.length > 0) return "yellow";
  return "green";
}
