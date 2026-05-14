import { assessMessageSafety, escalationHoldingReply } from "@/sms-engine/safety";
import {
  replyPlanSchema,
  type ConversationContext,
  type GigSeekerKnownFields,
  type GigSeekerOnboardingStage,
  type ReplyPlan,
} from "@/sms-engine/conversation/conversationTypes";

const LOCATION_QUESTION = "Amazing - what city are you based in?";
const GIG_TYPES_QUESTION =
  "What kinds of gigs are you looking for? For example: photography, cosplay appearances, hosting, DJing, design, vendor work, or something else.";
const LINKS_QUESTION =
  "Do you have an Instagram, portfolio, website, TikTok, LinkedIn, or anything else that shows your work?";
const FANDOMS_QUESTION =
  "Which fandoms, scenes, or communities do you know best?";
const PROFILE_READY_REPLY =
  "Amazing. I can turn this into a Saga creator profile so the team can review it for relevant opportunities. We'll be careful not to promise bookings, but this helps us understand where you may be a fit.";

const allowedActions = [
  "persist_inbound_message",
  "draft_creator_profile_review_plan",
  "audit_reply_plan",
];

const blockedActions = [
  "promise_paid_work",
  "promise_booking",
  "promise_gigs",
  "promise_revenue",
  "promise_placement",
  "create_live_creator_profile_without_review",
  "send_external_outreach_without_admin_approval",
];

const roleSignals: Array<[string, RegExp]> = [
  ["photographer", /\b(photo|photographer|photography|content capture)\b/i],
  ["videographer", /\b(video|videographer|videography|reels|filming)\b/i],
  ["cosplayer", /\b(cosplayer|cosplay(?:\s+(?:appearance|gig|gigs|work))?|guest cosplayer|costume)\b/i],
  ["DJ", /\b(dj|deejay|music set)\b/i],
  ["illustrator", /\b(illustrator|illustration|artist|draw|drawing)\b/i],
  ["graphic designer", /\b(graphic designer|designer|design|flyer|branding)\b/i],
  ["host", /\b(host|hosting|mc|emcee)\b/i],
  ["vendor", /\b(vendor|table|booth|merch)\b/i],
  ["volunteer", /\b(volunteer|volunteering)\b/i],
  ["venue owner", /\b(venue owner|own a venue|space owner|venue partner)\b/i],
  ["production assistant", /\b(production assistant|pa|runner|production)\b/i],
  ["maid cafe performer", /\b(maid cafe|performer)\b/i],
];

const skillSignals: Array<[string, RegExp]> = [
  ["photography", /\b(photography|photo|camera|content capture)\b/i],
  ["videography", /\b(videography|video|filming|editing|reels)\b/i],
  ["lighting", /\blighting\b/i],
  ["cosplay", /\b(cosplay|costume|sewing|makeup|wig)\b/i],
  ["DJing", /\b(djing|dj|mixing|music)\b/i],
  ["illustration", /\b(illustration|illustrator|drawing|artist)\b/i],
  ["design", /\b(design|designer|branding|flyer|graphics)\b/i],
  ["hosting", /\b(hosting|host|mc|emcee)\b/i],
  ["vendor coordination", /\b(vendor coordination|vendors?|booths?)\b/i],
  ["production", /\b(production|runner|stage|operations|ops)\b/i],
  ["venue operations", /\b(venue|space|floor plan)\b/i],
];

const fandomSignals: Array<[string, RegExp]> = [
  ["anime", /\banime\b/i],
  ["cosplay", /\bcosplay\b/i],
  ["gaming", /\b(gaming|games|video games|esports)\b/i],
  ["K-pop", /\b(k-pop|kpop)\b/i],
  ["horror", /\bhorror\b/i],
  ["fantasy", /\bfantasy\b/i],
  ["comics", /\b(comics|comic con|marvel|dc)\b/i],
  ["manga", /\bmanga\b/i],
  ["maid cafe", /\bmaid cafe\b/i],
];

const citySignals: Array<[string, RegExp]> = [
  ["New York City", /\b(new york city|nyc|brooklyn|queens|manhattan|bronx)\b/i],
  ["Los Angeles", /\b(los angeles|la|l\.a\.|silver lake|dtla)\b/i],
  ["Atlanta", /\batlanta\b/i],
  ["Chicago", /\bchicago\b/i],
  ["Seattle", /\bseattle\b/i],
  ["Austin", /\baustin\b/i],
  ["San Francisco", /\b(san francisco|sf|bay area|oakland)\b/i],
  ["Portland", /\bportland\b/i],
  ["Miami", /\bmiami\b/i],
  ["Philadelphia", /\bphiladelphia|philly\b/i],
  ["Boston", /\bboston\b/i],
  ["Dallas", /\bdallas\b/i],
  ["Denver", /\bdenver\b/i],
];

const linkPattern =
  /https?:\/\/\S+|@\w[\w.]+|\b(?:instagram|insta|portfolio|website|tiktok|tik tok|linkedin|linktree|behance)\b/gi;
const paidOnlyPattern = /\b(paid only|paid gigs only|only paid)\b/i;
const paidPattern = /\b(paid|paying|paid gigs)\b/i;
const collabPattern = /\b(collab|collaboration|volunteer|trade)\b/i;
const selfDescriptionPattern =
  /\b(experience|experienced|worked|portfolio|specialize|shoot|perform|design|host|coordinate|run|manage|available)\b/i;
const hardMoneyOrCommitmentSignals =
  /\b(guarantee|guaranteed|how much money|how much will i make|contract|agreement|legal|deposit|invoice|refund|revenue|payment terms|promise|placement|bookings? guaranteed|guaranteed paid work)\b/i;
const gigSeekerHighRiskSignals =
  /\b(permits?|insurance|alcohol|security|medical|minors?|underage|weapons?|explicit|adult content|harass|harassment|discriminate|discrimination|illegal|unsafe)\b/i;

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function unique(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function mergeArray(a?: string[] | null, b?: string[] | null) {
  return unique([...(a || []), ...(b || [])]);
}

function truncate(value: string, max = 180) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > max
    ? `${normalized.slice(0, max - 1)}...`
    : normalized;
}

function signalNames(body: string, signals: Array<[string, RegExp]>) {
  return signals
    .filter(([, pattern]) => pattern.test(body))
    .map(([name]) => name);
}

function inferCity(body: string) {
  for (const [city, pattern] of citySignals) {
    if (pattern.test(body)) return city;
  }

  const explicitLocation = body.match(
    /\b(?:in|near|around|based in|city is|i'm in|i am in)\s+([a-z][a-z .'-]+?)(?:[.!?,]|$|\s+(?:for|with|and|looking|seeking)\b)/i,
  );
  return explicitLocation?.[1] ? truncate(explicitLocation[1], 50) : null;
}

function inferLinks(body: string) {
  return unique(body.match(linkPattern) || []);
}

function inferCompensationPreference(
  body: string,
): GigSeekerKnownFields["compensationPreference"] {
  if (paidOnlyPattern.test(body)) return "paid_only";
  if (paidPattern.test(body) && collabPattern.test(body)) return "paid_or_collab";
  if (paidPattern.test(body)) return "paid_only";
  if (collabPattern.test(body)) return "volunteer_collab";
  return undefined;
}

function inferSelfDescription(body: string, roles: string[], skills: string[]) {
  if (
    body.trim().length >= 60 &&
    (roles.length > 0 || skills.length > 0 || selfDescriptionPattern.test(body))
  ) {
    return truncate(body);
  }
  return null;
}

function hasEnoughSelfDescription(fields: GigSeekerKnownFields) {
  return Boolean(clean(fields.selfDescription));
}

function hasLinks(fields: GigSeekerKnownFields) {
  return (
    (fields.portfolioUrls || []).length > 0 || (fields.socialUrls || []).length > 0
  );
}

function mergeGigSeekerFields({
  existing,
  inferred,
}: {
  existing: GigSeekerKnownFields;
  inferred: GigSeekerKnownFields;
}): GigSeekerKnownFields {
  return {
    city: clean(inferred.city) || clean(existing.city),
    desiredRoles: mergeArray(existing.desiredRoles, inferred.desiredRoles),
    skills: mergeArray(existing.skills, inferred.skills),
    fandoms: mergeArray(existing.fandoms, inferred.fandoms),
    communities: mergeArray(existing.communities, inferred.communities),
    portfolioUrls: mergeArray(existing.portfolioUrls, inferred.portfolioUrls),
    socialUrls: mergeArray(existing.socialUrls, inferred.socialUrls),
    availabilityNotes:
      clean(inferred.availabilityNotes) || clean(existing.availabilityNotes),
    rateNotes: clean(inferred.rateNotes) || clean(existing.rateNotes),
    compensationPreference:
      inferred.compensationPreference ||
      existing.compensationPreference ||
      "unknown",
    preferredOpportunityTypes: mergeArray(
      existing.preferredOpportunityTypes,
      inferred.preferredOpportunityTypes,
    ),
    selfDescription:
      clean(inferred.selfDescription) || clean(existing.selfDescription),
    safetyFlags: mergeArray(existing.safetyFlags, inferred.safetyFlags),
  };
}

export function inferGigSeekerFieldsFromMessage(
  body: string,
): GigSeekerKnownFields {
  const desiredRoles = signalNames(body, roleSignals);
  const skills = signalNames(body, skillSignals);
  const fandoms = signalNames(body, fandomSignals);
  const links = inferLinks(body);
  const compensationPreference = inferCompensationPreference(body);
  const preferredOpportunityTypes =
    compensationPreference === "paid_only"
      ? ["paid"]
      : compensationPreference === "volunteer_collab"
        ? ["volunteer", "collab"]
        : compensationPreference === "paid_or_collab"
          ? ["paid", "collab"]
          : [];

  return {
    city: inferCity(body),
    desiredRoles,
    skills,
    fandoms,
    communities: fandoms,
    portfolioUrls: links.filter((link) => link.startsWith("http")),
    socialUrls: links,
    availabilityNotes: /\b(available|availability|weekends|weekdays|nights)\b/i.test(
      body,
    )
      ? truncate(body, 120)
      : null,
    compensationPreference,
    preferredOpportunityTypes,
    selfDescription: inferSelfDescription(body, desiredRoles, skills),
    safetyFlags: [],
  };
}

export function missingGigSeekerRequiredFields(fields: GigSeekerKnownFields) {
  const missing: string[] = [];
  if (!clean(fields.city)) missing.push("city");
  if ((fields.desiredRoles || []).length === 0) missing.push("desiredRoles");
  if (!hasLinks(fields) && !hasEnoughSelfDescription(fields)) {
    missing.push("portfolioOrSelfDescription");
  }
  return missing;
}

export function missingGigSeekerOptionalFields(fields: GigSeekerKnownFields) {
  const missing: string[] = [];
  if ((fields.skills || []).length === 0) missing.push("skills");
  if ((fields.fandoms || []).length === 0) missing.push("fandoms");
  if (!clean(fields.availabilityNotes)) missing.push("availabilityNotes");
  if (
    !fields.compensationPreference ||
    fields.compensationPreference === "unknown"
  ) {
    missing.push("compensationPreference");
  }
  return missing;
}

function assessGigSeekerSafety(body: string) {
  const safety = assessMessageSafety(body);
  if (gigSeekerHighRiskSignals.test(body)) {
    return {
      needsAdmin: true,
      flags: unique([...safety.flags, "safety_or_legal"]),
    };
  }
  if (hardMoneyOrCommitmentSignals.test(body)) {
    return {
      needsAdmin: true,
      flags: unique([...safety.flags, "money_or_contract"]),
    };
  }

  const selfDirectedPaidPreference =
    safety.needsAdmin &&
    safety.flags.every((flag) => flag === "money_or_contract") &&
    /\b(paid|book me|hire me|get booked|gigs?)\b/i.test(body) &&
    !hardMoneyOrCommitmentSignals.test(body);

  return selfDirectedPaidPreference ? { needsAdmin: false, flags: [] } : safety;
}

function determineNextStage(
  fields: GigSeekerKnownFields,
): {
  nextStage: GigSeekerOnboardingStage;
  nextQuestion?: string;
  enoughInfoForProfileReview: boolean;
  explanation: string;
} {
  const missingRequiredFields = missingGigSeekerRequiredFields(fields);
  const missingOptionalFields = missingGigSeekerOptionalFields(fields);

  if (!clean(fields.city)) {
    return {
      nextStage: "ASK_LOCATION",
      nextQuestion: LOCATION_QUESTION,
      enoughInfoForProfileReview: false,
      explanation: "Creator city/location is missing.",
    };
  }

  if ((fields.desiredRoles || []).length === 0) {
    return {
      nextStage: "ASK_GIG_TYPES",
      nextQuestion: GIG_TYPES_QUESTION,
      enoughInfoForProfileReview: false,
      explanation: "Desired gig types or roles are missing.",
    };
  }

  if (!hasLinks(fields) && !hasEnoughSelfDescription(fields)) {
    return {
      nextStage: "ASK_LINKS",
      nextQuestion: LINKS_QUESTION,
      enoughInfoForProfileReview: false,
      explanation: "Portfolio/social link or enough self-description is missing.",
    };
  }

  if ((fields.fandoms || []).length === 0) {
    return {
      nextStage: "ASK_FANDOMS",
      nextQuestion: FANDOMS_QUESTION,
      enoughInfoForProfileReview: false,
      explanation:
        "Required fields are present, but fandom/community context is still useful before review.",
    };
  }

  return {
    nextStage: "PROFILE_READY_FOR_REVIEW",
    nextQuestion: PROFILE_READY_REPLY,
    enoughInfoForProfileReview: missingRequiredFields.length === 0,
    explanation: `Required creator onboarding fields are present. Missing optional fields: ${
      missingOptionalFields.join(", ") || "none"
    }.`,
  };
}

export function evaluateGigSeekerOnboardingPolicy({
  context,
  latestMessage,
}: {
  context: ConversationContext;
  latestMessage: string;
}) {
  const safety = assessGigSeekerSafety(latestMessage);
  const inferredFields = inferGigSeekerFieldsFromMessage(latestMessage);
  const knownFields = mergeGigSeekerFields({
    existing: context.gigSeekerKnownFields || {},
    inferred: {
      ...inferredFields,
      safetyFlags: safety.flags,
    },
  });
  const missingRequiredFields = missingGigSeekerRequiredFields(knownFields);
  const missingOptionalFields = missingGigSeekerOptionalFields(knownFields);

  if (safety.needsAdmin) {
    const replyPlan = replyPlanSchema.parse({
      flow: "GIG_SEEKER_ONBOARDING",
      stage: context.currentStage,
      nextStage: "NEEDS_ADMIN",
      enoughInfoForBrief: false,
      enoughInfoForProfileReview: false,
      shouldEscalate: true,
      escalationReason: safety.flags.join(", "),
      nextQuestion: escalationHoldingReply(),
      replyTone: "professional_friendly_casual",
      allowedActions: ["persist_inbound_message", "audit_escalation"],
      blockedActions,
      explanationForAudit:
        "Deterministic gig-seeker onboarding policy escalated due to safety flags.",
      confidence: 0.98,
    });

    return {
      replyPlan,
      knownFields,
      missingRequiredFields,
      missingOptionalFields,
      inferredFields,
      safetyFlags: safety.flags,
    };
  }

  const stageDecision = determineNextStage(knownFields);
  const replyPlan: ReplyPlan = replyPlanSchema.parse({
    flow: "GIG_SEEKER_ONBOARDING",
    stage: context.currentStage,
    nextStage: stageDecision.nextStage,
    enoughInfoForBrief: false,
    enoughInfoForProfileReview: stageDecision.enoughInfoForProfileReview,
    shouldEscalate: false,
    nextQuestion: stageDecision.nextQuestion,
    replyTone: "professional_friendly_casual",
    allowedActions,
    blockedActions,
    explanationForAudit: [
      stageDecision.explanation,
      `Missing required fields: ${missingRequiredFields.join(", ") || "none"}.`,
      `Missing optional fields: ${missingOptionalFields.join(", ") || "none"}.`,
    ].join(" "),
    confidence:
      stageDecision.nextStage === "PROFILE_READY_FOR_REVIEW"
        ? 0.86
        : missingRequiredFields.length <= 1
          ? 0.78
          : 0.72,
  });

  return {
    replyPlan,
    knownFields,
    missingRequiredFields,
    missingOptionalFields,
    inferredFields,
    safetyFlags: safety.flags,
  };
}

export function planGigSeekerOnboardingReply({
  context,
  latestMessage,
}: {
  context: ConversationContext;
  latestMessage: string;
}): ReplyPlan {
  return evaluateGigSeekerOnboardingPolicy({ context, latestMessage }).replyPlan;
}
