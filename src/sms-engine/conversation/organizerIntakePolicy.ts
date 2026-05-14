import { assessMessageSafety, escalationHoldingReply } from "@/sms-engine/safety";
import { finalIntakeReply } from "@/sms-engine/workflow";
import {
  missingOrganizerOptionalFields,
  missingOrganizerRequiredFields,
} from "@/sms-engine/conversation/conversationContext";
import {
  replyPlanSchema,
  type ConversationContext,
  type OrganizerIntakeStage,
  type OrganizerKnownFields,
  type ReplyPlan,
} from "@/sms-engine/conversation/conversationTypes";

const FIRST_TIME_HOST_QUESTION =
  "Love this. I can help turn it into an actual production plan. First - have you hosted something like this before, or would this be your first one?";
const LOCATION_QUESTION =
  "Great. What city or general location are you thinking for this?";
const CONCEPT_QUESTION =
  "Nice. Give me the core concept in a sentence or two - what are we making happen?";
const SCOPE_VIBE_QUESTION =
  "What's the vibe and scale you're imagining: intimate, wild, polished, experimental, community-led, something else?";

const optionalSafeActions = [
  "persist_inbound_message",
  "extract_brief_fields",
  "draft_next_question",
  "audit_reply_plan",
];

const blockedAutonomyActions = [
  "promise_booking",
  "promise_payment",
  "promise_revenue",
  "promise_attendance",
  "promise_venue_access",
  "promise_confirmed_team",
  "promise_celebrity_or_influencer_participation",
  "send_external_outreach_without_admin_approval",
];

const citySignals: Array<[string, RegExp]> = [
  ["New York City", /\b(new york city|nyc|brooklyn|queens|manhattan|bronx)\b/i],
  ["Los Angeles", /\b(los angeles|la|l\.a\.|east side|silver lake|dtla)\b/i],
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
];

const conceptSignals =
  /\b(event|party|pop-?up|meetup|rave|show|screening|workshop|festival|launch|photoshoot|activation|community night|creator day|picnic|karaoke|lounge|craft night|swap meet|market|gallery|performance|concert)\b/i;
const organizerActionSignals =
  /\b(i want to|we want to|trying to|planning to|thinking about|idea for|put together|throw|host|make|produce|do|create)\b/i;
const vibeSignals =
  /\b(intimate|wild|polished|experimental|community-led|community led|cozy|casual|premium|cute|stylish|playful|high-energy|high energy|low-key|low key|immersive|fandom-aligned|fandom aligned|small|large|big)\b/i;
const audienceSignals =
  /\b(\d+\s*(to|-)?\s*\d*\s*(people|attendees|guests|fans|creators|vendors)|audience|capacity|turnout)\b/i;
const timingSignals =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|fall|winter|weekend|weekday|next month|next year|tonight|tomorrow|date|timing|late|early)\b/i;
const budgetSignals =
  /\b(budget|unknown budget|\$\s?\d+|\d+\s?k\b|\d+\s?-\s?\d+\s?k\b|under\s+\d+|around\s+\d+)\b/i;
const hardMoneyOrCommitmentSignals =
  /\b(contract|agreement|legal|deposit|invoice|refund|fee|rate|quote|pricing|commission|revenue|payment|pay\b|paid\b|payment dispute|chargeback|guarantee|guaranteed|booking|booked|hire|hired|should i sign|terms)\b/i;
const helpSignals =
  /\b(need|looking for|help with|team|roles?|dj|photographer|videographer|venue|host|cosplayer|illustrator|designer|volunteer|vendor|sponsor|producer|production assistant)\b/i;
const firstTimePositiveSignals =
  /\b(first time|never hosted|haven't hosted|have not hosted|new to hosting|first one|first event|my first)\b/i;
const firstTimeNegativeSignals =
  /\b(hosted before|produced before|done this before|have hosted|i've hosted|i have hosted|several events|many events|experienced|not my first)\b/i;
const uncertaintySignals = /\b(idk|i don't know|not sure|unsure|no idea)\b/i;

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function truncate(value: string, max = 180) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}...` : trimmed;
}

function hasAskedFirstTimeHostQuestion(context: ConversationContext) {
  return context.priorMessages.some(
    (message) =>
      message.direction === "OUTBOUND" &&
      /hosted something like this before|would this be your first/i.test(
        message.body || "",
      ),
  );
}

function inferCity(body: string) {
  for (const [city, pattern] of citySignals) {
    if (pattern.test(body)) return city;
  }

  const explicitLocation = body.match(
    /\b(?:in|near|around|location is|city is)\s+([a-z][a-z .'-]+?)(?:[.!?,]|$|\s+(?:for|with|on|at|around|and)\b)/i,
  );
  if (explicitLocation?.[1]) {
    return truncate(explicitLocation[1], 50);
  }

  return null;
}

function inferFirstTimeHost(body: string) {
  if (firstTimePositiveSignals.test(body)) return true;
  if (firstTimeNegativeSignals.test(body)) return false;
  return null;
}

function inferProjectConcept(body: string) {
  if (conceptSignals.test(body) || organizerActionSignals.test(body)) {
    return truncate(body);
  }
  return null;
}

function inferScopeOrVibe(body: string) {
  if (vibeSignals.test(body) || audienceSignals.test(body)) {
    return truncate(body);
  }

  if (
    body.trim().length >= 70 &&
    conceptSignals.test(body) &&
    /\b(with|for|featuring|including|plus)\b/i.test(body)
  ) {
    return "Enough descriptive detail to infer initial scope/vibe.";
  }

  return null;
}

function inferTargetDate(body: string) {
  return timingSignals.test(body) ? truncate(body, 90) : null;
}

function inferBudget(body: string) {
  return budgetSignals.test(body) ? truncate(body, 90) : null;
}

function inferAudience(body: string) {
  return audienceSignals.test(body) ? truncate(body, 90) : null;
}

function inferHelpNeeded(body: string) {
  return helpSignals.test(body) ? truncate(body, 140) : null;
}

function assessOrganizerIntakeSafety(body: string) {
  const safety = assessMessageSafety(body);
  const budgetOnly =
    safety.needsAdmin &&
    safety.flags.every((flag) => flag === "money_or_contract") &&
    budgetSignals.test(body) &&
    !hardMoneyOrCommitmentSignals.test(body);

  return budgetOnly ? { needsAdmin: false, flags: [] } : safety;
}

function mergeKnownFields({
  existing,
  inferred,
}: {
  existing: OrganizerKnownFields;
  inferred: OrganizerKnownFields;
}): OrganizerKnownFields {
  const merged: OrganizerKnownFields = {
    ...existing,
    ...Object.fromEntries(
      Object.entries(inferred).filter(
        ([, value]) => value !== null && value !== undefined && value !== "",
      ),
    ),
  };

  merged.projectConcept =
    clean(merged.projectConcept) ||
    clean(merged.description) ||
    clean(merged.title) ||
    clean(merged.projectType);

  return merged;
}

export function inferOrganizerFieldsFromMessage(
  body: string,
): OrganizerKnownFields {
  if (!body.trim() || uncertaintySignals.test(body)) {
    return {};
  }

  const projectConcept = inferProjectConcept(body);
  const scopeOrVibe = inferScopeOrVibe(body);

  return {
    firstTimeHost: inferFirstTimeHost(body),
    city: inferCity(body),
    projectConcept,
    description: projectConcept,
    scope: scopeOrVibe,
    vibe: scopeOrVibe && vibeSignals.test(body) ? scopeOrVibe : null,
    targetDate: inferTargetDate(body),
    budgetRange: inferBudget(body),
    expectedAudienceSize: inferAudience(body),
    helpNeeded: inferHelpNeeded(body),
  };
}

function determineNextStage({
  knownFields,
  context,
}: {
  knownFields: OrganizerKnownFields;
  context: ConversationContext;
}): {
  nextStage: OrganizerIntakeStage;
  nextQuestion?: string;
  enoughInfoForBrief: boolean;
  explanation: string;
} {
  const hasCompletedFirstTimeHost =
    context.hasCompletedFirstTimeHostQuestion ||
    (knownFields.firstTimeHost !== null &&
      knownFields.firstTimeHost !== undefined);
  const hasAskedFirstTimeHost = hasAskedFirstTimeHostQuestion(context);
  const firstTimeGateSatisfied =
    hasCompletedFirstTimeHost || hasAskedFirstTimeHost;
  const missingRequiredFields = missingOrganizerRequiredFields(knownFields);
  const requiredBriefFieldsPresent = missingRequiredFields.length === 0;
  const enoughInfoForBrief = requiredBriefFieldsPresent && firstTimeGateSatisfied;
  const hasAnyOrganizerShape =
    Boolean(clean(knownFields.projectConcept)) || Boolean(clean(knownFields.city));

  if (
    !hasCompletedFirstTimeHost &&
    !hasAskedFirstTimeHost &&
    hasAnyOrganizerShape
  ) {
    return {
      nextStage: "ASK_FIRST_TIME_HOST",
      nextQuestion: FIRST_TIME_HOST_QUESTION,
      enoughInfoForBrief: false,
      explanation: "First-time host question has not been completed or asked.",
    };
  }

  if (!clean(knownFields.city)) {
    return {
      nextStage: "ASK_LOCATION",
      nextQuestion: LOCATION_QUESTION,
      enoughInfoForBrief: false,
      explanation: "City/location is still missing.",
    };
  }

  if (!clean(knownFields.projectConcept)) {
    return {
      nextStage: "ASK_PROJECT_CONCEPT",
      nextQuestion: CONCEPT_QUESTION,
      enoughInfoForBrief: false,
      explanation: "Project/event concept is still missing.",
    };
  }

  if (!clean(knownFields.scope) && !clean(knownFields.vibe)) {
    return {
      nextStage: "ASK_SCOPE_VIBE",
      nextQuestion: SCOPE_VIBE_QUESTION,
      enoughInfoForBrief: false,
      explanation: "Scope/vibe is still missing.",
    };
  }

  return {
    nextStage: "BRIEF_READY",
    nextQuestion: finalIntakeReply(),
    enoughInfoForBrief,
    explanation: "Required organizer intake fields are present.",
  };
}

export function planOrganizerIntakeReply({
  context,
  latestMessage,
}: {
  context: ConversationContext;
  latestMessage: string;
}): ReplyPlan {
  return evaluateOrganizerIntakePolicy({ context, latestMessage }).replyPlan;
}

export function evaluateOrganizerIntakePolicy({
  context,
  latestMessage,
}: {
  context: ConversationContext;
  latestMessage: string;
}) {
  const safety = assessOrganizerIntakeSafety(latestMessage);
  const inferredFields = inferOrganizerFieldsFromMessage(latestMessage);
  const knownFields = mergeKnownFields({
    existing: context.knownFields || {},
    inferred: inferredFields,
  });
  const missingRequiredFields = missingOrganizerRequiredFields(knownFields);
  const missingOptionalFields = missingOrganizerOptionalFields(knownFields);

  if (safety.needsAdmin) {
    const replyPlan = replyPlanSchema.parse({
      flow: "ADMIN_REVIEW",
      stage: context.currentStage,
      nextStage: "NEEDS_ADMIN",
      enoughInfoForBrief: false,
      shouldEscalate: true,
      escalationReason: safety.flags.join(", "),
      nextQuestion: escalationHoldingReply(),
      replyTone: "professional_friendly_casual",
      allowedActions: ["persist_inbound_message", "audit_escalation"],
      blockedActions: blockedAutonomyActions,
      explanationForAudit:
        "Deterministic organizer intake policy escalated due to safety flags.",
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

  const stageDecision = determineNextStage({ knownFields, context });
  const confidence =
    stageDecision.nextStage === "BRIEF_READY"
      ? 0.86
      : missingRequiredFields.length <= 1
        ? 0.78
        : 0.72;

  const replyPlan = replyPlanSchema.parse({
    flow: "ORGANIZER_INTAKE",
    stage: context.currentStage,
    nextStage: stageDecision.nextStage,
    enoughInfoForBrief: stageDecision.enoughInfoForBrief,
    shouldEscalate: false,
    nextQuestion: stageDecision.nextQuestion,
    replyTone: "professional_friendly_casual",
    allowedActions: optionalSafeActions,
    blockedActions: blockedAutonomyActions,
    explanationForAudit: [
      stageDecision.explanation,
      `Missing required fields: ${missingRequiredFields.join(", ") || "none"}.`,
      `Missing optional fields: ${missingOptionalFields.join(", ") || "none"}.`,
    ].join(" "),
    confidence,
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
