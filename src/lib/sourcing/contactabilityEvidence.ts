import type {
  ContactabilityChannel,
  ContactabilityOutreachRisk,
} from "@prisma/client";
import { extractDomain, isPrivateOrLoginGatedSource } from "@/lib/sourcing/sourceNormalization";
import type { PublicResearchCandidateCard } from "@/lib/sourcing/talentTypes";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/gi;

export type ContactabilityEvidenceInput = {
  channel: ContactabilityChannel;
  value?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  evidenceTextSummary?: string | null;
  isPubliclyVisible?: boolean;
  isBusinessFacing?: boolean;
  isPersonalContact?: boolean;
  doNotContactMatched?: boolean;
  optedOutMatched?: boolean;
};

export type ContactabilityReview = {
  score: number;
  band:
    | "CONTACT_READY_FOR_ADMIN_REVIEW"
    | "CONTACTABLE_WITH_CAUTION"
    | "NEEDS_MORE_CONTACT_RESEARCH"
    | "DO_NOT_CONTACT"
    | "CONTACT_METHOD_BLOCKED";
  outreachRisk: ContactabilityOutreachRisk;
  checklist: {
    hasPublicProfile: boolean;
    hasPortfolioWebsite: boolean;
    hasBusinessEmail: boolean;
    hasContactForm: boolean;
    hasBookingLink: boolean;
    hasSocialProfile: boolean;
    hasAgencyManagerContact: boolean;
    hasPublicBusinessPhone: boolean;
    hasOnlyPersonalContact: boolean;
    hasNoContactPath: boolean;
    contactSourceCited: boolean;
    contactLooksBusinessFacing: boolean;
    contactRequiresHumanReview: boolean;
    contactLikelyViolatesPolicyOrPrivacy: boolean;
    doNotContactMatched: boolean;
    optedOutMatched: boolean;
  };
  blockers: string[];
  warnings: string[];
  recommendedAction:
    | "VERIFY_FOR_ADMIN_REVIEW"
    | "NEEDS_MORE_CONTACT_RESEARCH"
    | "MARK_DO_NOT_CONTACT"
    | "REJECT_CONTACT_METHOD";
  valueRedacted: string | null;
  complianceNotes: string[];
};

function redactContactValue(value?: string | null) {
  if (!value) return null;
  return value
    .replace(EMAIL_PATTERN, (email) => {
      const [name, domain] = email.split("@");
      return `${name.slice(0, 2)}***@${domain}`;
    })
    .replace(PHONE_PATTERN, "[redacted-phone]");
}

function channelFromUrl(url: string): ContactabilityChannel {
  const lower = url.toLowerCase();
  if (/instagram\.com/.test(lower)) return "INSTAGRAM_PROFILE";
  if (/tiktok\.com/.test(lower)) return "TIKTOK_PROFILE";
  if (/youtube\.com|youtu\.be/.test(lower)) return "YOUTUBE_PROFILE";
  if (/linkedin\.com/.test(lower)) return "LINKEDIN_PROFILE";
  if (/booking|book-now|calendly|contact\/?$/i.test(lower)) return "BOOKING_LINK";
  if (/contact|inquiry|enquire|hire|booking/i.test(lower)) {
    return "PUBLIC_CONTACT_FORM";
  }
  return "PUBLIC_WEBSITE";
}

function scoreChannel(channel: ContactabilityChannel) {
  if (channel === "PUBLIC_CONTACT_FORM" || channel === "BOOKING_LINK") return 20;
  if (channel === "AGENCY_OR_MANAGER_CONTACT") return 18;
  if (channel === "PUBLIC_EMAIL") return 15;
  if (channel === "PUBLIC_WEBSITE") return 12;
  if (
    channel === "INSTAGRAM_PROFILE" ||
    channel === "TIKTOK_PROFILE" ||
    channel === "YOUTUBE_PROFILE" ||
    channel === "LINKEDIN_PROFILE" ||
    channel === "OTHER_PUBLIC_PROFILE"
  ) {
    return 9;
  }
  if (channel === "PUBLIC_BUSINESS_PHONE") return 6;
  if (channel === "INTERNAL_CONTACT") return 20;
  return 0;
}

export function evaluateContactabilityEvidence(
  evidence: ContactabilityEvidenceInput,
): ContactabilityReview {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const complianceNotes: string[] = [];
  const sourceUrl = evidence.sourceUrl || "";
  const channel = evidence.channel || "UNKNOWN";
  const isSocial =
    channel === "INSTAGRAM_PROFILE" ||
    channel === "TIKTOK_PROFILE" ||
    channel === "YOUTUBE_PROFILE" ||
    channel === "LINKEDIN_PROFILE" ||
    channel === "OTHER_PUBLIC_PROFILE";
  const isEmail = channel === "PUBLIC_EMAIL";
  const isPhone = channel === "PUBLIC_BUSINESS_PHONE";
  const privateSource = sourceUrl ? isPrivateOrLoginGatedSource(sourceUrl) : false;
  const businessFacing = Boolean(evidence.isBusinessFacing);
  const personal = Boolean(evidence.isPersonalContact);

  if (!sourceUrl && channel !== "INTERNAL_CONTACT") blockers.push("contact_source_url_required");
  if (privateSource) blockers.push("private_or_login_gated_contact_source");
  if (evidence.doNotContactMatched) blockers.push("do_not_contact_override");
  if (evidence.optedOutMatched) blockers.push("opted_out_override");
  if (isSocial) {
    warnings.push("social_profile_is_not_dm_permission");
    complianceNotes.push("Store profile URL only; do not automate DMs.");
  }
  if (isPhone && !businessFacing) {
    warnings.push("public_phone_high_risk_without_business_context");
  }
  if (isEmail && personal) {
    warnings.push("personal_email_high_risk");
  }

  const checklist = {
    hasPublicProfile: isSocial || channel === "PUBLIC_WEBSITE",
    hasPortfolioWebsite: channel === "PUBLIC_WEBSITE",
    hasBusinessEmail: isEmail && businessFacing,
    hasContactForm: channel === "PUBLIC_CONTACT_FORM",
    hasBookingLink: channel === "BOOKING_LINK",
    hasSocialProfile: isSocial,
    hasAgencyManagerContact: channel === "AGENCY_OR_MANAGER_CONTACT",
    hasPublicBusinessPhone: isPhone && businessFacing,
    hasOnlyPersonalContact: personal && !businessFacing,
    hasNoContactPath: channel === "UNKNOWN",
    contactSourceCited: Boolean(sourceUrl) || channel === "INTERNAL_CONTACT",
    contactLooksBusinessFacing: businessFacing,
    contactRequiresHumanReview: true,
    contactLikelyViolatesPolicyOrPrivacy: privateSource,
    doNotContactMatched: Boolean(evidence.doNotContactMatched),
    optedOutMatched: Boolean(evidence.optedOutMatched),
  };

  const publicVisibility = evidence.isPubliclyVisible ? 20 : 0;
  const businessFacingClarity = businessFacing ? 20 : personal ? 2 : 8;
  const sourceReliability = channel === "INTERNAL_CONTACT" ? 20 : sourceUrl ? 14 : 0;
  const channelAppropriateness = scoreChannel(channel);
  const privacyRisk = blockers.length > 0 ? 0 : isPhone || personal ? 5 : isSocial ? 10 : 18;
  const score =
    publicVisibility +
    businessFacingClarity +
    sourceReliability +
    channelAppropriateness +
    privacyRisk;
  const outreachRisk: ContactabilityOutreachRisk =
    blockers.length > 0
      ? "BLOCKED"
      : isPhone || personal
        ? "HIGH"
        : score >= 80
          ? "LOW"
          : score >= 55
            ? "MEDIUM"
            : "HIGH";
  const band =
    blockers.includes("do_not_contact_override") || blockers.includes("opted_out_override")
      ? "DO_NOT_CONTACT"
      : blockers.length > 0
        ? "CONTACT_METHOD_BLOCKED"
        : score >= 80
          ? "CONTACT_READY_FOR_ADMIN_REVIEW"
          : score >= 55
            ? "CONTACTABLE_WITH_CAUTION"
            : "NEEDS_MORE_CONTACT_RESEARCH";

  return {
    score,
    band,
    outreachRisk,
    checklist,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    recommendedAction:
      band === "CONTACT_READY_FOR_ADMIN_REVIEW" || band === "CONTACTABLE_WITH_CAUTION"
        ? "VERIFY_FOR_ADMIN_REVIEW"
        : band === "DO_NOT_CONTACT"
          ? "MARK_DO_NOT_CONTACT"
          : band === "CONTACT_METHOD_BLOCKED"
            ? "REJECT_CONTACT_METHOD"
            : "NEEDS_MORE_CONTACT_RESEARCH",
    valueRedacted: redactContactValue(evidence.value),
    complianceNotes,
  };
}

export function extractContactabilityEvidenceFromCandidate(
  candidate: PublicResearchCandidateCard,
): ContactabilityEvidenceInput[] {
  const evidence: ContactabilityEvidenceInput[] = [];
  for (const url of [...candidate.publicProfileUrls, ...candidate.sourceUrls]) {
    const channel = channelFromUrl(url);
    evidence.push({
      channel,
      value: url,
      sourceUrl: url,
      sourceTitle: extractDomain(url),
      evidenceTextSummary: "Public profile or website found during research.",
      isPubliclyVisible: true,
      isBusinessFacing:
        channel === "PUBLIC_CONTACT_FORM" ||
        channel === "BOOKING_LINK" ||
        channel === "PUBLIC_WEBSITE",
      isPersonalContact: false,
    });
  }
  if (evidence.length === 0) {
    evidence.push({
      channel: "UNKNOWN",
      evidenceTextSummary: "No public contact path found.",
      isPubliclyVisible: false,
      isBusinessFacing: false,
      isPersonalContact: false,
    });
  }
  return evidence;
}

export function canMarkContactableForAdminReview(input: {
  qualityReviewPassed: boolean;
  contactabilityReview: ContactabilityReview;
  adminReviewed: boolean;
  optedOut?: boolean;
  doNotContact?: boolean;
}) {
  const blockers = [
    !input.qualityReviewPassed ? "quality_review_not_passed" : null,
    !input.adminReviewed ? "admin_review_required" : null,
    input.contactabilityReview.outreachRisk === "BLOCKED" ? "contact_method_blocked" : null,
    input.optedOut ? "opted_out" : null,
    input.doNotContact ? "do_not_contact" : null,
    input.contactabilityReview.band === "NEEDS_MORE_CONTACT_RESEARCH"
      ? "needs_more_contact_research"
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    allowed: blockers.length === 0,
    blockers,
    noSendAuthorized: true,
  };
}
